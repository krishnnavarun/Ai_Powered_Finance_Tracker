import { useMutation, useQuery } from '@tanstack/react-query';
import * as aiApi from '@/api/ai';

export function useAiStatus() {
  return useQuery({ queryKey: ['ai-status'], queryFn: aiApi.aiStatus, staleTime: 5 * 60_000 });
}

export function useParseText() {
  return useMutation({ mutationFn: aiApi.parseText });
}

export function useParseSms() {
  return useMutation({ mutationFn: aiApi.parseSms });
}
