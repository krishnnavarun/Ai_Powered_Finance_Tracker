import { zodResolver } from '@hookform/resolvers/zod';
import { LoaderCircle } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';
import { FormAlert } from '@/components/common/FormAlert';
import { FormField } from '@/components/common/FormField';
import { PasswordInput } from '@/components/common/PasswordInput';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { loginSchema } from '@/features/auth/schemas';
import { useLogin } from '@/features/auth/useAuthMutations';
import { useAuthStore } from '@/store/auth';

export function LoginPage() {
  const form = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });
  const login = useLogin();
  const sessionExpired = useAuthStore((state) => state.endReason === 'expired');
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((values) => login.mutate(values));

  return (
    <>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
        <p className="mt-1 text-sm text-muted-foreground">Log in to see where your money went.</p>
      </div>

      <form onSubmit={onSubmit} noValidate className="grid gap-4">
        <FormAlert>{login.error?.message}</FormAlert>
        {sessionExpired && !login.error && (
          <FormAlert tone="info">Your session expired. Please log in again.</FormAlert>
        )}

        <FormField label="Email" error={errors.email}>
          {(field) => (
            <Input
              {...field}
              type="email"
              autoComplete="email"
              inputMode="email"
              placeholder="you@example.com"
              {...form.register('email')}
            />
          )}
        </FormField>

        <FormField label="Password" error={errors.password}>
          {(field) => (
            <PasswordInput
              {...field}
              autoComplete="current-password"
              {...form.register('password')}
            />
          )}
        </FormField>

        <Button type="submit" className="mt-2 w-full" disabled={login.isPending}>
          {login.isPending && <LoaderCircle className="animate-spin" aria-hidden="true" />}
          {login.isPending ? 'Logging in…' : 'Log in'}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        New to Paisa Pal?{' '}
        <Link
          to="/register"
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Create an account
        </Link>
      </p>
    </>
  );
}
