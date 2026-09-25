import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef, useState } from 'react';
import * as chatApi from '@/api/chat';

export const chatKeys = {
  sessions: ['chat', 'sessions'],
  session: (id) => ['chat', 'session', id],
};

export function useChatSessions() {
  return useQuery({ queryKey: chatKeys.sessions, queryFn: chatApi.listSessions });
}

export function useChatSession(id) {
  return useQuery({
    queryKey: chatKeys.session(id),
    queryFn: () => chatApi.getSession(id),
    enabled: Boolean(id),
  });
}

export function useDeleteChat() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: chatApi.deleteSession,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: chatKeys.sessions }),
  });
}

const TOOL_LABELS = {
  getSpending: 'Looking at your spending',
  getIncome: 'Looking at your income',
  compareSpending: 'Comparing the two periods',
  getTopMerchants: 'Finding where you spend most',
  getBudgetStatus: 'Checking your budgets',
  getGoals: 'Checking your goals',
  getForecast: 'Working out your month-end balance',
  getSubscriptions: 'Checking your subscriptions',
  getHealthScore: 'Checking your money health',
  searchTransactions: 'Searching your payments',
  simulateWhatIf: 'Trying out the change',
  getBalances: 'Checking your wallets',
};
export const toolLabel = (name) => TOOL_LABELS[name] ?? 'Looking at your data';

// Sends a question and follows the answer as it streams in.
// pending = { question, text, steps: [tool names], chart } while an answer is on its way.
export function useAskAssistant() {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(null);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);

  const ask = useCallback(
    async (sessionId, question) => {
      setError(null);
      setPending({ sessionId, question, text: '', steps: [], chart: null });
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        await chatApi.sendMessage(sessionId, question, {
          signal: controller.signal,
          onEvent: (type, data) => {
            if (type === 'text') setPending((p) => p && { ...p, text: p.text + data.text });
            else if (type === 'tool')
              setPending((p) => p && { ...p, steps: [...p.steps, data.name] });
            else if (type === 'chart') setPending((p) => p && { ...p, chart: data.chart });
            else if (type === 'error') setError(data);
          },
        });
        await queryClient.invalidateQueries({ queryKey: chatKeys.session(sessionId) });
        queryClient.invalidateQueries({ queryKey: chatKeys.sessions });
      } catch (err) {
        if (err?.name !== 'AbortError') setError({ code: err.code, message: err.message });
        // The question itself was saved before the answer started, if the server got it.
        queryClient.invalidateQueries({ queryKey: chatKeys.session(sessionId) });
      } finally {
        setPending(null);
        abortRef.current = null;
      }
    },
    [queryClient],
  );

  const stop = useCallback(() => abortRef.current?.abort(), []);
  return { ask, pending, error, stop, clearError: () => setError(null) };
}
