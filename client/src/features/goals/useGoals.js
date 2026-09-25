import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as planningApi from '@/api/planning';

export const goalKeys = { all: ['goals'] };

export function useGoals() {
  return useQuery({ queryKey: goalKeys.all, queryFn: planningApi.listGoals });
}

export function useGoalMutations() {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: goalKeys.all });
  return {
    create: useMutation({ mutationFn: planningApi.createGoal, onSuccess: refresh }),
    update: useMutation({
      mutationFn: ({ id, changes }) => planningApi.updateGoal(id, changes),
      onSuccess: refresh,
    }),
    remove: useMutation({ mutationFn: planningApi.deleteGoal, onSuccess: refresh }),
    contribute: useMutation({
      mutationFn: ({ id, ...body }) => planningApi.contribute(id, body),
      onSuccess: refresh,
    }),
  };
}
