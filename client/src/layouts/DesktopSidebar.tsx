import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Trophy,
  Users,
  UserRound,
  BarChart3,
  Radio,
  Settings,
} from 'lucide-react';
import { TurfScoreLogo } from '@/assets/branding/TurfScoreLogo';
import { UserMenu } from '@/features/auth/UserMenu';
import { cn } from '@/lib/cn';

const navItems: Array<{
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  end?: boolean;
}> = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/matches', label: 'Matches', icon: Trophy },
  { to: '/teams', label: 'Teams', icon: Users },
  { to: '/players', label: 'Players', icon: UserRound },
  { to: '/statistics', label: 'Statistics', icon: BarChart3 },
  { to: '/live', label: 'Live Matches', icon: Radio },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export function DesktopSidebar() {
  return (
    <aside
      data-testid="desktop-sidebar"
      className="fixed inset-y-0 left-0 z-40 hidden w-[var(--sidebar-width)] flex-col border-r border-border-subtle bg-surface md:flex"
    >
      <div className="shrink-0 border-b border-border-subtle px-5 py-5">
        <TurfScoreLogo size="md" />
      </div>

      <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-3 py-4" aria-label="Main">
        {navItems.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-control px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary-muted text-primary'
                  : 'text-text-muted hover:bg-surface-elevated hover:text-text',
              )
            }
          >
            <Icon className="h-[18px] w-[18px]" aria-hidden />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="shrink-0 border-t border-border-subtle px-4 py-4">
        <UserMenu />
      </div>
    </aside>
  );
}
