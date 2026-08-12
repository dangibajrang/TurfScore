import { create } from 'zustand';
import type { AuthUser } from './types';

type AuthStatus = 'unknown' | 'authenticated' | 'guest' | 'anonymous';

type AuthState = {
  status: AuthStatus;
  user: AuthUser | null;
  setAuthenticated: (user: AuthUser) => void;
  setGuest: () => void;
  setAnonymous: () => void;
  clear: () => void;
};

const GUEST_KEY = 'turfscore-guest';

export const useAuthStore = create<AuthState>((set) => ({
  status: 'unknown',
  user: null,
  setAuthenticated: (user) => {
    sessionStorage.removeItem(GUEST_KEY);
    set({ status: 'authenticated', user });
  },
  setGuest: () => {
    sessionStorage.setItem(GUEST_KEY, '1');
    set({ status: 'guest', user: null });
  },
  setAnonymous: () => {
    sessionStorage.removeItem(GUEST_KEY);
    set({ status: 'anonymous', user: null });
  },
  clear: () => {
    sessionStorage.removeItem(GUEST_KEY);
    set({ status: 'anonymous', user: null });
  },
}));

export function isGuestSession(): boolean {
  return sessionStorage.getItem(GUEST_KEY) === '1';
}

export function requireAccountMessage(): string {
  return 'Create an account to save your matches and sync your scores.';
}
