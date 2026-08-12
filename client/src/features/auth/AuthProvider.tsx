import { useEffect, useState, type ReactNode } from 'react';
import { setAccessToken } from '@/lib/apiClient';
import { authApi } from './authApi';
import { isGuestSession, useAuthStore } from './authStore';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [booting, setBooting] = useState(true);
  const setAuthenticated = useAuthStore((s) => s.setAuthenticated);
  const setGuest = useAuthStore((s) => s.setGuest);
  const setAnonymous = useAuthStore((s) => s.setAnonymous);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      try {
        if (isGuestSession()) {
          if (!cancelled) {
            setGuest();
            setBooting(false);
          }
          return;
        }

        const user = await authApi.restoreSession();
        if (cancelled) return;
        if (user) {
          setAuthenticated(user);
        } else {
          setAccessToken(null);
          setAnonymous();
        }
      } catch {
        if (!cancelled) {
          setAccessToken(null);
          setAnonymous();
        }
      } finally {
        if (!cancelled) setBooting(false);
      }
    }

    void boot();
    return () => {
      cancelled = true;
    };
  }, [setAuthenticated, setAnonymous, setGuest]);

  if (booting) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background px-4">
        <div className="h-10 w-10 animate-pulse rounded-full bg-primary-muted" />
        <p className="text-sm font-medium text-text-muted">Checking session…</p>
      </div>
    );
  }

  return children;
}
