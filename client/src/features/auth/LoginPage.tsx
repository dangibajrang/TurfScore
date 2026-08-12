import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Lock, Mail, User, Users } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { AuthShell } from './components/AuthShell';
import { PasswordInput } from './components/PasswordInput';
import { useLoginMutation, useContinueAsGuest } from './hooks';
import { loginSchema, type LoginFormValues } from './schemas';

const fieldClass = 'ts-auth-field pl-10';

export function LoginPage() {
  const login = useLoginMutation();
  const continueAsGuest = useContinueAsGuest();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  return (
    <AuthShell active="login">
      <form
        className="ts-auth-stack"
        onSubmit={handleSubmit((values) => login.mutate(values))}
        noValidate
      >
        <Input
          label="Email / Username"
          type="email"
          autoComplete="email"
          placeholder="Email / Username"
          error={errors.email?.message}
          leadingIcon={<Mail className="h-4 w-4" aria-hidden />}
          className={fieldClass}
          {...register('email')}
        />
        <PasswordInput
          label="Password"
          autoComplete="current-password"
          placeholder="Password"
          error={errors.password?.message}
          leadingIcon={<Lock className="h-4 w-4" aria-hidden />}
          className={`${fieldClass} pr-11`}
          {...register('password')}
        />

        <div className="ts-auth-meta">
          <Link to="/forgot-password" className="ts-auth-link text-[13px]">
            Forgot password?
          </Link>
        </div>

        <button type="submit" className="ts-auth-btn" disabled={login.isPending}>
          {login.isPending ? 'Signing in…' : 'Login'}
        </button>
      </form>

      <div className="ts-auth-divider">or</div>

      <div className="ts-auth-stack">
        <Link to="/register" className="ts-auth-btn-ghost">
          <User aria-hidden />
          Register
        </Link>
        <button type="button" className="ts-auth-btn-ghost" onClick={continueAsGuest}>
          <Users aria-hidden />
          Continue as Guest
        </button>
      </div>
    </AuthShell>
  );
}
