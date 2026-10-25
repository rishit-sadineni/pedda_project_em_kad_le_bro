const bcrypt = require('bcryptjs');
const { connectDatabase } = require('./db');
const { User, Game, Build, PlaytestSession, FeedbackReport, Message } = require('./models');

async function seed() {
  if (!process.env.MONGODB_URI) throw new Error('Set MONGODB_URI before seeding. Demo mode never seeds a production database.');
  await connectDatabase();
  await Promise.all([User.deleteMany({}), Game.deleteMany({}), Build.deleteMany({}), PlaytestSession.deleteMany({}), FeedbackReport.deleteMany({}), Message.deleteMany({})]);
  const [developer, tester] = await User.create([
    { name: 'Maya Chen', email: 'developer@signalforge.demo', passwordHash: await bcrypt.hash('DemoPass123!', 12), role: 'developer', theme: 'cyber' },
    { name: 'Alex Rivera', email: 'tester@signalforge.demo', passwordHash: await bcrypt.hash('DemoPass123!', 12), role: 'tester' }
  ]);
  const game = await Game.create({ name: 'Starfall Outpost', description: 'A compact sci-fi survival adventure.', genre: 'Sci-fi adventure', platform: 'PC', developerId: developer._id });
  const build = await Build.create({ gameId: game._id, version: '0.8.4', status: 'Testing', releaseDate: new Date() });
  const session = await PlaytestSession.create({ gameId: game._id, buildId: build._id, name: 'Bridge traversal study', testerIds: [tester._id] });
  const report = await FeedbackReport.create({ reportId: 'SF-1042', testerId: tester._id, gameId: game._id, buildId: build._id, sessionId: session._id, title: 'Player gets stuck after crossing the bridge', category: 'Bug', description: 'The player cannot move after crossing the wooden bridge near the first outpost.', steps: 'Cross the bridge, activate the checkpoint, then walk toward the antenna.', expected: 'The player should keep moving.', actual: 'Movement input stops responding.', status: 'Under Investigation', priority: 'High', severity: 'Major' });
  await Message.create({ reportId: report._id, senderId: developer._id, recipientId: tester._id, content: 'Does this happen every time, or only after activating the checkpoint?' });
  console.log(`Seeded demo workspace. Developer: ${developer.email} / Tester: ${tester.email} / Password: DemoPass123!`);
  process.exit(0);
}
seed().catch((error) => { console.error(error); process.exit(1); });
