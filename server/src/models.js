const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['tester', 'developer'], required: true },
  theme: { type: String, enum: ['light', 'cyber'], default: 'light' }
}, { timestamps: true });

const gameSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: String,
  genre: String,
  platform: String,
  status: { type: String, enum: ['Active', 'Archived', 'In production'], default: 'Active' },
  developerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

const buildSchema = new mongoose.Schema({
  gameId: { type: mongoose.Schema.Types.ObjectId, ref: 'Game', required: true },
  version: { type: String, required: true },
  releaseDate: Date,
  releaseNotes: String,
  status: { type: String, enum: ['Internal', 'Testing', 'Released'], default: 'Testing' }
}, { timestamps: true });

const playtestSessionSchema = new mongoose.Schema({
  gameId: { type: mongoose.Schema.Types.ObjectId, ref: 'Game', required: true },
  name: { type: String, required: true },
  buildId: { type: mongoose.Schema.Types.ObjectId, ref: 'Build' },
  status: { type: String, enum: ['Open', 'Closed', 'Upcoming'], default: 'Open' },
  testerIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
}, { timestamps: true });

const feedbackReportSchema = new mongoose.Schema({
  reportId: { type: String, unique: true, required: true },
  testerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  gameId: { type: mongoose.Schema.Types.ObjectId, ref: 'Game', required: true },
  buildId: { type: mongoose.Schema.Types.ObjectId, ref: 'Build' },
  sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'PlaytestSession' },
  title: { type: String, required: true, trim: true },
  category: { type: String, enum: ['Bug', 'Confusing Instruction', 'Frustration', 'Gameplay Issue', 'Performance Issue', 'Other'], required: true },
  description: { type: String, required: true },
  steps: String,
  expected: String,
  actual: String,
  status: { type: String, enum: ['New', 'Under Investigation', 'In Progress', 'Fix Available', 'Awaiting Retest', 'Verified', 'Closed'], default: 'New' },
  priority: { type: String, enum: ['High', 'Medium', 'Low'] },
  severity: { type: String, enum: ['Critical', 'Major', 'Minor'] },
  aiSuggestion: String,
  aiSuggestionReason: String,
  embedding: [Number],
  embeddingModel: String
}, { timestamps: true });

const messageSchema = new mongoose.Schema({
  reportId: { type: mongoose.Schema.Types.ObjectId, ref: 'FeedbackReport', required: true },
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  recipientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, required: true, maxlength: 4000 },
  readAt: Date
}, { timestamps: true });

const retestSchema = new mongoose.Schema({
  reportId: { type: mongoose.Schema.Types.ObjectId, ref: 'FeedbackReport', required: true },
  testerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  buildId: { type: mongoose.Schema.Types.ObjectId, ref: 'Build' },
  result: { type: String, enum: ['Pass', 'Fail', 'Unable to Reproduce'], required: true },
  details: String
}, { timestamps: true });

const models = {};
for (const [name, schema] of Object.entries({ User: userSchema, Game: gameSchema, Build: buildSchema, PlaytestSession: playtestSessionSchema, FeedbackReport: feedbackReportSchema, Message: messageSchema, Retest: retestSchema })) {
  models[name] = mongoose.models[name] || mongoose.model(name, schema);
}
module.exports = models;
