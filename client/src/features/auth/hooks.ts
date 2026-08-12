import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ApiError } from '@/lib/apiClient';
import { setAccessToken } from '@/lib/apiClient';
import { useUiStore } from '@/stores/uiStore';
import { authApi } from './authApi';
import { useAuthStore } from './authStore';
import type { LoginFormValues, RegisterFormValues } from './schemas';

export function useLoginMutation() {
  const setAuthenticated = useAuthStore((s) => s.setAuthenticated);
  const showToast = useUiStore((s) => s.showToast);
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (values: LoginFormValues) => authApi.login(values),
    onSuccess: (data) => {
      setAccessToken(data.accessToken);
      setAuthenticated(data.user);
      showToast('Signed in successfully');
      navigate('/dashboard', { replace: true });
    },
    onError: (err: unknown) => {
      const message =
        err instanceof ApiError ? err.message : 'Unable to sign in. Check your connection.';
      showToast(message);
    },
  });
}

export function useRegisterMutation() {
  const setAuthenticated = useAuthStore((s) => s.setAuthenticated);
  const showToast = useUiStore((s) => s.showToast);
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (values: RegisterFormValues) =>
      authApi.register({
        name: values.name,
        email: values.email,
        password: values.password,
      }),
    onSuccess: (data) => {
      setAccessToken(data.accessToken);
      setAuthenticated(data.user);
      showToast('Account created');
      navigate('/dashboard', { replace: true });
    },
    onError: (err: unknown) => {
      const message =
        err instanceof ApiError ? err.message : 'Unable to create account. Check your connection.';
      showToast(message);
    },
  });
}

export function useLogoutMutation() {
  const clear = useAuthStore((s) => s.clear);
  const showToast = useUiStore((s) => s.showToast);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => authApi.logout(),
    onSettled: () => {
      setAccessToken(null);
      clear();
      queryClient.clear();
      showToast('Signed out');
      navigate('/login', { replace: true });
    },
  });
}

export function useContinueAsGuest() {
  const setGuest = useAuthStore((s) => s.setGuest);
  const navigate = useNavigate();
  const showToast = useUiStore((s) => s.showToast);

  return () => {
    setAccessToken(null);
    setGuest();
    showToast('Exploring as guest — create an account to save data');
    navigate('/dashboard', { replace: true });
  };
}

export function useForgotPasswordMutation() {
  const showToast = useUiStore((s) => s.showToast);

  return useMutation({
    mutationFn: (values: { email: string }) => authApi.forgotPassword(values),
    onError: (err: unknown) => {
      const message =
        err instanceof ApiError ? err.message : 'Unable to start password reset.';
      showToast(message);
    },
  });
}

export function useResetPasswordMutation() {
  const showToast = useUiStore((s) => s.showToast);
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (values: { token: string; password: string }) => authApi.resetPassword(values),
    onSuccess: (data) => {
      showToast(data.message);
      navigate('/login', { replace: true });
    },
    onError: (err: unknown) => {
      const message =
        err instanceof ApiError ? err.message : 'Unable to reset password. Try again.';
      showToast(message);
    },
  });
}

export function useChangePasswordMutation() {
  const showToast = useUiStore((s) => s.showToast);

  return useMutation({
    mutationFn: (values: { currentPassword: string; newPassword: string }) =>
      authApi.changePassword(values),
    onSuccess: (data) => {
      showToast(data.message);
    },
    onError: (err: unknown) => {
      const message =
        err instanceof ApiError ? err.message : 'Unable to change password.';
      showToast(message);
    },
  });
}
