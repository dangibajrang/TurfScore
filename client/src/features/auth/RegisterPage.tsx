import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Lock, Mail, User, Users } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { AuthShell } from './components/AuthShell';
import { PasswordInput } from './components/PasswordInput';
import { useRegisterMutation, useContinueAsGuest } from './hooks';
import { registerSchema, type RegisterFormValues } from './schemas';

const fieldClass = 'ts-auth-field pl-10';

export function RegisterPage() {
  const registerMutation = useRegisterMutation();
  const continueAsGuest = useContinueAsGuest();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', email: '', password: '', confirmPassword: '' },
  });

  return (
    <AuthShell active="register">
      <form
        className="ts-auth-stack"
        onSubmit={handleSubmit((values) => registerMutation.mutate(values))}
        noValidate
      >
        <Input
          label="Name"
          autoComplete="name"
          placeholder="Your name"
          error={errors.name?.message}
          leadingIcon={<User className="h-4 w-4" aria-hidden />}
          className={fieldClass}
          {...register('name')}
        />
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          error={errors.email?.message}
          leadingIcon={<Mail className="h-4 w-4" aria-hidden />}
          className={fieldClass}
          {...register('email')}
        />
        <PasswordInput
          label="Password"
          autoComplete="new-password"
          placeholder="At least 8 characters"
          error={errors.password?.message}
          leadingIcon={<Lock className="h-4 w-4" aria-hidden />}
          className={`${fieldClass} pr-11`}
          {...register('password')}
        />
        <PasswordInput
          label="Confirm password"
          autoComplete="new-password"
          placeholder="Repeat password"
          error={errors.confirmPassword?.message}
          leadingIcon={<Lock className="h-4 w-4" aria-hidden />}
          className={`${fieldClass} pr-11`}
          {...register('confirmPassword')}
        />

        <button
          type="submit"
          className="ts-auth-btn"
          disabled={registerMutation.isPending}
        >
          {registerMutation.isPending ? 'Creating account…' : 'Register'}
        </button>
      </form>

      <div className="ts-auth-divider">or</div>

      <button type="button" className="ts-auth-btn-ghost" onClick={continueAsGuest}>
        <Users aria-hidden />
        Continue as Guest
      </button>
    </AuthShell>
  );
}
