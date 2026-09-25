import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as insightsApi from '@/api/insights';

export const insightKeys = { all: ['insights'] };

export function useInsights() {
  return useQuery({ queryKey: insightKeys.all, queryFn: () => insightsApi.listInsights() });
}

export function useInsightMutations() {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: insightKeys.all });
  return {
    refresh: useMutation({
      mutationFn: insightsApi.refreshInsights,
      onSuccess: (data) => queryClient.setQueryData(insightKeys.all, data),
    }),
    dismiss: useMutation({
      mutationFn: (id) => insightsApi.updateInsight(id, { dismissed: true }),
      onSuccess: refresh,
    }),
    // No refetch: the "New" marks stay while the page is open.
    markSeen: useMutation({ mutationFn: insightsApi.markInsightsSeen }),
  };
}
