import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Activity,
  KeyRound,
  Lock,
  Radio,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { Avatar, Badge, Button, Card } from '@/components/ui';
import { PasswordInput } from '@/features/auth/components/PasswordInput';
import { useAuthStore } from '@/features/auth/authStore';
import { useChangePasswordMutation, useLogoutMutation } from '@/features/auth/hooks';
import {
  changePasswordSchema,
  type ChangePasswordFormValues,
} from '@/features/auth/schemas';

const features = [
  { icon: ShieldCheck, label: 'Auth & accounts', detail: 'Login, register, password reset' },
  { icon: Users, label: 'Teams & players', detail: 'Rosters, XI, profiles' },
  { icon: Activity, label: 'Live scoring', detail: 'Ball-by-ball cricket engine' },
  { icon: Radio, label: 'Public live share', detail: 'Socket.IO viewer links + QR' },
] as const;

export function SettingsPage() {
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);
  const logout = useLogoutMutation();
  const changePassword = useChangePasswordMutation();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold">Application</h2>
            <p className="mt-1 text-sm text-text-muted">
              TurfScore live cricket scoring — auth, match management, scoring engine, and
              realtime public viewers.
            </p>
          </div>
          <Badge tone="primary">Phase 7</Badge>
        </div>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {features.map(({ icon: Icon, label, detail }) => (
            <li
              key={label}
              className="flex gap-3 rounded-control border border-border-subtle bg-surface-elevated/40 p-3"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary">
                <Icon className="h-4 w-4" aria-hidden />
              </span>
              <div>
                <p className="text-sm font-semibold">{label}</p>
                <p className="text-xs text-text-muted">{detail}</p>
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <h3 className="text-sm font-semibold text-text-muted">Theme</h3>
        <p className="mt-2 text-sm text-text">
          Dark sports-tech theme is the default and matches the TurfScore reference design.
        </p>
      </Card>

      <Card>
        <h3 className="text-sm font-semibold text-text-muted">Account</h3>
        {status === 'authenticated' && user ? (
          <div className="mt-3 space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Avatar name={user.name} src={user.profileImage} size="md" />
              <div className="min-w-0">
                <p className="font-semibold">{user.name}</p>
                <p className="truncate text-sm text-text-muted">{user.email}</p>
                <Badge tone={user.role === 'ADMIN' ? 'warning' : 'info'} className="mt-1">
                  {user.role}
                </Badge>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                to="/profile"
                className="inline-flex h-11 items-center rounded-control border border-border px-4 text-sm font-semibold"
              >
                View profile
              </Link>
              <Button
                variant="danger"
                disabled={logout.isPending}
                onClick={() => logout.mutate()}
              >
                {logout.isPending ? 'Signing out…' : 'Logout'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            <p className="text-sm text-text-muted">You are exploring as a guest.</p>
            <div className="flex flex-wrap gap-2">
              <Link
                to="/login"
                className="inline-flex h-11 items-center rounded-control bg-primary px-4 text-sm font-semibold text-background"
              >
                Sign in
              </Link>
              <Link
                to="/register"
                className="inline-flex h-11 items-center rounded-control border border-border px-4 text-sm font-semibold"
              >
                Create account
              </Link>
            </div>
          </div>
        )}
      </Card>

      {status === 'authenticated' ? (
        <Card>
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary">
              <KeyRound className="h-4 w-4" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold">Password & security</h3>
              <p className="mt-1 text-sm text-text-muted">
                Change your password here, or use email reset if you forgot it.
              </p>

              <form
                className="mt-4 space-y-3"
                onSubmit={handleSubmit((values) => {
                  changePassword.mutate(
                    {
                      currentPassword: values.currentPassword,
                      newPassword: values.newPassword,
                    },
                    { onSuccess: () => reset() },
                  );
                })}
                noValidate
              >
                <PasswordInput
                  label="Current password"
                  autoComplete="current-password"
                  error={errors.currentPassword?.message}
                  leadingIcon={<Lock className="h-4 w-4" aria-hidden />}
                  {...register('currentPassword')}
                />
                <PasswordInput
                  label="New password"
                  autoComplete="new-password"
                  error={errors.newPassword?.message}
                  leadingIcon={<Lock className="h-4 w-4" aria-hidden />}
                  {...register('newPassword')}
                />
                <PasswordInput
                  label="Confirm new password"
                  autoComplete="new-password"
                  error={errors.confirmPassword?.message}
                  leadingIcon={<Lock className="h-4 w-4" aria-hidden />}
                  {...register('confirmPassword')}
                />
                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <Button type="submit" disabled={changePassword.isPending}>
                    {changePassword.isPending ? 'Updating…' : 'Update password'}
                  </Button>
                  <Link
                    to="/forgot-password"
                    className="text-sm font-semibold text-primary hover:underline"
                  >
                    Forgot password instead?
                  </Link>
                </div>
              </form>
            </div>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
