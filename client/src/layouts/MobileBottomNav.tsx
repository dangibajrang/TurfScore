import { NavLink } from 'react-router-dom';
import { Home, Trophy, Users, UserRound, Menu } from 'lucide-react';
import { useUiStore } from '@/stores/uiStore';
import { cn } from '@/lib/cn';

const items: Array<{
  to: string;
  label: string;
  icon: typeof Home;
  end?: boolean;
}> = [
  { to: '/dashboard', label: 'Home', icon: Home, end: true },
  { to: '/matches', label: 'Matches', icon: Trophy },
  { to: '/teams', label: 'Teams', icon: Users },
  { to: '/players', label: 'Players', icon: UserRound },
];

export function MobileBottomNav() {
  const setMobileMoreOpen = useUiStore((s) => s.setMobileMoreOpen);

  return (
    <nav
      data-testid="mobile-bottom-nav"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border-subtle bg-surface pb-[env(safe-area-inset-bottom,0px)] md:hidden"
      style={{
        height: 'calc(var(--bottom-nav-height) + env(safe-area-inset-bottom, 0px))',
      }}
      aria-label="Mobile"
    >
      <ul className="mx-auto flex h-full max-w-lg items-stretch justify-around px-1">
        {items.map(({ to, label, icon: Icon, end }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'flex h-full flex-col items-center justify-center gap-0.5 text-[11px] font-medium',
                  isActive ? 'text-primary' : 'text-text-muted',
                )
              }
            >
              <Icon className="h-5 w-5" aria-hidden />
              {label}
            </NavLink>
          </li>
        ))}
        <li className="flex-1">
          <button
            type="button"
            className="flex h-full w-full flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-text-muted"
            onClick={() => setMobileMoreOpen(true)}
          >
            <Menu className="h-5 w-5" aria-hidden />
            More
          </button>
        </li>
      </ul>
    </nav>
  );
}
