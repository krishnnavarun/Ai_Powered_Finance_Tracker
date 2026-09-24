import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as walletsApi from '@/api/wallets';

export const walletKeys = {
  all: ['wallets'],
  list: (includeArchived) => ['wallets', { includeArchived }],
};

export function useWallets({ includeArchived = false } = {}) {
  return useQuery({
    queryKey: walletKeys.list(includeArchived),
    queryFn: () => walletsApi.listWallets({ includeArchived }),
  });
}

// Every wallet (including archived) by id — for showing names next to old transactions.
export function useWalletLookup() {
  const { data = [] } = useWallets({ includeArchived: true });
  return new Map(data.map((wallet) => [wallet.id, wallet]));
}

export function useWalletMutations() {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: walletKeys.all });

  return {
    create: useMutation({ mutationFn: walletsApi.createWallet, onSuccess: refresh }),
    update: useMutation({
      mutationFn: ({ id, changes }) => walletsApi.updateWallet(id, changes),
      onSuccess: refresh,
    }),
    remove: useMutation({ mutationFn: walletsApi.deleteWallet, onSuccess: refresh }),
    transfer: useMutation({
      mutationFn: walletsApi.transfer,
      onSuccess: () => {
        refresh();
        // A transfer is also a transaction.
        queryClient.invalidateQueries({ queryKey: ['transactions'] });
      },
    }),
  };
}
