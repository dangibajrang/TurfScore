import { apiRequest, setAccessToken, tryRefresh } from '@/lib/apiClient';
import type { AuthResponse, AuthUser } from './types';

export const authApi = {
  register(input: { name: string; email: string; password: string }) {
    return apiRequest<AuthResponse>('/api/auth/register', {
      method: 'POST',
      body: input,
    });
  },

  login(input: { email: string; password: string }) {
    return apiRequest<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: input,
    });
  },

  forgotPassword(input: { email: string }) {
    return apiRequest<{ message: string; devResetUrl?: string }>('/api/auth/forgot-password', {
      method: 'POST',
      body: input,
    });
  },

  resetPassword(input: { token: string; password: string }) {
    return apiRequest<{ message: string }>('/api/auth/reset-password', {
      method: 'POST',
      body: input,
    });
  },

  changePassword(input: { currentPassword: string; newPassword: string }) {
    return apiRequest<{ message: string }>('/api/auth/change-password', {
      method: 'POST',
      body: input,
      auth: true,
    });
  },

  logout() {
    return apiRequest<{ success: boolean }>('/api/auth/logout', {
      method: 'POST',
    });
  },

  me() {
    return apiRequest<AuthUser>('/api/auth/me', {
      method: 'GET',
      auth: true,
    });
  },

  updateProfile(input: {
    name?: string;
    phone?: string;
    profileImageUrl?: string | null;
  }) {
    return apiRequest<AuthUser>('/api/auth/me', {
      method: 'PATCH',
      body: input,
      auth: true,
    });
  },

  async restoreSession(): Promise<AuthUser | null> {
    const token = await tryRefresh();
    if (!token) {
      setAccessToken(null);
      return null;
    }
    try {
      return await authApi.me();
    } catch {
      setAccessToken(null);
      return null;
    }
  },
};
