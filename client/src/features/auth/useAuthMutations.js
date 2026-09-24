import { useMutation } from '@tanstack/react-query';
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
