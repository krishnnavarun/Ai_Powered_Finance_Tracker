import { keepPreviousData, useQuery } from '@tanstack/react-query';
import * as planningApi from '@/api/planning';

export const reportKeys = { all: ['reports'] };

// Spending per category (this budget month unless from/to are given).
export function useSpendingByCategory(params = {}) {
  return useQuery({
    queryKey: ['reports', 'by-category', params],
    queryFn: () => planningApi.spendingByCategory(params),
    placeholderData: keepPreviousData,
  });
}

// Money in / out / saved for the last N months, oldest first.
export function useMonthlyTrend(months = 6) {
  return useQuery({
    queryKey: ['reports', 'trend', months],
    queryFn: () => planningApi.monthlyTrend(months),
  });
}

// range: { from, to } (both local dates) — the reports for that period.
export function useReportSummary(range) {
  return useQuery({
    queryKey: ['reports', 'summary', range],
    queryFn: () => planningApi.reportSummary(range),
    placeholderData: keepPreviousData,
  });
}

export function useTopMerchants(range) {
  return useQuery({
    queryKey: ['reports', 'merchants', range],
    queryFn: () => planningApi.topMerchants({ ...range, limit: 10 }),
    placeholderData: keepPreviousData,
  });
}

export function useSpendingByWallet(range) {
  return useQuery({
    queryKey: ['reports', 'by-wallet', range],
    queryFn: () => planningApi.spendingByWallet(range),
    placeholderData: keepPreviousData,
  });
}
