import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, LogOut, Settings, UserRound } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { useLogoutMutation } from './hooks';
import { useAuthStore } from './authStore';
import { requireAccountMessage } from './authStore';
import { useUiStore } from '@/stores/uiStore';

export function UserMenu() {
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);
  const logout = useLogoutMutation();
  const showToast = useUiStore((s) => s.showToast);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  if (status === 'guest') {
    return (
      <div className="flex items-center gap-2">
        <Avatar name="Guest" size="sm" />
        <div className="min-w-0 hidden sm:block">
          <div className="truncate text-sm font-semibold">Guest</div>
          <button
            type="button"
            className="truncate text-xs text-primary hover:underline"
            onClick={() => showToast(requireAccountMessage())}
          >
            Create an account to sync
          </button>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className="flex items-center gap-2 rounded-control px-1 py-1.5 hover:bg-surface-elevated sm:px-2"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Avatar name={user.name} src={user.profileImage} size="sm" />
        <div className="hidden min-w-0 text-left sm:block">
          <div className="truncate text-sm font-semibold">{user.name}</div>
          <div className="truncate text-xs text-text-muted">{user.email}</div>
        </div>
        <ChevronDown className="hidden h-4 w-4 text-text-muted sm:block" />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-card border border-border-subtle bg-surface shadow-card"
        >
          <div className="border-b border-border-subtle px-3 py-2">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-semibold">{user.name}</span>
              <Badge tone={user.role === 'ADMIN' ? 'warning' : 'primary'}>{user.role}</Badge>
            </div>
          </div>
          <Link
            to="/profile"
            role="menuitem"
            className="flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-surface-elevated"
            onClick={() => setOpen(false)}
          >
            <UserRound className="h-4 w-4 text-primary" />
            Profile
          </Link>
          <Link
            to="/settings"
            role="menuitem"
            className="flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-surface-elevated"
            onClick={() => setOpen(false)}
          >
            <Settings className="h-4 w-4 text-primary" />
            Settings
          </Link>
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-danger hover:bg-danger-muted"
            disabled={logout.isPending}
            onClick={() => logout.mutate()}
          >
            <LogOut className="h-4 w-4" />
            {logout.isPending ? 'Signing out…' : 'Logout'}
          </button>
        </div>
      ) : null}
    </div>
  );
}
