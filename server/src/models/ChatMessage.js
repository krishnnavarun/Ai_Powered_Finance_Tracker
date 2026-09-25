import mongoose from 'mongoose';
import { toJSONPlugin } from './plugins/toJSON.js';

// A message in a chat. 'tool' messages record which tool ran, with what, and what it
// returned (for "how did it work that out?" and debugging); the app shows user and
// assistant messages.
const chatMessageSchema = new mongoose.Schema(
  {
    sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'ChatSession', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ['user', 'assistant', 'tool'], required: true },
    content: { type: String, default: '', maxlength: 20000 },
    toolName: { type: String, default: null },
    toolArgs: { type: mongoose.Schema.Types.Mixed, default: null },
    toolResult: { type: mongoose.Schema.Types.Mixed, default: null },
    toolsUsed: { type: [String], default: [] }, // on assistant messages
    chart: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: true },
);

chatMessageSchema.index({ sessionId: 1, createdAt: 1 });
chatMessageSchema.index({ userId: 1 });

chatMessageSchema.plugin(toJSONPlugin);

export const ChatMessage = mongoose.model('ChatMessage', chatMessageSchema);
