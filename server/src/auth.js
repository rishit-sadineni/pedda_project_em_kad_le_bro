const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const { User } = require('./models');
const store = require('./demoStore');
const config = require('./config');

function passwordHash(password) { return bcrypt.hash(password, 12); }
function publicUser(user) { const { passwordHash: _, ...safe } = user.toObject ? user.toObject() : user; return safe; }
function findDemoUser(email) { return [store.developer, store.tester].find((user) => user.email === email); }

async function login(req, email, password, role) {
  if (config.demoMode) {
    const user = findDemoUser(email);
    if (!user || user.role !== role || password !== 'DemoPass123!') return null;
    req.session.user = user;
    return user;
  }
  const user = await User.findOne({ email: email.toLowerCase(), role });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) return null;
  req.session.user = publicUser(user);
  return req.session.user;
}

function requireAuth(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: 'Authentication required.' });
  next();
}
function requireRole(role) {
  return (req, res, next) => req.session.user?.role === role ? next() : res.status(403).json({ error: 'You do not have permission for this resource.' });
}
module.exports = { passwordHash, publicUser, login, requireAuth, requireRole };
