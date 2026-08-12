import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Avatar, EmptyState, Input, Skeleton } from '@/components/ui';
import { teamsApi, type Team } from '@/features/teams/teamsApi';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { cn } from '@/lib/cn';

type Props = {
  label: string;
  value: string;
  excludeId?: string;
  onChange: (teamId: string) => void;
};

export function TeamSelector({ label, value, excludeId, onChange }: Props) {
  const [search, setSearch] = useState('');
  const debounced = useDebouncedValue(search);
  const query = useQuery({
    queryKey: ['teams', 'wizard', debounced],
    queryFn: () => teamsApi.list({ search: debounced || undefined, limit: 30 }),
  });

  const items = useMemo(
    () => (query.data?.items ?? []).filter((t) => t.id !== excludeId),
    [query.data, excludeId],
  );

  return (
    <div className="space-y-3" data-testid={`team-selector-${label.replace(/\s+/g, '-').toLowerCase()}`}>
      <p className="text-sm font-semibold">{label}</p>
      <Input
        placeholder="Search teams…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        aria-label={`Search ${label}`}
      />
      {query.isLoading ? (
        <Skeleton className="h-28 w-full" />
      ) : !items.length ? (
        <EmptyState
          title="No teams available"
          description="Create a team first, then return to match setup."
          action={
            <Link to="/teams/new" className="text-sm font-semibold text-primary">
              Create Team
            </Link>
          }
        />
      ) : (
        <ul className="max-h-64 space-y-2 overflow-y-auto">
          {items.map((team: Team) => {
            const selected = team.id === value;
            return (
              <li key={team.id}>
                <button
                  type="button"
                  onClick={() => onChange(team.id)}
                  aria-pressed={selected}
                  className={cn(
                    'flex min-h-[44px] w-full items-center gap-3 rounded-card border px-3 py-2 text-left transition-colors',
                    selected
                      ? 'border-primary bg-primary-muted'
                      : 'border-border-subtle bg-surface hover:border-primary/40',
                  )}
                >
                  <Avatar name={team.shortName || team.name} src={team.logoUrl ?? undefined} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{team.name}</p>
                    <p className="text-xs text-text-muted">
                      {team.shortName || '—'} · {team.playerCount} players
                    </p>
                  </div>
                  {selected ? (
                    <span className="text-xs font-bold text-primary">Selected</span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
