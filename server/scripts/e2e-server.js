// Starts the API for the browser (Playwright) tests: an in-memory MongoDB replica set,
// test secrets and a scripted pretend AI, so the tests need no accounts or API keys.
// Run: npm run e2e:server   (listens on E2E_PORT, default 5055)
import { MongoMemoryReplSet } from 'mongodb-memory-server';

const port = Number(process.env.E2E_PORT ?? 5055);
const mongo = await MongoMemoryReplSet.create({
  replSet: { count: 1, storageEngine: 'wiredTiger' },
});

// The environment is read when the app is first imported, so set it before that.
Object.assign(process.env, {
  NODE_ENV: 'test',
  PORT: String(port),
  MONGODB_URI: mongo.getUri('paisa-pal-e2e'),
  JWT_ACCESS_SECRET: 'e2e-access-secret-at-least-32-characters-long',
  JWT_REFRESH_SECRET: 'e2e-refresh-secret-at-least-32-characters-long',
  BCRYPT_ROUNDS: '4',
  LOG_LEVEL: 'warn',
});

const { createApp } = await import('../src/app.js');
const { connectDB } = await import('../src/config/db.js');
const { setLLMProvider } = await import('../src/ai/llm/adapter.js');
const { quickParse } = await import('../src/ai/parsers/nlParser.js');

// Pretend AI: reads typed notes with the plain parser, and answers chat questions by
// calling getSpending and reporting the total.
setLLMProvider({
  name: 'e2e-fake',
  models: { fast: 'fake', smart: 'fake' },
  async complete({ system, user }) {
    const note = /<data label="note">\n([\s\S]*?)\n<\/data>/.exec(user)?.[1];
    if (note) {
      const today = /Today is \w+ (\d{4}-\d{2}-\d{2})/.exec(system)?.[1];
      const parsed = quickParse(note, { today });
      return {
        text: JSON.stringify({
          ...parsed,
          amount: parsed.amount / 100,
          categoryName: /biryani|lunch|dinner|food/i.test(note) ? 'Food & Dining' : null,
          confidence: 0.9,
        }),
        model: 'fake',
        usage: {},
      };
    }
    return { text: JSON.stringify({ results: [] }), model: 'fake', usage: {} };
  },
  async *chat({ messages }) {
    const last = messages.at(-1);
    if (last.role === 'user') {
      yield { type: 'tool_call', id: 'c1', name: 'getSpending', args: { groupBy: 'category' } };
      return;
    }
    const { total, groups = [] } = JSON.parse(last.content);
    const top = groups[0] ? ` Most of it went on ${groups[0].label}.` : '';
    yield { type: 'text', text: `You spent ₹${total.toLocaleString('en-IN')} this month.${top}` };
  },
});

await connectDB(process.env.MONGODB_URI);
const server = createApp().listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`E2E API ready on http://localhost:${port}/api`);
});

const stop = async () => {
  server.close();
  await mongo.stop();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
