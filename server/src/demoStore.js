const { randomUUID } = require('node:crypto');

const developer = { _id: 'dev-1', name: 'Maya Chen', email: 'developer@signalforge.demo', role: 'developer', theme: 'cyber' };
const tester = { _id: 'tester-1', name: 'Alex Rivera', email: 'tester@signalforge.demo', role: 'tester', theme: 'light' };
const games = [
  { _id: 'game-1', name: 'Starfall Outpost', description: 'A compact sci-fi survival adventure.', genre: 'Sci-fi adventure', platform: 'PC', status: 'Active' },
  { _id: 'game-2', name: 'Moss & Ember', description: 'A hand-painted puzzle platformer.', genre: 'Puzzle platformer', platform: 'PC / Switch', status: 'Active' }
];
const builds = [
  { _id: 'build-1', gameId: 'game-1', version: '0.8.4', status: 'Testing', releaseDate: '2026-10-20' },
  { _id: 'build-2', gameId: 'game-2', version: '1.2.0', status: 'Released', releaseDate: '2026-10-11' }
];
const sessions = [{ _id: 'session-1', gameId: 'game-1', buildId: 'build-1', name: 'Bridge traversal study', status: 'Open', testerIds: ['tester-1'] }];
const reports = [
  { _id: 'report-1', reportId: 'SF-1042', testerId: 'tester-1', gameId: 'game-1', buildId: 'build-1', sessionId: 'session-1', title: 'Player gets stuck after crossing the bridge', category: 'Bug', description: 'The player cannot move after crossing the wooden bridge near the first outpost.', steps: 'Cross the bridge, activate the checkpoint, then walk toward the antenna.', expected: 'The player should keep moving.', actual: 'Movement input stops responding.', status: 'Under Investigation', priority: 'High', severity: 'Major', createdAt: '2026-10-22T10:30:00Z', updatedAt: '2026-10-23T08:10:00Z' },
  { _id: 'report-2', reportId: 'SF-1039', testerId: 'tester-1', gameId: 'game-1', buildId: 'build-1', sessionId: 'session-1', title: 'Movement locks near the wooden bridge', category: 'Gameplay Issue', description: 'My player cannot move after crossing the wooden bridge.', steps: 'Cross the wooden bridge from the camp side.', expected: 'Continue toward the antenna.', actual: 'The character is stuck.', status: 'New', priority: 'Medium', createdAt: '2026-10-21T14:20:00Z', updatedAt: '2026-10-21T14:20:00Z' },
  { _id: 'report-3', reportId: 'SF-1030', testerId: 'tester-1', gameId: 'game-2', buildId: 'build-2', title: 'Tutorial instruction is easy to miss', category: 'Confusing Instruction', description: 'The prompt to light the ember is hidden behind the inventory panel.', status: 'Awaiting Retest', priority: 'Medium', createdAt: '2026-10-18T09:15:00Z', updatedAt: '2026-10-22T12:00:00Z' }
];
const messages = [{ _id: 'message-1', reportId: 'report-1', senderId: 'dev-1', recipientId: 'tester-1', content: 'Does this happen every time, or only after activating the checkpoint?', createdAt: '2026-10-23T08:20:00Z', readAt: null }];
const retests = [];

function id(prefix) { return `${prefix}-${randomUUID().slice(0, 8)}`; }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
module.exports = { developer, tester, games, builds, sessions, reports, messages, retests, id, clone };
