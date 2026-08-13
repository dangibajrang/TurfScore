import { Outlet, useLocation } from 'react-router-dom';
import { DesktopSidebar } from './DesktopSidebar';
import { MobileBottomNav } from './MobileBottomNav';
import { MobileMoreDrawer } from './MobileMoreDrawer';
import { Toast } from '@/components/ui/Toast';
import { UserMenu } from '@/features/auth/UserMenu';
import { useAuthStore } from '@/features/auth/authStore';
import { Badge } from '@/components/ui/Badge';
import { GlobalSearch } from '@/features/search/GlobalSearch';

const titles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/matches': 'Matches',
  '/matches/create': 'Create Match',
  '/teams': 'Teams',
  '/players': 'Players',
  '/statistics': 'Statistics',
  '/live': 'Live Matches',
  '/settings': 'Settings',
  '/profile': 'Profile',
};

export function AppShell() {
  const { pathname } = useLocation();
  const title =
    titles[pathname] ??
    (pathname.startsWith('/matches/')
      ? pathname.endsWith('/edit')
        ? 'Edit Match'
        : pathname.endsWith('/live')
          ? 'Live Scoring'
          : pathname.endsWith('/scorecard')
            ? 'Scorecard'
            : 'Match'
      : pathname.startsWith('/teams/')
        ? 'Team'
        : pathname.startsWith('/players/')
          ? 'Player'
          : 'TurfScore');
  const status = useAuthStore((s) => s.status);
  // Keep the keypad unobstructed on the scoring screen only — not the /live list.
  const hideBottomNav = /^\/matches\/[^/]+\/live\/?$/.test(pathname);

  return (
    <div className="relative h-dvh overflow-hidden">
      <DesktopSidebar />
      <div className="flex h-full min-w-0 flex-col md:pl-[var(--sidebar-width)]">
        {/* Pinned chrome — page scroll lives in <main> only */}
        <header className="z-30 shrink-0 border-b border-border-subtle bg-background px-3 py-3 sm:px-4 md:px-6">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium uppercase tracking-[0.16em] text-text-subtle md:hidden">
                TurfScore
              </p>
              <div className="flex min-w-0 items-center gap-2">
                <h1 className="truncate font-display text-lg font-semibold tracking-tight sm:text-xl md:text-2xl">
                  {title}
                </h1>
                {status === 'guest' ? <Badge tone="warning">Guest</Badge> : null}
              </div>
            </div>
            <div className="flex shrink-0 items-center justify-end gap-2">
              <GlobalSearch className="hidden w-40 sm:block md:w-64" />
              <UserMenu />
            </div>
          </div>
        </header>

        <main
          className={
            hideBottomNav
              ? 'min-h-0 flex-1 overflow-x-clip overflow-y-auto overscroll-y-contain px-3 pb-6 pt-4 sm:px-4 md:px-6 md:pb-8 md:pt-6'
              : 'min-h-0 flex-1 overflow-x-clip overflow-y-auto overscroll-y-contain px-3 pb-[calc(var(--bottom-nav-height)+20px+env(safe-area-inset-bottom,0px))] pt-4 sm:px-4 md:px-6 md:pb-8 md:pt-6'
          }
        >
          <Outlet />
        </main>
      </div>
      {hideBottomNav ? null : <MobileBottomNav />}
      <MobileMoreDrawer />
      <Toast />
    </div>
  );
}
