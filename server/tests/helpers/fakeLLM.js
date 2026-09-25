import { afterEach } from 'vitest';
import { resetLLMProvider, setLLMProvider } from '../../src/ai/llm/adapter.js';

// A pretend AI provider for tests. Give it the replies to send, in order:
//   const llm = useFakeLLM({ amount: 25000 }, '```json {"a":1}```', new LLMRequestError('x'));
// Objects are sent as JSON text, strings as they are, errors are thrown, and functions
// are called with the request. The last reply repeats. `llm.calls` records every request.
export function useFakeLLM(...replies) {
  const calls = [];
  const provider = {
    name: 'fake',
    models: { fast: 'fake-fast', smart: 'fake-smart' },
    calls,
    async complete(request) {
      calls.push(request);
      let reply = replies[Math.min(calls.length - 1, replies.length - 1)];
      if (typeof reply === 'function') reply = await reply(request);
      if (reply instanceof Error) throw reply;
      return {
        text: typeof reply === 'string' ? reply : JSON.stringify(reply),
        model: `fake-${request.tier ?? 'fast'}`,
        usage: { inputTokens: 10, outputTokens: 5 },
      };
    },
  };
  setLLMProvider(provider);
  return provider;
}

// "AI is not set up on this server."
export function useNoLLM() {
  setLLMProvider(null);
}

// Call once at the top of a test file that uses the helpers above.
export function resetLLMAfterEach() {
  afterEach(resetLLMProvider);
}

// A pretend chat model. Each turn is what the model "says" when called:
//   { text: 'Hello' }                             — an answer (streamed in 2 pieces)
//   { toolCalls: [{ name: 'getSpending', args }] } — asks for tools
//   an Error to throw, or a function (request) → one of the above
// The last turn repeats. `provider.chatCalls` records every request.
export function useFakeChat(...turns) {
  const chatCalls = [];
  const provider = {
    name: 'fake',
    models: { fast: 'fake-fast', smart: 'fake-smart' },
    chatCalls,
    async complete() {
      throw new Error('complete() is not used in chat tests');
    },
    async *chat(request) {
      chatCalls.push(structuredClone(request));
      let turn = turns[Math.min(chatCalls.length - 1, turns.length - 1)];
      if (typeof turn === 'function') turn = turn(request);
      if (turn instanceof Error) throw turn;
      if (turn.text) {
        const middle = Math.ceil(turn.text.length / 2);
        yield { type: 'text', text: turn.text.slice(0, middle) };
        yield { type: 'text', text: turn.text.slice(middle) };
      }
      for (const [i, call] of (turn.toolCalls ?? []).entries()) {
        yield { type: 'tool_call', id: `call_${chatCalls.length}_${i}`, ...call };
      }
      yield { type: 'usage', model: 'fake-smart', inputTokens: 100, outputTokens: 20 };
    },
  };
  setLLMProvider(provider);
  return provider;
}
