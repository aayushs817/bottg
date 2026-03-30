const mongoose = require('mongoose');

const EventSchema = new mongoose.Schema(
  {
    telegramId: { type: String, required: true, index: true },
    username: { type: String, default: null },
    firstName: { type: String, default: null },
    type: { type: String, required: true, index: true },
    cta: { type: String, default: null },
    extra: { type: Object, default: {} }
  },
  { timestamps: true }
);

EventSchema.index({ type: 1, telegramId: 1 });
EventSchema.index({ createdAt: -1 });

module.exports = mongoose.models.Event || mongoose.model('Event', EventSchema);