import { LLMRequestError } from '../errors.js';
import { postJSON } from './http.js';
import { openStream, readSSE } from './stream.js';

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

// Google Gemini (default; has a free tier). Uses the REST API directly, so there is no
// SDK to keep up to date. The key goes in a header, never in the URL (URLs get logged).
export function createGeminiProvider({ apiKey, models, timeoutMs, retryDelaysMs, fetchImpl }) {
  return {
    name: 'gemini',
    models,

    // { system, user, image?: { mimeType, base64 }, json, tier } → { text, model, usage }
    async complete({ system, user, image, json = false, tier = 'fast' }) {
      const model = models[tier];
      const parts = [{ text: user }];
      if (image) parts.push({ inlineData: { mimeType: image.mimeType, data: image.base64 } });

      const reply = await postJSON(
        `${BASE_URL}/models/${encodeURIComponent(model)}:generateContent`,
        {
          headers: { 'x-goog-api-key': apiKey },
          body: {
            systemInstruction: { parts: [{ text: system }] },
            contents: [{ role: 'user', parts }],
            generationConfig: {
              temperature: 0.1,
              ...(json ? { responseMimeType: 'application/json' } : {}),
            },
          },
          timeoutMs,
          retryDelaysMs,
          fetchImpl,
        },
      );

      const candidate = reply.candidates?.[0];
      if (!candidate?.content) {
        const reason = reply.promptFeedback?.blockReason ?? candidate?.finishReason ?? 'EMPTY';
        throw new LLMRequestError(`Gemini returned no answer (${reason})`);
      }
      return {
        text: candidate.content.parts.map((part) => part.text ?? '').join(''),
        model,
        usage: {
          inputTokens: reply.usageMetadata?.promptTokenCount ?? 0,
          outputTokens: reply.usageMetadata?.candidatesTokenCount ?? 0,
        },
      };
    },

    // Chat with tools, streamed. messages: [{ role: 'user'|'assistant'|'tool', content,
    // toolCalls?, toolCallId?, name? }] → yields { type: 'text', text } |
    // { type: 'tool_call', id, name, args } | { type: 'usage', inputTokens, outputTokens }
    async *chat({ system, messages, tools = [], tier = 'smart' }) {
      const model = models[tier];
      const res = await openStream(
        `${BASE_URL}/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`,
        {
          headers: { 'x-goog-api-key': apiKey },
          body: {
            systemInstruction: { parts: [{ text: system }] },
            contents: toGeminiContents(messages),
            ...(tools.length
              ? {
                  tools: [
                    {
                      functionDeclarations: tools.map(({ name, description, parameters }) => ({
                        name,
                        description,
                        parameters,
                      })),
                    },
                  ],
                }
              : {}),
            generationConfig: { temperature: 0.3 },
          },
          timeoutMs: Math.max(timeoutMs, 60_000),
          retryDelaysMs,
          fetchImpl,
        },
      );
      let usage = null;
      let calls = 0;
      for await (const chunk of readSSE(res)) {
        for (const part of chunk.candidates?.[0]?.content?.parts ?? []) {
          if (part.text) yield { type: 'text', text: part.text };
          if (part.functionCall) {
            calls += 1;
            yield {
              type: 'tool_call',
              id: `call_${calls}`,
              name: part.functionCall.name,
              args: part.functionCall.args ?? {},
            };
          }
        }
        if (chunk.usageMetadata) usage = chunk.usageMetadata;
      }
      if (usage) {
        yield {
          type: 'usage',
          model,
          inputTokens: usage.promptTokenCount ?? 0,
          outputTokens: usage.candidatesTokenCount ?? 0,
        };
      }
    },
  };
}

// Our neutral chat history → Gemini "contents". Tool results that follow each other go
// back together in one turn, as Gemini expects.
function toGeminiContents(messages) {
  const contents = [];
  for (const message of messages) {
    if (message.role === 'user') {
      contents.push({ role: 'user', parts: [{ text: message.content }] });
    } else if (message.role === 'assistant') {
      const parts = [];
      if (message.content) parts.push({ text: message.content });
      for (const call of message.toolCalls ?? []) {
        parts.push({ functionCall: { name: call.name, args: call.args } });
      }
      if (parts.length) contents.push({ role: 'model', parts });
    } else if (message.role === 'tool') {
      const part = {
        functionResponse: { name: message.name, response: { result: JSON.parse(message.content) } },
      };
      const last = contents.at(-1);
      if (last?.role === 'user' && last.parts.every((p) => p.functionResponse))
        last.parts.push(part);
      else contents.push({ role: 'user', parts: [part] });
    }
  }
  return contents;
}
