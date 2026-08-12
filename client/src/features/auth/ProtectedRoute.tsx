import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from './authStore';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const status = useAuthStore((s) => s.status);
  const location = useLocation();

  if (status === 'anonymous' || status === 'unknown') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return children;
}

export function PublicOnlyRoute({ children }: { children: React.ReactNode }) {
  const status = useAuthStore((s) => s.status);

  // Guests may open login/register to create or sign into an account.
  if (status === 'authenticated') {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
