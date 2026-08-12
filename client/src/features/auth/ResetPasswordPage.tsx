import { Link, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Lock } from 'lucide-react';
import { AuthShell } from './components/AuthShell';
import { PasswordInput } from './components/PasswordInput';
import { useResetPasswordMutation } from './hooks';
import { resetPasswordSchema, type ResetPasswordFormValues } from './schemas';

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token')?.trim() ?? '';
  const reset = useResetPasswordMutation();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  if (!token) {
    return (
      <AuthShell
        active="reset"
        title="Invalid reset link"
        subtitle="This password reset link is missing or incomplete."
      >
        <Link to="/forgot-password" className="ts-auth-btn">
          Request a new link
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      active="reset"
      title="Reset password"
      subtitle="Choose a new password for your TurfScore account."
    >
      <form
        className="space-y-3.5"
        onSubmit={handleSubmit((values) =>
          reset.mutate({ token, password: values.password }),
        )}
        noValidate
      >
        <PasswordInput
          label="New password"
          autoComplete="new-password"
          placeholder="At least 8 characters"
          error={errors.password?.message}
          leadingIcon={<Lock className="h-4 w-4" aria-hidden />}
          className="ts-auth-field pl-10 pr-11"
          {...register('password')}
        />
        <PasswordInput
          label="Confirm password"
          autoComplete="new-password"
          placeholder="Repeat password"
          error={errors.confirmPassword?.message}
          leadingIcon={<Lock className="h-4 w-4" aria-hidden />}
          className="ts-auth-field pl-10 pr-11"
          {...register('confirmPassword')}
        />
        <button type="submit" className="ts-auth-btn" disabled={reset.isPending}>
          {reset.isPending ? 'Updating…' : 'Update password'}
        </button>
      </form>
    </AuthShell>
  );
}
