const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema(
  {
    telegramId: { type: String, required: true, unique: true, index: true },
    username: { type: String, default: null },
    firstName: { type: String, default: null },
    lastName: { type: String, default: null },
    firstSeen: { type: Date, default: Date.now },
    lastSeen: { type: Date, default: Date.now },
    starts: { type: Number, default: 0 },
    clicks: {
      register: { type: Number, default: 0 },
      support: { type: Number, default: 0 },
      telegram: { type: Number, default: 0 },
      help: { type: Number, default: 0 }
    },
    linkOpens: {
      register: { type: Number, default: 0 },
      support: { type: Number, default: 0 },
      telegram: { type: Number, default: 0 }
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', UserSchema);