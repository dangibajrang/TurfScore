import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Mail } from 'lucide-react';
import { useState } from 'react';
import { Input } from '@/components/ui/Input';
import { AuthShell } from './components/AuthShell';
import { useForgotPasswordMutation } from './hooks';
import { forgotPasswordSchema, type ForgotPasswordFormValues } from './schemas';

export function ForgotPasswordPage() {
  const forgot = useForgotPasswordMutation();
  const [devResetUrl, setDevResetUrl] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  return (
    <AuthShell
      active="forgot"
      title="Forgot password"
      subtitle="Enter your account email and we’ll send a reset link."
    >
      {submitted ? (
        <div className="space-y-4">
          <p className="text-sm text-[var(--ts-ink-soft)]">
            If an account exists for that email, a password reset link has been sent.
          </p>
          {devResetUrl ? (
            <div className="rounded-xl border border-[var(--ts-leaf)]/30 bg-[var(--ts-leaf)]/10 p-3 text-sm">
              <p className="font-semibold text-[var(--ts-leaf)]">Development reset link</p>
              <a
                href={devResetUrl}
                className="mt-2 block break-all text-xs text-[var(--ts-ink)] underline-offset-2 hover:underline"
              >
                {devResetUrl}
              </a>
            </div>
          ) : null}
          <Link to="/login" className="ts-auth-btn">
            Back to login
          </Link>
        </div>
      ) : (
        <form
          className="space-y-3.5"
          onSubmit={handleSubmit((values) => {
            forgot.mutate(values, {
              onSuccess: (data) => {
                setDevResetUrl(data.devResetUrl ?? null);
                setSubmitted(true);
              },
            });
          })}
          noValidate
        >
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            error={errors.email?.message}
            leadingIcon={<Mail className="h-4 w-4" aria-hidden />}
            className="ts-auth-field pl-10"
            {...register('email')}
          />
          <button type="submit" className="ts-auth-btn" disabled={forgot.isPending}>
            {forgot.isPending ? 'Sending…' : 'Send reset link'}
          </button>
        </form>
      )}
    </AuthShell>
  );
}
