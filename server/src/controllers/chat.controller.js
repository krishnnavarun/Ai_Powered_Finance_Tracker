import { logger } from '../config/logger.js';
import * as chatService from '../services/chat.service.js';
import { ApiError } from '../utils/ApiError.js';

const ok = (res, data, status = 200) => res.status(status).json({ success: true, data });

export const list = async (req, res) =>
  ok(res, { sessions: await chatService.listSessions(req.user.id) });

export const create = async (req, res) =>
  ok(res, { session: await chatService.createSession(req.user.id, req.body) }, 201);

export const get = async (req, res) =>
  ok(res, await chatService.getSession(req.user.id, req.params.id));

export async function remove(req, res) {
  await chatService.deleteSession(req.user.id, req.params.id);
  res.status(204).end();
}

// The answer arrives as server-sent events: "text", "tool", "chart", then "done" (or
// "error"). Problems found before the first byte (no AI, wrong chat) are normal JSON errors.
export async function sendMessage(req, res) {
  const prepared = await chatService.prepareMessage(req.user.id, req.params.id, req.body.content);

  res.status(200).set({
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no', // tell proxies not to hold the stream back
  });
  res.flushHeaders();
  let closed = false;
  res.on('close', () => {
    closed = true;
  });
  const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

  try {
    for await (const event of chatService.streamReply(prepared)) {
      if (closed) break;
      const { type, ...data } = event;
      send(type, data);
    }
  } catch (error) {
    const known = error instanceof ApiError;
    if (!known) logger.error({ err: error }, 'chat failed');
    send('error', {
      code: known ? error.code : 'INTERNAL_ERROR',
      message: known ? error.message : 'Something went wrong. Please try again.',
    });
  }
  res.end();
}
