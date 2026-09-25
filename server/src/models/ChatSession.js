import mongoose from 'mongoose';
import { toJSONPlugin } from './plugins/toJSON.js';

// One conversation with the assistant.
const chatSessionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, default: 'New chat', maxlength: 80 },
  },
  { timestamps: true },
);

chatSessionSchema.plugin(toJSONPlugin);

export const ChatSession = mongoose.model('ChatSession', chatSessionSchema);
