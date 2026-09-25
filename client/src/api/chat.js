import { ApiError } from '@/lib/apiError';
import { API_URL } from '@/lib/config';
import { useAuthStore } from '@/store/auth';
import { api, refreshSession } from './client';

export async function listSessions() {
  const res = await api.get('/chat/sessions');
  return res.data.data.sessions;
}

export async function createSession() {
  const res = await api.post('/chat/sessions', {});
  return res.data.data.session;
}

export async function getSession(id) {
  const res = await api.get(`/chat/sessions/${id}`);
  return res.data.data; // { session, messages }
}

export async function deleteSession(id) {
  await api.delete(`/chat/sessions/${id}`);
}

function post(url, body, signal) {
  const token = useAuthStore.getState().accessToken;
  return fetch(new URL(`${API_URL}${url}`, window.location.origin), {
    method: 'POST',
    credentials: 'include',
    headers: {
      'content-type': 'application/json',
      accept: 'text/event-stream',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
    signal,
  });
}

async function errorFrom(res) {
  try {
    const body = await res.json();
    return new ApiError({ status: res.status, ...body.error });
  } catch {
    return new ApiError({ status: res.status });
  }
}

// Sends a question and calls onEvent(type, data) for each server-sent event as the
// answer arrives: 'tool', 'chart', 'text', then 'done' (or 'error'). Axios can't read a
// response while it streams, so this uses fetch (with the same token + one refresh).
export async function sendMessage(sessionId, content, { onEvent, signal } = {}) {
  const url = `/chat/sessions/${sessionId}/messages`;
  let res;
  try {
    res = await post(url, { content }, signal);
    if (res.status === 401) {
      await refreshSession();
      res = await post(url, { content }, signal);
    }
  } catch (error) {
    if (error instanceof ApiError || error?.name === 'AbortError') throw error;
    throw new ApiError({
      code: 'NETWORK_ERROR',
      message: "Can't reach the server. Check your internet connection.",
    });
  }
  if (!res.ok) throw await errorFrom(res);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let end = buffer.indexOf('\n\n');
    while (end !== -1) {
      const block = buffer.slice(0, end);
      buffer = buffer.slice(end + 2);
      const type = /^event: (.*)$/m.exec(block)?.[1];
      const data = /^data: (.*)$/m.exec(block)?.[1];
      if (type && data) onEvent?.(type, JSON.parse(data));
      end = buffer.indexOf('\n\n');
    }
  }
}
