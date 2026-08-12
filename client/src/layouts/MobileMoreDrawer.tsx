import { Link } from 'react-router-dom';
import { BarChart3, Radio, Settings, UserRound } from 'lucide-react';
import { Drawer } from '@/components/ui/Drawer';
import { useUiStore } from '@/stores/uiStore';
import { useAuthStore } from '@/features/auth/authStore';
import { useLogoutMutation } from '@/features/auth/hooks';

const moreLinks = [
  { to: '/profile', label: 'Profile', icon: UserRound },
  { to: '/live', label: 'Live Matches', icon: Radio },
  { to: '/statistics', label: 'Statistics', icon: BarChart3 },
  { to: '/settings', label: 'Settings', icon: Settings },
] as const;

export function MobileMoreDrawer() {
  const open = useUiStore((s) => s.mobileMoreOpen);
  const setOpen = useUiStore((s) => s.setMobileMoreOpen);
  const status = useAuthStore((s) => s.status);
  const logout = useLogoutMutation();

  return (
    <Drawer open={open} title="More" onClose={() => setOpen(false)} side="right">
      <ul className="space-y-1">
        {moreLinks.map(({ to, label, icon: Icon }) => (
          <li key={to}>
            <Link
              to={to}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-control px-3 py-3 text-sm font-medium text-text hover:bg-surface-elevated"
            >
              <Icon className="h-[18px] w-[18px] text-primary" aria-hidden />
              {label}
            </Link>
          </li>
        ))}
      </ul>
      {status === 'authenticated' ? (
        <button
          type="button"
          className="mt-4 w-full rounded-control border border-danger/40 px-3 py-3 text-sm font-semibold text-danger"
          disabled={logout.isPending}
          onClick={() => {
            setOpen(false);
            logout.mutate();
          }}
        >
          {logout.isPending ? 'Signing out…' : 'Logout'}
        </button>
      ) : (
        <Link
          to="/login"
          onClick={() => setOpen(false)}
          className="mt-4 flex w-full items-center justify-center rounded-control bg-primary px-3 py-3 text-sm font-semibold text-background"
        >
          Sign in
        </Link>
      )}
    </Drawer>
  );
}
