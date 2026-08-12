import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus, Users } from 'lucide-react';
import { useState } from 'react';
import { Button, Card, EmptyState, Input, Skeleton } from '@/components/ui';
import { teamsApi } from '@/features/teams/teamsApi';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { requireAccountMessage, useAuthStore } from '@/features/auth/authStore';

export function TeamsPage() {
  const status = useAuthStore((s) => s.status);
  const [search, setSearch] = useState('');
  const debounced = useDebouncedValue(search, 300);

  const query = useQuery({
    queryKey: ['teams', debounced],
    queryFn: () => teamsApi.list({ search: debounced || undefined, limit: 50 }),
    enabled: status === 'authenticated',
  });

  if (status === 'guest') {
    return (
      <EmptyState
        title="Sign in to manage teams"
        description={requireAccountMessage()}
        action={
          <Link to="/register" className="text-sm font-semibold text-primary hover:underline">
            Create an account
          </Link>
        }
      />
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          placeholder="Search teams…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:max-w-xs"
        />
        <Link
          to="/teams/new"
          className="inline-flex h-11 min-h-[44px] items-center justify-center gap-2 rounded-control bg-primary px-4 text-sm font-semibold text-background"
        >
          <Plus className="h-4 w-4" />
          Create Team
        </Link>
      </div>

      {query.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-36 w-full" />
          ))}
        </div>
      ) : query.isError ? (
        <EmptyState
          title="Could not load teams"
          description="Check your connection and try again."
          action={<Button onClick={() => void query.refetch()}>Retry</Button>}
        />
      ) : !query.data?.items.length ? (
        <EmptyState
          icon={Users}
          title="No teams yet"
          description="Create your first cricket team."
          action={
            <Link
              to="/teams/new"
              className="inline-flex h-11 items-center rounded-control bg-primary px-4 text-sm font-semibold text-background"
            >
              Create Team
            </Link>
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {query.data.items.map((team) => (
            <Card key={team.id} className="flex flex-col gap-3">
              <div className="flex items-start gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-muted text-sm font-bold text-primary">
                  {(team.shortName || team.name).slice(0, 3).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-display text-lg font-semibold">{team.name}</h3>
                  <p className="text-xs text-text-muted">
                    {team.shortName || '—'} · {team.playerCount} players
                  </p>
                </div>
              </div>
              <div className="mt-auto flex gap-2">
                <Link
                  to={`/teams/${team.id}`}
                  className="inline-flex h-11 flex-1 items-center justify-center rounded-control border border-border text-sm font-semibold"
                >
                  View
                </Link>
                <Link
                  to={`/teams/${team.id}/edit`}
                  className="inline-flex h-11 flex-1 items-center justify-center rounded-control bg-surface-elevated text-sm font-semibold"
                >
                  Edit
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
