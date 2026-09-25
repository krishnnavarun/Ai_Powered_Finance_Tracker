import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { installFakeApi } from '@/test/fakeApi';
import { apiError, http, HttpResponse, server } from '@/test/msw';
import { findToast, renderApp } from '@/test/utils';

const ok = (data, status = 200) => HttpResponse.json({ success: true, data }, { status });

// A server-sent-events reply, like the real chat endpoint.
function sse(events) {
  const text = events
    .map(([event, data]) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
    .join('');
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(text));
      controller.close();
    },
  });
  return new HttpResponse(body, {
    headers: { 'Content-Type': 'text/event-stream' },
  });
}

function fakeChat({ reply } = {}) {
  const db = { sessions: [], messages: [], asked: [] };
  let counter = 0;
  const answer = 'You spent **₹15,700** this month:\n\n- Rent: ₹15,000\n- Food: ₹700';
  server.use(
    http.get('*/api/chat/sessions', () => ok({ sessions: [...db.sessions].reverse() })),
    http.post('*/api/chat/sessions', () => {
      const session = { id: `s${(counter += 1)}`, title: 'New chat' };
      db.sessions.push(session);
      return ok({ session }, 201);
    }),
    http.get('*/api/chat/sessions/:id', ({ params }) => {
      const session = db.sessions.find((s) => s.id === params.id);
      if (!session) return apiError(404, 'NOT_FOUND', 'Chat not found');
      return ok({ session, messages: db.messages.filter((m) => m.sessionId === params.id) });
    }),
    http.delete('*/api/chat/sessions/:id', ({ params }) => {
      db.sessions = db.sessions.filter((s) => s.id !== params.id);
      return new HttpResponse(null, { status: 204 });
    }),
    http.post('*/api/chat/sessions/:id/messages', async ({ params, request }) => {
      const { content } = await request.json();
      db.asked.push(content);
      if (reply) return reply(content);
      const session = db.sessions.find((s) => s.id === params.id);
      session.title = content;
      db.messages.push({ id: `m${(counter += 1)}`, sessionId: params.id, role: 'user', content });
      const message = {
        id: `m${(counter += 1)}`,
        sessionId: params.id,
        role: 'assistant',
        content: answer,
        chart: {
          type: 'bar',
          title: 'Spending by category',
          data: [
            { label: 'Rent', value: 15000 },
            { label: 'Food & Dining', value: 700 },
          ],
        },
      };
      db.messages.push(message);
      return sse([
        ['tool', { name: 'getSpending' }],
        ['chart', { chart: message.chart }],
        ['text', { text: 'You spent **₹15,700** this month:\n\n' }],
        ['text', { text: '- Rent: ₹15,000\n- Food: ₹700' }],
        ['done', { message }],
      ]);
    }),
  );
  return db;
}

describe('assistant', () => {
  it('starts a chat from a suggested question and shows the streamed answer with a chart', async () => {
    const user = userEvent.setup();
    installFakeApi();
    const db = fakeChat();
    const { router } = renderApp('/assistant');

    await user.click(
      await screen.findByRole('button', { name: 'Where did most of my money go this month?' }),
    );

    const conversation = screen.getByRole('region', { name: 'Conversation' });
    expect(await within(conversation).findByText('₹15,700')).toBeInTheDocument();
    expect(within(conversation).getByText('₹15,700').tagName).toBe('STRONG');
    const items = within(conversation).getAllByRole('listitem');
    expect(items.map((li) => li.textContent)).toContain('Rent: ₹15,000');
    expect(
      within(conversation).getByRole('list', { name: 'Spending by category' }),
    ).toHaveTextContent('Rent₹15,000');
    expect(db.asked).toEqual(['Where did most of my money go this month?']);
    expect(router.state.location.search).toBe('?chat=s1');

    // The chat is listed by its first question.
    const chats = screen.getByRole('navigation', { name: 'Chats' });
    expect(
      await within(chats).findByRole('button', {
        name: 'Where did most of my money go this month?',
      }),
    ).toHaveAttribute('aria-current', 'page');
  });

  it('asks follow-up questions in the same chat with Enter', async () => {
    const user = userEvent.setup();
    installFakeApi();
    const db = fakeChat();
    renderApp('/assistant');

    const box = await screen.findByLabelText('Ask about your money');
    await user.type(box, 'How much did I spend?{Enter}');
    await screen.findAllByText('₹15,700');
    await user.type(box, 'And on food?{Enter}');

    await waitFor(() => expect(db.asked).toEqual(['How much did I spend?', 'And on food?']));
    expect(db.sessions).toHaveLength(1);
    await waitFor(() => expect(screen.getAllByText('₹15,700')).toHaveLength(2));
  });

  it('shows errors from the stream', async () => {
    const user = userEvent.setup();
    installFakeApi();
    fakeChat({
      reply: () =>
        sse([['error', { code: 'AI_UNAVAILABLE', message: 'AI is not available right now.' }]]),
    });
    renderApp('/assistant');

    await user.type(await screen.findByLabelText('Ask about your money'), 'Hi{Enter}');
    expect(await screen.findByRole('alert')).toHaveTextContent('AI is not available right now.');
  });

  it('explains when AI is off, with the way to turn it on', async () => {
    installFakeApi();
    fakeChat();
    server.use(
      http.get('*/api/ai/status', () =>
        ok({ enabled: false, configured: true, provider: 'gemini' }),
      ),
    );
    renderApp('/assistant');

    expect(
      await screen.findByText(/The assistant uses AI, which is turned off/),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Turn it on in Settings.' })).toHaveAttribute(
      'href',
      '/settings',
    );
    expect(screen.getByLabelText('Ask about your money')).toBeDisabled();
  });

  it('deletes a chat', async () => {
    const user = userEvent.setup();
    installFakeApi();
    const db = fakeChat();
    db.sessions.push({ id: 'old', title: 'Rent question' });
    renderApp('/assistant?chat=old');

    await user.click(await screen.findByRole('button', { name: 'Delete chat "Rent question"' }));
    const dialog = await screen.findByRole('dialog', { name: 'Delete "Rent question"?' });
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));

    await findToast('Chat deleted');
    expect(await screen.findByText('Ask me anything about your money')).toBeInTheDocument();
  });
});
