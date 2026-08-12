import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { Button, EmptyState, Input, Skeleton, Tabs } from '@/components/ui';
import { matchesApi } from '@/features/matches/matchesApi';
import { MatchHistoryCard } from '@/features/matches/MatchHistoryCard';
import { requireAccountMessage, useAuthStore } from '@/features/auth/authStore';

const filters: Array<{ id: string; label: string }> = [
  { id: 'ALL', label: 'All' },
  { id: 'LIVE', label: 'Live' },
  { id: 'UPCOMING', label: 'Upcoming' },
  { id: 'COMPLETED', label: 'Completed' },
  { id: 'DRAFT', label: 'Draft' },
];

const datePresets: Array<{ id: string; label: string }> = [
  { id: 'ALL', label: 'Any date' },
  { id: 'TODAY', label: 'Today' },
  { id: 'WEEK', label: 'This week' },
  { id: 'MONTH', label: 'This month' },
];

function dateRange(preset: string): { dateFrom?: string; dateTo?: string } {
  const now = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  if (preset === 'TODAY') {
    const t = iso(now);
    return { dateFrom: t, dateTo: t };
  }
  if (preset === 'WEEK') {
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay());
    return { dateFrom: iso(start), dateTo: iso(now) };
  }
  if (preset === 'MONTH') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { dateFrom: iso(start), dateTo: iso(now) };
  }
  return {};
}

export function MatchesPage() {
  const authStatus = useAuthStore((s) => s.status);
  const [tab, setTab] = useState('ALL');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [datePreset, setDatePreset] = useState('ALL');

  useEffect(() => {
    const t = window.setTimeout(() => setSearch(searchInput.trim()), 350);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  const range = dateRange(datePreset);

  const query = useQuery({
    queryKey: ['matches', tab, search, datePreset],
    queryFn: () =>
      matchesApi.list({
        status: tab === 'ALL' ? undefined : tab,
        search: search || undefined,
        dateFrom: range.dateFrom,
        dateTo: range.dateTo,
        limit: 50,
      }),
    enabled: authStatus === 'authenticated',
  });

  if (authStatus === 'guest') {
    return (
      <EmptyState
        title="Sign in to manage matches"
        description={requireAccountMessage()}
        action={
          <Link to="/login" className="text-sm font-semibold text-primary">
            Sign in
          </Link>
        }
      />
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-2xl font-semibold">My Matches</h2>
        <p className="text-sm text-text-muted">History, live games, and upcoming fixtures.</p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={tab} onChange={setTab} items={filters} />
        <Link
          to="/matches/create"
          className="inline-flex h-11 min-h-[44px] items-center justify-center gap-2 rounded-control bg-primary px-4 text-sm font-semibold text-background"
        >
          <Plus className="h-4 w-4" />
          Create Match
        </Link>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <Input
            className="pl-9"
            placeholder="Search matches, teams, venues…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            aria-label="Search matches"
            data-testid="matches-search"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-text-muted">
          <span className="sr-only">Date</span>
          <select
            className="h-11 rounded-control border border-border bg-surface px-3 text-sm text-text"
            value={datePreset}
            onChange={(e) => setDatePreset(e.target.value)}
            aria-label="Filter by date"
          >
            {datePresets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {query.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-36 w-full" />
          ))}
        </div>
      ) : query.isError ? (
        <EmptyState
          title="Could not load matches"
          action={<Button onClick={() => void query.refetch()}>Retry</Button>}
        />
      ) : !query.data?.items.length ? (
        <EmptyState
          title="No matches yet"
          description="Your first match starts here."
          action={
            <Link to="/matches/create" className="text-sm font-semibold text-primary">
              Create Match
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {query.data.items.map((m) => (
            <MatchHistoryCard key={m.id} match={m} />
          ))}
        </div>
      )}
    </div>
  );
}
