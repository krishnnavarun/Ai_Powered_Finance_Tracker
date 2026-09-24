import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as authApi from '@/api/auth';
import { useAuthStore } from '@/store/auth';

// On success the session is stored; the GuestOnly route then moves the user into the app.

export function useLogin() {
  const setSession = useAuthStore((state) => state.setSession);
  return useMutation({ mutationFn: authApi.login, onSuccess: setSession });
}

export function useRegister() {
  const setSession = useAuthStore((state) => state.setSession);
  return useMutation({ mutationFn: authApi.register, onSuccess: setSession });
}

// Logs out on the server, then always clears everything locally — even if the server
// can't be reached, the user must end up logged out on this device.
export function useLogout() {
  const clearSession = useAuthStore((state) => state.clearSession);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: authApi.logout,
    onSettled: () => {
      clearSession('logout');
      // Cached data belongs to this user; the next person on this device must not see it.
      queryClient.clear();
    },
  });
}
