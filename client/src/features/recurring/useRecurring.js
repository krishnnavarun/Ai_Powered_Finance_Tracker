import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as planningApi from '@/api/planning';

export const recurringKeys = { all: ['recurring'] };

export function useRecurring() {
  return useQuery({ queryKey: recurringKeys.all, queryFn: planningApi.listRecurring });
}

export function useRecurringMutations() {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: recurringKeys.all });
  return {
    create: useMutation({ mutationFn: planningApi.createRecurring, onSuccess: refresh }),
    update: useMutation({
      mutationFn: ({ id, changes }) => planningApi.updateRecurring(id, changes),
      onSuccess: refresh,
    }),
    remove: useMutation({ mutationFn: planningApi.deleteRecurring, onSuccess: refresh }),
  };
}
