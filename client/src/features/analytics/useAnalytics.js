import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as analyticsApi from '@/api/analytics';

// Under one key, so a new or changed transaction refreshes them all.
export const analyticsKeys = {
  all: ['analytics'],
  forecast: ['analytics', 'forecast'],
  health: ['analytics', 'health'],
  subscriptions: ['analytics', 'subscriptions'],
  budgetSuggestions: ['analytics', 'budget-suggestions'],
  whatIf: (changes) => ['analytics', 'what-if', changes],
};

export function useForecast() {
  return useQuery({ queryKey: analyticsKeys.forecast, queryFn: analyticsApi.forecast });
}

export function useHealthScore() {
  return useQuery({ queryKey: analyticsKeys.health, queryFn: analyticsApi.healthScore });
}

export function useSubscriptions() {
  return useQuery({ queryKey: analyticsKeys.subscriptions, queryFn: analyticsApi.subscriptions });
}

export function useBudgetSuggestions({ enabled }) {
  return useQuery({
    queryKey: analyticsKeys.budgetSuggestions,
    queryFn: analyticsApi.budgetSuggestions,
    enabled,
  });
}

// Recomputed as the slider moves; the last answer stays on screen meanwhile.
export function useWhatIf(changes) {
  return useQuery({
    queryKey: analyticsKeys.whatIf(changes),
    queryFn: () => analyticsApi.whatIf(changes),
    enabled: changes.length > 0,
    placeholderData: keepPreviousData,
  });
}

export function useSubscriptionStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }) => analyticsApi.setSubscriptionStatus(id, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: analyticsKeys.subscriptions }),
  });
}
