import { LLMRequestError } from '../errors.js';
import { postJSON } from './http.js';

// Ollama runs models on your own machine, so no data leaves it. Local models are slower,
// so each call gets at least 60 s.
export function createOllamaProvider({ baseUrl, models, timeoutMs, retryDelaysMs, fetchImpl }) {
  return {
    name: 'ollama',
    models,

    async complete({ system, user, image, json = false, tier = 'fast' }) {
      const model = models[tier];
      const reply = await postJSON(`${baseUrl.replace(/\/$/, '')}/api/chat`, {
        body: {
          model,
          stream: false,
          options: { temperature: 0.1 },
          ...(json ? { format: 'json' } : {}),
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user, ...(image ? { images: [image.base64] } : {}) },
          ],
        },
        timeoutMs: Math.max(timeoutMs, 60_000),
        retryDelaysMs,
        fetchImpl,
      });

      const text = reply.message?.content;
      if (typeof text !== 'string') throw new LLMRequestError('Ollama returned no answer');
      return {
        text,
        model,
        usage: { inputTokens: reply.prompt_eval_count ?? 0, outputTokens: reply.eval_count ?? 0 },
      };
    },

    // Chat with tools. Local models answer in one piece (no streaming), which keeps this simple.
    async *chat({ system, messages, tools = [], tier = 'smart' }) {
      const model = models[tier];
      const reply = await postJSON(`${baseUrl.replace(/\/$/, '')}/api/chat`, {
        body: {
          model,
          stream: false,
          options: { temperature: 0.3 },
          messages: [
            { role: 'system', content: system },
            ...messages.map((m) =>
              m.role === 'assistant'
                ? {
                    role: 'assistant',
                    content: m.content ?? '',
                    tool_calls: (m.toolCalls ?? []).map((call) => ({
                      function: { name: call.name, arguments: call.args },
                    })),
                  }
                : m.role === 'tool'
                  ? { role: 'tool', content: m.content, tool_name: m.name }
                  : { role: 'user', content: m.content },
            ),
          ],
          ...(tools.length
            ? {
                tools: tools.map(({ name, description, parameters }) => ({
                  type: 'function',
                  function: { name, description, parameters },
                })),
              }
            : {}),
        },
        timeoutMs: Math.max(timeoutMs, 120_000),
        retryDelaysMs,
        fetchImpl,
      });
      if (reply.message?.content) yield { type: 'text', text: reply.message.content };
      for (const [i, call] of (reply.message?.tool_calls ?? []).entries()) {
        yield {
          type: 'tool_call',
          id: `call_${i + 1}`,
          name: call.function?.name,
          args: call.function?.arguments ?? {},
        };
      }
      yield {
        type: 'usage',
        model,
        inputTokens: reply.prompt_eval_count ?? 0,
        outputTokens: reply.eval_count ?? 0,
      };
    },
  };
}
