import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { MAX_TOOL_CALLS } from '../../src/ai/chatAgent.js';
import { LLMRequestError } from '../../src/ai/errors.js';
import { runTool } from '../../src/ai/tools/index.js';
import { createApp } from '../../src/app.js';
import { ChatMessage } from '../../src/models/ChatMessage.js';
import { signUp } from '../helpers/auth.js';
import { clearTestDB, startTestDB, stopTestDB } from '../helpers/db.js';
import { resetLLMAfterEach, useFakeChat, useNoLLM } from '../helpers/fakeLLM.js';
import { setUpMoney } from '../helpers/fixtures.js';

let app;
let asha;
let wallets;
let category;

beforeAll(startTestDB);
afterAll(stopTestDB);
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-09-24T06:30:00Z'));
  app = createApp();
  asha = await signUp(app, { name: 'Asha Rao' });
  ({ wallets, category } = await setUpMoney(asha));
});
afterEach(async () => {
  vi.useRealTimers();
  await clearTestDB();
});
resetLLMAfterEach();

const spend = (fields) =>
  asha.post('/api/transactions').send({ type: 'expense', walletId: wallets.bank.id, ...fields });

// Reads a server-sent-events body into [{ event, data }].
function parseEvents(text) {
  return text
    .split('\n\n')
    .filter(Boolean)
    .map((block) => {
      const event = /^event: (.*)$/m.exec(block)?.[1];
      const data = JSON.parse(/^data: (.*)$/m.exec(block)?.[1] ?? 'null');
      return { event, data };
    });
}

async function ask(sessionId, content) {
  const res = await asha
    .post(`/api/chat/sessions/${sessionId}/messages`)
    .send({ content })
    .buffer(true)
    .parse((response, done) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => {
        body += chunk;
      });
      response.on('end', () => done(null, body));
    });
  return {
    res,
    events: res.headers['content-type']?.startsWith('text/event-stream')
      ? parseEvents(res.body)
      : [],
  };
}

const newSession = async () => (await asha.post('/api/chat/sessions').send({})).body.data.session;

describe('chat tools', () => {
  beforeEach(async () => {
    await spend({
      amount: 25000,
      merchant: 'Swiggy',
      categoryId: category['Food & Dining'].id,
      date: '2026-09-02',
    });
    await spend({
      amount: 45000,
      merchant: 'Zomato',
      categoryId: category['Food & Dining'].id,
      date: '2026-09-10',
    });
    await spend({
      amount: 1500000,
      merchant: 'Landlord',
      categoryId: category.Rent.id,
      date: '2026-09-01',
    });
    await spend({
      amount: 30000,
      merchant: 'Swiggy',
      categoryId: category['Food & Dining'].id,
      date: '2026-08-15',
    });
  });

  it('getSpending: totals in rupees, split by category, with a chart', async () => {
    const { result, chart } = await runTool(asha.user.id, 'getSpending', { groupBy: 'category' });
    expect(result).toMatchObject({ from: '2026-09-01', to: '2026-09-30', total: 15700, count: 3 });
    expect(result.groups).toEqual([
      { label: 'Rent', amount: 15000, count: 1 },
      { label: 'Food & Dining', amount: 700, count: 2 },
    ]);
    expect(chart).toMatchObject({
      type: 'bar',
      data: [
        { label: 'Rent', value: 15000 },
        { label: 'Food & Dining', value: 700 },
      ],
    });
  });

  it('getSpending: one category by name, split by month', async () => {
    const { result } = await runTool(asha.user.id, 'getSpending', {
      category: 'food & dining',
      from: '2026-08-01',
      to: '2026-09-30',
      groupBy: 'month',
    });
    expect(result.total).toBe(1000);
    expect(result.groups).toEqual([
      { label: '2026-08', amount: 300, count: 1 },
      { label: '2026-09', amount: 700, count: 2 },
    ]);
  });

  it('compareSpending: two periods side by side', async () => {
    const { result, chart } = await runTool(asha.user.id, 'compareSpending', {
      periodA: { from: '2026-08-01', to: '2026-08-31' },
      periodB: { from: '2026-09-01', to: '2026-09-30' },
    });
    expect(result.periodA.total).toBe(300);
    expect(result.periodB.total).toBe(15700);
    expect(result.rows).toContainEqual({ label: 'Food & Dining', a: 300, b: 700, difference: 400 });
    expect(chart.type).toBe('compare');
  });

  it('searchTransactions finds payments by words', async () => {
    const { result } = await runTool(asha.user.id, 'searchTransactions', { query: 'swig' });
    expect(result.transactions.map((t) => [t.date, t.amount, t.category])).toEqual([
      ['2026-09-02', 250, 'Food & Dining'],
      ['2026-08-15', 300, 'Food & Dining'],
    ]);
  });

  it('turns bad arguments and unknown names into messages for the model', async () => {
    expect((await runTool(asha.user.id, 'deleteEverything', {})).result.error).toBe(
      'Unknown tool "deleteEverything".',
    );
    expect(
      (await runTool(asha.user.id, 'getSpending', { from: 'yesterday' })).result.error,
    ).toMatch(/^Invalid arguments\. from:/);
    expect((await runTool(asha.user.id, 'getSpending', { category: 'Yachts' })).result.error).toBe(
      'There is no expense category called "Yachts".',
    );
  });

  it('never reads another user’s data', async () => {
    const ravi = await signUp(app, { name: 'Ravi' });
    const { result } = await runTool(ravi.user.id, 'getSpending', { groupBy: 'merchant' });
    expect(result).toMatchObject({ total: 0, count: 0, groups: [] });
    const search = await runTool(ravi.user.id, 'searchTransactions', { query: 'Swiggy' });
    expect(search.result.count).toBe(0);
  });

  it('masks personal details in tool results', async () => {
    await spend({ amount: 10000, merchant: 'Paid to rahul@okicici', date: '2026-09-11' });
    const { result } = await runTool(asha.user.id, 'searchTransactions', { query: 'rahul' });
    expect(result.transactions[0].merchant).toBe('Paid to XXXX@okicici');
  });
});

