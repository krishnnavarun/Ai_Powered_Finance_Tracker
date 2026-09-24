import { zodResolver } from '@hookform/resolvers/zod';
import { LoaderCircle } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';
import { FormAlert } from '@/components/common/FormAlert';
import { FormField } from '@/components/common/FormField';
import { PasswordInput } from '@/components/common/PasswordInput';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { registerSchema } from '@/features/auth/schemas';
import { applyServerErrors } from '@/features/auth/serverErrors';
import { useRegister } from '@/features/auth/useAuthMutations';

const FIELDS = ['name', 'email', 'password'];

export function RegisterPage() {
  const form = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', email: '', password: '' },
  });
  const register = useRegister();
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((values) =>
    register.mutate(values, {
      // Field problems (e.g. email already used) show under the field instead of the alert.
      onError: (error) => applyServerErrors(form, error, FIELDS),
    }),
  );

  const fieldErrorsFromServer =
    register.error?.code === 'EMAIL_TAKEN' || register.error?.code === 'VALIDATION_ERROR';

  return (
    <>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Create your account</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Free, private, and ready in under a minute.
        </p>
      </div>

      <form onSubmit={onSubmit} noValidate className="grid gap-4">
        <FormAlert>{fieldErrorsFromServer ? null : register.error?.message}</FormAlert>

        <FormField label="Name" error={errors.name}>
          {(field) => (
            <Input
              {...field}
              autoComplete="name"
              placeholder="Asha Rao"
              {...form.register('name')}
            />
          )}
        </FormField>

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

        <FormField
          label="Password"
          error={errors.password}
          hint="At least 8 characters, with a letter and a number."
        >
          {(field) => (
            <PasswordInput {...field} autoComplete="new-password" {...form.register('password')} />
          )}
        </FormField>

        <Button type="submit" className="mt-2 w-full" disabled={register.isPending}>
          {register.isPending && <LoaderCircle className="animate-spin" aria-hidden="true" />}
          {register.isPending ? 'Creating account…' : 'Create account'}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link to="/login" className="font-medium text-primary underline-offset-4 hover:underline">
          Log in
        </Link>
      </p>
    </>
  );
}
