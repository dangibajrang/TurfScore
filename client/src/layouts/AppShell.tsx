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
  const hideBottomNav = pathname.includes('/live');

  return (
    <div className="relative h-dvh overflow-hidden">
      <DesktopSidebar />
      <div className="flex h-full min-w-0 flex-col md:pl-[var(--sidebar-width)]">
        {/* Pinned chrome — page scroll lives in <main> only */}
        <header className="z-30 shrink-0 border-b border-border-subtle bg-background px-4 py-3 md:px-6">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-text-subtle md:hidden">
                TurfScore
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-xl font-semibold tracking-tight md:text-2xl">
                  {title}
                </h1>
                {status === 'guest' ? <Badge tone="warning">Guest</Badge> : null}
              </div>
            </div>
            <div className="flex min-w-0 flex-1 items-center justify-end gap-2 sm:gap-3">
              <GlobalSearch className="max-w-[9.5rem] flex-1 xs:max-w-[12rem] sm:max-w-xs md:max-w-sm" />
              <UserMenu />
            </div>
          </div>
        </header>

        <main
          className={
            hideBottomNav
              ? 'min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-4 pb-6 pt-4 md:px-6 md:pb-8 md:pt-6'
              : 'min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-4 pb-[calc(var(--bottom-nav-height)+20px+env(safe-area-inset-bottom,0px))] pt-4 md:px-6 md:pb-8 md:pt-6'
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
