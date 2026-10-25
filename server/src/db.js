const mongoose = require('mongoose');
const config = require('./config');

async function connectDatabase() {
  if (!config.mongoUri) {
    console.warn('MongoDB is not configured. Running in controlled demo mode; writes are in-memory only.');
    return false;
  }
  await mongoose.connect(config.mongoUri);
  console.log('Connected to MongoDB Atlas');
  return true;
}

module.exports = { connectDatabase };
