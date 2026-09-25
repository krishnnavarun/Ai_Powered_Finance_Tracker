import { LLMRequestError } from '../errors.js';
import { postJSON } from './http.js';
import { openStream, readSSE } from './stream.js';

export const OPENAI_BASE_URL = 'https://api.openai.com/v1';
export const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';

// OpenAI and Groq speak the same "chat completions" API; only the address, key and
// model names differ.
export function createOpenAICompatibleProvider({
  name,
  baseUrl,
  apiKey,
  models,
  timeoutMs,
  retryDelaysMs,
  fetchImpl,
}) {
  return {
    name,
    models,

    async complete({ system, user, image, json = false, tier = 'fast' }) {
      const model = models[tier];
      const content = image
        ? [
            { type: 'text', text: user },
            {
              type: 'image_url',
              image_url: { url: `data:${image.mimeType};base64,${image.base64}` },
            },
          ]
        : user;

      const reply = await postJSON(`${baseUrl}/chat/completions`, {
        headers: { authorization: `Bearer ${apiKey}` },
        body: {
          model,
          temperature: 0.1,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content },
          ],
          ...(json ? { response_format: { type: 'json_object' } } : {}),
        },
        timeoutMs,
        retryDelaysMs,
        fetchImpl,
      });

      const text = reply.choices?.[0]?.message?.content;
      if (typeof text !== 'string') throw new LLMRequestError(`${name} returned no answer`);
      return {
        text,
        model,
        usage: {
          inputTokens: reply.usage?.prompt_tokens ?? 0,
          outputTokens: reply.usage?.completion_tokens ?? 0,
        },
      };
    },

    // Chat with tools, streamed (see gemini.js for the shapes). Tool-call arguments
    // arrive in pieces and are put together before the call is passed on.
    async *chat({ system, messages, tools = [], tier = 'smart' }) {
      const model = models[tier];
      const res = await openStream(`${baseUrl}/chat/completions`, {
        headers: { authorization: `Bearer ${apiKey}` },
        body: {
          model,
          temperature: 0.3,
          stream: true,
          stream_options: { include_usage: true },
          messages: [{ role: 'system', content: system }, ...toOpenAIMessages(messages)],
          ...(tools.length
            ? {
                tools: tools.map(({ name: toolName, description, parameters }) => ({
                  type: 'function',
                  function: { name: toolName, description, parameters },
                })),
              }
            : {}),
        },
        timeoutMs: Math.max(timeoutMs, 60_000),
        retryDelaysMs,
        fetchImpl,
      });

      const pending = new Map(); // index → { id, name, arguments }
      for await (const chunk of readSSE(res)) {
        const delta = chunk.choices?.[0]?.delta;
        if (delta?.content) yield { type: 'text', text: delta.content };
        for (const call of delta?.tool_calls ?? []) {
          const entry = pending.get(call.index) ?? { id: null, name: '', arguments: '' };
          if (call.id) entry.id = call.id;
          if (call.function?.name) entry.name += call.function.name;
          if (call.function?.arguments) entry.arguments += call.function.arguments;
          pending.set(call.index, entry);
        }
        if (chunk.usage) {
          yield {
            type: 'usage',
            model,
            inputTokens: chunk.usage.prompt_tokens ?? 0,
            outputTokens: chunk.usage.completion_tokens ?? 0,
          };
        }
      }
      for (const [index, call] of pending) {
        let args;
        try {
          args = call.arguments ? JSON.parse(call.arguments) : {};
        } catch {
          args = {}; // unreadable arguments: the tool's own checks will reject them
        }
        yield { type: 'tool_call', id: call.id ?? `call_${index}`, name: call.name, args };
      }
    },
  };
}

function toOpenAIMessages(messages) {
  return messages.map((message) => {
    if (message.role === 'assistant') {
      return {
        role: 'assistant',
        content: message.content || null,
        ...(message.toolCalls?.length
          ? {
              tool_calls: message.toolCalls.map((call) => ({
                id: call.id,
                type: 'function',
                function: { name: call.name, arguments: JSON.stringify(call.args) },
              })),
            }
          : {}),
      };
    }
    if (message.role === 'tool') {
      return { role: 'tool', tool_call_id: message.toolCallId, content: message.content };
    }
    return { role: 'user', content: message.content };
  });
}
