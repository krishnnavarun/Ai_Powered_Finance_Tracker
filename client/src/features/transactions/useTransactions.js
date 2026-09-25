import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as transactionsApi from '@/api/transactions';
import { walletKeys } from '@/features/wallets/useWallets';

export const transactionKeys = {
  all: ['transactions'],
  list: (filters) => ['transactions', filters],
  receipt: (id) => ['receipt', id],
};

export function useTransactions(filters) {
  return useQuery({
    queryKey: transactionKeys.list(filters),
    queryFn: () => transactionsApi.listTransactions(filters),
    // Keep showing the current page while the next one loads (no flicker).
    placeholderData: keepPreviousData,
  });
}

// Any change to transactions also changes wallet balances on the server.
export function useTransactionMutations() {
  const queryClient = useQueryClient();
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: transactionKeys.all });
    queryClient.invalidateQueries({ queryKey: walletKeys.all });
    // Spending also moves budgets, reports and the forecast / health score.
    queryClient.invalidateQueries({ queryKey: ['budgets'] });
    queryClient.invalidateQueries({ queryKey: ['reports'] });
    queryClient.invalidateQueries({ queryKey: ['analytics'] });
  };
  const refreshReceipt = (txn) => {
    queryClient.invalidateQueries({ queryKey: transactionKeys.all });
    queryClient.removeQueries({ queryKey: transactionKeys.receipt(txn.id) });
  };

  return {
    create: useMutation({ mutationFn: transactionsApi.createTransaction, onSuccess: refresh }),
    update: useMutation({
      mutationFn: ({ id, changes }) => transactionsApi.updateTransaction(id, changes),
      onSuccess: refresh,
    }),
    remove: useMutation({ mutationFn: transactionsApi.deleteTransaction, onSuccess: refresh }),
    bulk: useMutation({ mutationFn: transactionsApi.bulkTransactions, onSuccess: refresh }),
    uploadReceipt: useMutation({
      mutationFn: ({ id, file }) => transactionsApi.uploadReceipt(id, file),
      onSuccess: refreshReceipt,
    }),
    removeReceipt: useMutation({
      mutationFn: transactionsApi.removeReceipt,
      onSuccess: refreshReceipt,
    }),
  };
}