describe('chat sessions and answers', () => {
  it('answers with tools, streams the text and a chart, and saves the conversation', async () => {
    await spend({
      amount: 25000,
      merchant: 'Swiggy',
      categoryId: category['Food & Dining'].id,
      date: '2026-09-02',
    });
    const llm = useFakeChat(
      { toolCalls: [{ name: 'getSpending', args: { groupBy: 'category' } }] },
      (request) => {
        const result = JSON.parse(request.messages.at(-1).content);
        return { text: `You spent ₹${result.total} this month, all on food.` };
      },
    );
    const session = await newSession();

    const { res, events } = await ask(session.id, 'Where did my money go this month?');

    expect(res.status).toBe(200);
    expect(events.map((e) => e.event)).toEqual(['tool', 'chart', 'text', 'text', 'done']);
    expect(events[0].data).toEqual({ name: 'getSpending' });
    expect(events[1].data.chart.data).toEqual([{ label: 'Food & Dining', value: 250 }]);
    const text = events
      .filter((e) => e.event === 'text')
      .map((e) => e.data.text)
      .join('');
    expect(text).toBe('You spent ₹250 this month, all on food.');
    expect(events.at(-1).data.message).toMatchObject({
      role: 'assistant',
      content: 'You spent ₹250 this month, all on food.',
      toolsUsed: ['getSpending'],
    });

    // The model saw today's date, the user's name and the tools, but never the user id.
    const first = llm.chatCalls[0];
    expect(first.system).toContain('Today is 2026-09-24');
    expect(first.system).toContain('for Asha in India');
    expect(first.tools.map((t) => t.name)).toContain('getSpending');
    expect(JSON.stringify(first)).not.toContain(asha.user.id);

    const saved = await asha.get(`/api/chat/sessions/${session.id}`);
    expect(saved.body.data.session.title).toBe('Where did my money go this month?');
    expect(saved.body.data.messages.map((m) => [m.role, m.content])).toEqual([
      ['user', 'Where did my money go this month?'],
      ['assistant', 'You spent ₹250 this month, all on food.'],
    ]);
    const toolRows = await ChatMessage.find({ role: 'tool' }).lean();
    expect(toolRows).toEqual([expect.objectContaining({ toolName: 'getSpending' })]);
  });

  it(`stops after ${MAX_TOOL_CALLS} tool calls and makes the model answer`, async () => {
    const llm = useFakeChat((request) =>
      request.tools.length
        ? {
            toolCalls: [
              { name: 'getBalances', args: {} },
              { name: 'getGoals', args: {} },
            ],
          }
        : { text: 'Here is what I found.' },
    );
    const session = await newSession();
    const { events } = await ask(session.id, 'Tell me everything');

    expect(events.filter((e) => e.event === 'tool')).toHaveLength(MAX_TOOL_CALLS);
    expect(llm.chatCalls.at(-1).tools).toEqual([]);
    expect(events.at(-1).data.message.content).toBe('Here is what I found.');
  });

  it('sends earlier messages along, masked', async () => {
    const llm = useFakeChat({ text: 'Okay.' });
    const session = await newSession();
    await ask(session.id, 'My card 4111 1111 1111 1234 was charged twice');
    await ask(session.id, 'What should I do?');

    const second = llm.chatCalls[1].messages;
    expect(second.map((m) => m.role)).toEqual(['user', 'assistant', 'user']);
    expect(second[0].content).toBe('My card XXXX1234 was charged twice');
  });

  it('refuses before streaming when AI is off or not set up', async () => {
    const session = await newSession();
    useNoLLM();
    const notSetUp = await asha
      .post(`/api/chat/sessions/${session.id}/messages`)
      .send({ content: 'Hi' });
    expect(notSetUp.status).toBe(503);
    expect(notSetUp.body.error.code).toBe('AI_UNAVAILABLE');

    useFakeChat({ text: 'Hi' });
    await asha.patch('/api/users/me/settings').send({ aiEnabled: false });
    const off = await asha
      .post(`/api/chat/sessions/${session.id}/messages`)
      .send({ content: 'Hi' });
    expect(off.body.error.code).toBe('AI_DISABLED');
  });

  it('reports a provider failure inside the stream', async () => {
    useFakeChat(new LLMRequestError('AI provider replied 503', { status: 503, retryable: true }));
    const session = await newSession();
    const { events } = await ask(session.id, 'Hi');
    expect(events).toEqual([
      {
        event: 'error',
        data: { code: 'AI_UNAVAILABLE', message: expect.stringContaining('not available') },
      },
    ]);
  });

  it('lists, and deletes chats with their messages', async () => {
    useFakeChat({ text: 'Hello!' });
    const session = await newSession();
    await ask(session.id, 'Hi');

    const list = await asha.get('/api/chat/sessions');
    expect(list.body.data.sessions.map((s) => s.title)).toEqual(['Hi']);

    expect((await asha.delete(`/api/chat/sessions/${session.id}`)).status).toBe(204);
    expect(await ChatMessage.countDocuments({})).toBe(0);
    expect((await asha.get(`/api/chat/sessions/${session.id}`)).status).toBe(404);
  });

  it('keeps chats private', async () => {
    useFakeChat({ text: 'Hello!' });
    const session = await newSession();
    const ravi = await signUp(app, { name: 'Ravi' });

    expect((await ravi.get(`/api/chat/sessions/${session.id}`)).status).toBe(404);
    expect(
      (await ravi.post(`/api/chat/sessions/${session.id}/messages`).send({ content: 'Hi' })).status,
    ).toBe(404);
    expect((await ravi.delete(`/api/chat/sessions/${session.id}`)).status).toBe(404);
    expect((await ravi.get('/api/chat/sessions')).body.data.sessions).toEqual([]);
  });

  it('limits questions to 30 an hour', async () => {
    useFakeChat({ text: 'Ok' });
    const session = await newSession();
    for (let i = 0; i < 30; i += 1) await ask(session.id, `Question ${i}`);
    const res = await asha
      .post(`/api/chat/sessions/${session.id}/messages`)
      .send({ content: 'One more' });
    expect(res.status).toBe(429);
  }, 60_000);
});
