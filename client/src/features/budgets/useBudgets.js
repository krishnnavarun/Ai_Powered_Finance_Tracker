import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as planningApi from '@/api/planning';

export const budgetKeys = {
  all: ['budgets'],
  status: (month) => ['budgets', 'status', month ?? 'current'],
};

// Every budget of a month with spent / left / status. month undefined = this month.
export function useBudgetStatus(month) {
  return useQuery({
    queryKey: budgetKeys.status(month),
    queryFn: () => planningApi.budgetStatus(month),
    placeholderData: keepPreviousData,
  });
}

export function useBudgetMutations() {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: budgetKeys.all });
  return {
    create: useMutation({ mutationFn: planningApi.createBudget, onSuccess: refresh }),
    update: useMutation({
      mutationFn: ({ id, changes }) => planningApi.updateBudget(id, changes),
      onSuccess: refresh,
    }),
    remove: useMutation({ mutationFn: planningApi.deleteBudget, onSuccess: refresh }),
  };
}
