import { runAgent, systemPrompt } from '../ai/chatAgent.js';
import { ChatMessage } from '../models/ChatMessage.js';
import { ChatSession } from '../models/ChatSession.js';
import { User } from '../models/User.js';
import { localDateOf, monthContaining, monthRange } from '../utils/dates.js';
import { assertAIAllowed } from './ai.service.js';
import { findOwnedOrThrow } from './ownership.js';
import { getUserPrefs } from './userPrefs.js';

const HISTORY_MESSAGES = 20; // earlier messages sent along for context

const findSession = (userId, id) => findOwnedOrThrow(ChatSession, userId, id, { label: 'Chat' });

export async function listSessions(userId) {
  return ChatSession.find({ userId }).sort({ updatedAt: -1 }).limit(50);
}

export async function createSession(userId, { title } = {}) {
  return ChatSession.create({ userId, ...(title ? { title } : {}) });
}

// The conversation as shown in the app: the user's messages and the answers.
export async function getSession(userId, id) {
  const session = await findSession(userId, id);
  const messages = await ChatMessage.find({
    sessionId: session._id,
    userId,
    role: { $in: ['user', 'assistant'] },
  }).sort({ createdAt: 1, _id: 1 });
  return { session, messages };
}

export async function deleteSession(userId, id) {
  const session = await findSession(userId, id);
  await ChatMessage.deleteMany({ sessionId: session._id, userId });
  await session.deleteOne();
}

// Checks everything that can fail with a normal error *before* the answer starts
// streaming: the chat exists and is the user's, and AI is allowed. Saves the question.
export async function prepareMessage(userId, sessionId, content) {
  const session = await findSession(userId, sessionId);
  await assertAIAllowed(userId);

  const earlier = await ChatMessage.find({
    sessionId: session._id,
    userId,
    role: { $in: ['user', 'assistant'] },
  })
    .sort({ createdAt: -1, _id: -1 })
    .limit(HISTORY_MESSAGES)
    .lean();

  const question = await ChatMessage.create({
    sessionId: session._id,
    userId,
    role: 'user',
    content,
  });
  if (session.title === 'New chat') {
    session.title = content.length > 60 ? `${content.slice(0, 57)}…` : content;
  }
  session.updatedAt = new Date();
  await session.save();

  return {
    userId: String(userId),
    session,
    question,
    history: earlier.reverse().map((m) => ({ role: m.role, content: m.content })),
    content,
  };
}

// Streams the answer (see runAgent for the events) and saves it when finished.
export async function* streamReply({ userId, session, history, content }) {
  const [prefs, user] = await Promise.all([
    getUserPrefs(userId),
    User.findById(userId).select('name').lean(),
  ]);
  const now = new Date();
  const month = monthRange(monthContaining(now, prefs), prefs);
  const system = systemPrompt({
    name: user?.name?.split(' ')[0],
    today: localDateOf(now, prefs.timeZone),
    monthFrom: month.fromDate,
    monthTo: month.toDate,
  });

  for await (const event of runAgent({ userId, system, history, userText: content })) {
    if (event.type !== 'done') {
      yield event;
      continue;
    }
    await ChatMessage.insertMany(
      event.steps.map((step) => ({
        sessionId: session._id,
        userId,
        role: 'tool',
        toolName: step.name,
        toolArgs: step.args,
        toolResult: step.result,
      })),
    );
    const answer = await ChatMessage.create({
      sessionId: session._id,
      userId,
      role: 'assistant',
      content: event.content,
      chart: event.chart,
      toolsUsed: event.toolsUsed,
    });
    yield { type: 'done', message: answer.toJSON() };
  }
}
