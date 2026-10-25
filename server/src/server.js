const express = require('express');
const session = require('express-session');
const cors = require('cors');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const config = require('./config');
const { connectDatabase } = require('./db');
const { User, Game, Build, PlaytestSession, FeedbackReport, Message, Retest } = require('./models');
const store = require('./demoStore');
const { login, passwordHash, requireAuth, requireRole } = require('./auth');
const { investigate } = require('./ai');

const app = express();
app.use(cors({ origin: config.clientUrl, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(session({ name: 'signalforge.sid', secret: config.sessionSecret, resave: false, saveUninitialized: false, cookie: { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 1000 * 60 * 60 * 8 } }));
app.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

const isDemo = () => config.demoMode;
const collection = (model, fallback) => isDemo() ? fallback : model;
const withId = (items, id) => items.find((item) => String(item._id) === String(id));
function safeReport(report) { return report; }
function reportView(report) {
  const game = report.game || (isDemo() ? withId(store.games, report.gameId) : undefined);
  const build = report.build || (isDemo() ? withId(store.builds, report.buildId) : undefined);
  const tester = report.tester || (isDemo() && String(report.testerId) === store.tester._id ? store.tester : undefined);
  return {
    ...safeReport(report),
    game,
    build,
    tester
  };
}
function validateBody(fields) {
  return (req, res, next) => {
    const missing = fields.filter((field) => typeof req.body[field] !== 'string' || !req.body[field].trim());
    if (missing.length) return res.status(400).json({ error: `Required fields: ${missing.join(', ')}.` });
    next();
  };
}
function validId(id) { return isDemo() || mongoose.isValidObjectId(id); }
async function findReport(id) {
  if (!validId(id)) return null;
  return isDemo() ? withId(store.reports, id) : FeedbackReport.findById(id).lean();
}
function ownsReport(req, report) {
  return report && (req.session.user.role === 'developer' || String(report.testerId) === String(req.session.user._id));
}

app.get('/api/health', (_req, res) => res.json({ ok: true, database: isDemo() ? 'demo-mode' : 'mongodb', ai: 'ollama-configured', aiModel: config.ollamaChatModel }));
app.post('/api/auth/login', validateBody(['email', 'password', 'role']), async (req, res, next) => {
  try {
    if (!['tester', 'developer'].includes(req.body.role)) return res.status(400).json({ error: 'Choose a valid portal.' });
    const user = await login(req, req.body.email, req.body.password, req.body.role);
    if (!user) return res.status(401).json({ error: 'Invalid credentials.' });
    res.json({ user });
  } catch (error) { next(error); }
});
app.post('/api/auth/register', validateBody(['name', 'email', 'password']), async (req, res, next) => {
  try {
    if (req.body.password.length < 10) return res.status(400).json({ error: 'Password must be at least 10 characters.' });
    if (isDemo()) {
      const demoUser = { ...store.tester, name: req.body.name, email: req.body.email, role: 'tester' };
      req.session.user = demoUser;
      return res.status(201).json({ user: demoUser, notice: 'Demo mode: registration is not persisted until MongoDB is configured.' });
    }
    const user = await User.create({ name: req.body.name, email: req.body.email, passwordHash: await passwordHash(req.body.password), role: 'tester' });
    req.session.user = { _id: user._id, name: user.name, email: user.email, role: user.role, theme: user.theme };
    res.status(201).json({ user: req.session.user });
  } catch (error) { next(error); }
});
app.post('/api/auth/logout', (req, res) => {
  req.session.destroy((error) => {
    res.clearCookie('signalforge.sid', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' });
    if (error) return res.status(500).json({ error: 'Unable to end the session. Please try again.' });
    res.status(204).end();
  });
});
app.get('/api/auth/me', (req, res) => req.session.user ? res.json({ user: req.session.user }) : res.status(401).json({ error: 'Authentication required.' }));

app.get('/api/games', requireAuth, async (_req, res, next) => {
  try { res.json({ games: isDemo() ? store.games : await Game.find().lean(), builds: isDemo() ? store.builds : await Build.find().lean(), sessions: isDemo() ? store.sessions : await PlaytestSession.find().lean() }); } catch (error) { next(error); }
});
app.post('/api/games', requireAuth, requireRole('developer'), validateBody(['name', 'description']), async (req, res, next) => {
  try { const game = isDemo() ? { _id: store.id('game'), ...req.body, status: 'Active' } : await Game.create({ ...req.body, developerId: req.session.user._id }); if (isDemo()) store.games.push(game); res.status(201).json({ game }); } catch (error) { next(error); }
});

app.get('/api/reports', requireAuth, async (req, res, next) => {
  try {
    const query = {};
    if (req.session.user.role === 'tester') query.testerId = req.session.user._id;
    if (req.query.status) query.status = req.query.status;
    const reports = isDemo() ? store.reports.filter((report) => (!query.testerId || report.testerId === query.testerId) && (!query.status || report.status === query.status)).map(reportView) : await FeedbackReport.find(query).sort({ updatedAt: -1 }).lean();
    res.json({ reports });
  } catch (error) { next(error); }
});
app.get('/api/reports/:id', requireAuth, async (req, res, next) => {
  try {
    const report = await findReport(req.params.id);
    if (!ownsReport(req, report)) return res.status(404).json({ error: 'Report not found.' });
    const related = isDemo()
      ? store.reports.filter((item) => item._id !== report._id && item.gameId === report.gameId)
      : await FeedbackReport.find({ gameId: report.gameId, _id: { $ne: report._id } }).select('reportId title description buildId sessionId status priority').limit(20).lean();
    res.json({ report: reportView(report), related });
  } catch (error) { next(error); }
});
app.post('/api/reports', requireAuth, requireRole('tester'), validateBody(['title', 'category', 'description', 'gameId']), async (req, res, next) => {
  try {
    const gameExists = isDemo() ? withId(store.games, req.body.gameId) : validId(req.body.gameId) && await Game.exists({ _id: req.body.gameId });
    if (!gameExists) return res.status(400).json({ error: 'Choose an available game.' });
    const report = { _id: store.id('report'), reportId: `SF-${Math.floor(1000 + Math.random() * 8999)}`, testerId: req.session.user._id, ...req.body, status: 'New', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    if (isDemo()) store.reports.unshift(report); else Object.assign(report, await FeedbackReport.create(report));
    res.status(201).json({ report: reportView(report) });
  } catch (error) { next(error); }
});
app.patch('/api/reports/:id/status', requireAuth, requireRole('developer'), validateBody(['status']), async (req, res, next) => {
  try {
    const allowed = ['New', 'Under Investigation', 'In Progress', 'Fix Available', 'Awaiting Retest', 'Verified', 'Closed'];
    if (!allowed.includes(req.body.status)) return res.status(400).json({ error: 'Invalid issue status.' });
    if (isDemo()) { const report = withId(store.reports, req.params.id); if (!report) return res.status(404).json({ error: 'Report not found.' }); report.status = req.body.status; report.updatedAt = new Date().toISOString(); return res.json({ report }); }
    const report = validId(req.params.id) && await FeedbackReport.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true }).lean();
    if (!report) return res.status(404).json({ error: 'Report not found.' });
    res.json({ report });
  } catch (error) { next(error); }
});

function authorizedReport(req, report) { return report && (req.session.user.role === 'developer' || report.testerId === req.session.user._id); }
app.get('/api/reports/:id/messages', requireAuth, async (req, res, next) => {
  try {
    const report = await findReport(req.params.id);
    if (!ownsReport(req, report)) return res.status(404).json({ error: 'Conversation not found.' });
    const messages = isDemo() ? store.messages.filter((message) => message.reportId === req.params.id) : await Message.find({ reportId: req.params.id }).sort({ createdAt: 1 }).lean();
    if (isDemo()) messages.filter((message) => message.recipientId === req.session.user._id).forEach((message) => { message.readAt = new Date().toISOString(); });
    res.json({ messages });
  } catch (error) { next(error); }
});
app.post('/api/reports/:id/messages', requireAuth, validateBody(['content']), async (req, res, next) => {
  try {
    if (req.body.content.trim().length > 4000) return res.status(400).json({ error: 'Messages must be 4000 characters or fewer.' });
    const report = await findReport(req.params.id);
    if (!ownsReport(req, report)) return res.status(404).json({ error: 'Conversation not found.' });
    const recipient = req.session.user.role === 'developer'
      ? { _id: report.testerId }
      : isDemo() ? store.developer : await User.findOne({ role: 'developer' }).select('_id').lean();
    if (!recipient) return res.status(503).json({ error: 'No developer is available for this conversation.' });
    const recipientId = recipient._id;
    const message = { _id: store.id('message'), reportId: req.params.id, senderId: req.session.user._id, recipientId, content: req.body.content.trim(), createdAt: new Date().toISOString(), readAt: null };
    if (isDemo()) store.messages.push(message); else await Message.create(message);
    res.status(201).json({ message });
  } catch (error) { next(error); }
});
app.post('/api/reports/:id/retests', requireAuth, requireRole('tester'), validateBody(['result']), async (req, res, next) => {
  try {
    if (!['Pass', 'Fail', 'Unable to Reproduce'].includes(req.body.result)) return res.status(400).json({ error: 'Invalid retest result.' });
    const report = await findReport(req.params.id);
    if (!report || String(report.testerId) !== String(req.session.user._id)) return res.status(404).json({ error: 'Report not found.' });
    const retest = { _id: store.id('retest'), reportId: req.params.id, testerId: req.session.user._id, ...req.body, createdAt: new Date().toISOString() };
    const nextStatus = req.body.result === 'Pass' ? 'Verified' : req.body.result === 'Fail' ? 'Under Investigation' : 'Awaiting Retest';
    if (isDemo()) { store.retests.push(retest); report.status = nextStatus; report.updatedAt = new Date().toISOString(); } else {
      await Retest.create(retest);
      await FeedbackReport.findByIdAndUpdate(req.params.id, { status: nextStatus });
    }
    res.status(201).json({ retest });
  } catch (error) { next(error); }
});
app.post('/api/reports/:id/investigate', requireAuth, requireRole('developer'), async (req, res, next) => {
  try {
    const report = await findReport(req.params.id);
    if (!report) return res.status(404).json({ error: 'Report not found.' });
    const similarReports = isDemo()
      ? store.reports.filter((item) => item._id !== report._id && item.gameId === report.gameId)
      : await FeedbackReport.find({ gameId: report.gameId, _id: { $ne: report._id } }).select('reportId buildId sessionId').limit(20).lean();
    const sameGameReports = isDemo() ? [report, ...similarReports] : [report, ...similarReports];
    const result = await investigate({ reportId: req.params.id, question: req.body.question }, report, similarReports, new Set(sameGameReports.map((item) => String(item.sessionId)).filter(Boolean)).size);
    res.json({ investigation: result });
  } catch (error) { next(error); }
});

app.use((error, _req, res, _next) => { console.error(error); res.status(error.name === 'ValidationError' ? 400 : 500).json({ error: 'The server could not complete that request.' }); });
async function start() { await connectDatabase(); app.listen(config.port, () => console.log(`SignalForge API listening on http://localhost:${config.port}`)); }
if (require.main === module) start().catch((error) => { console.error(error); process.exit(1); });
module.exports = app;
