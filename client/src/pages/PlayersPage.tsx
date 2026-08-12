import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus, UserRound } from 'lucide-react';
import { useState } from 'react';
import { Avatar, Button, Card, EmptyState, Input, Select, Skeleton } from '@/components/ui';
import { playersApi } from '@/features/players/playersApi';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { requireAccountMessage, useAuthStore } from '@/features/auth/authStore';

const roleOptions = [
  { value: '', label: 'All roles' },
  { value: 'BATTER', label: 'Batter' },
  { value: 'BOWLER', label: 'Bowler' },
  { value: 'ALL_ROUNDER', label: 'All-rounder' },
  { value: 'WICKET_KEEPER', label: 'Wicket Keeper' },
];

const battingOptions = [
  { value: '', label: 'All batting' },
  { value: 'RIGHT_HAND', label: 'Right Hand' },
  { value: 'LEFT_HAND', label: 'Left Hand' },
];

const bowlingOptions = [
  { value: '', label: 'All bowling' },
  { value: 'RIGHT_ARM_FAST', label: 'Right Arm Fast' },
  { value: 'RIGHT_ARM_MEDIUM', label: 'Right Arm Medium' },
  { value: 'RIGHT_ARM_SPIN', label: 'Right Arm Spin' },
  { value: 'LEFT_ARM_FAST', label: 'Left Arm Fast' },
  { value: 'LEFT_ARM_MEDIUM', label: 'Left Arm Medium' },
  { value: 'LEFT_ARM_SPIN', label: 'Left Arm Spin' },
];

export function PlayersPage() {
  const status = useAuthStore((s) => s.status);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [battingStyle, setBattingStyle] = useState('');
  const [bowlingStyle, setBowlingStyle] = useState('');
  const debounced = useDebouncedValue(search);

  const query = useQuery({
    queryKey: ['players', debounced, role, battingStyle, bowlingStyle],
    queryFn: () =>
      playersApi.list({
        search: debounced || undefined,
        role: role || undefined,
        battingStyle: battingStyle || undefined,
        bowlingStyle: bowlingStyle || undefined,
        limit: 50,
      }),
    enabled: status === 'authenticated',
  });

  if (status === 'guest') {
    return (
      <EmptyState
        title="Sign in to manage players"
        description={requireAccountMessage()}
        action={
          <Link to="/register" className="text-sm font-semibold text-primary">
            Create an account
          </Link>
        }
      />
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="grid flex-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Input placeholder="Search players…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <Select label="Role" options={roleOptions} value={role} onChange={(e) => setRole(e.target.value)} />
          <Select
            label="Batting"
            options={battingOptions}
            value={battingStyle}
            onChange={(e) => setBattingStyle(e.target.value)}
          />
          <Select
            label="Bowling"
            options={bowlingOptions}
            value={bowlingStyle}
            onChange={(e) => setBowlingStyle(e.target.value)}
          />
        </div>
        <Link
          to="/players/new"
          className="inline-flex h-11 min-h-[44px] items-center justify-center gap-2 rounded-control bg-primary px-4 text-sm font-semibold text-background"
        >
          <Plus className="h-4 w-4" />
          Add Player
        </Link>
      </div>

      {query.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      ) : query.isError ? (
        <EmptyState
          title="Could not load players"
          action={<Button onClick={() => void query.refetch()}>Retry</Button>}
        />
      ) : !query.data?.items.length ? (
        <EmptyState
          icon={UserRound}
          title="No players yet"
          description="Add your first player."
          action={
            <Link
              to="/players/new"
              className="inline-flex h-11 items-center rounded-control bg-primary px-4 text-sm font-semibold text-background"
            >
              Add Player
            </Link>
          }
        />
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-card border border-border-subtle md:block">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-surface-elevated text-text-muted">
                <tr>
                  <th className="px-3 py-2.5">Player</th>
                  <th className="px-3 py-2.5">Role</th>
                  <th className="px-3 py-2.5">Batting</th>
                  <th className="px-3 py-2.5">Bowling</th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {query.data.items.map((p) => (
                  <tr key={p.id} className="border-t border-border-subtle">
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <Avatar name={p.name} src={p.profileImageUrl} size="sm" />
                        {p.name}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">{p.role.replaceAll('_', ' ')}</td>
                    <td className="px-3 py-2.5">{p.battingStyle?.replaceAll('_', ' ') ?? '—'}</td>
                    <td className="px-3 py-2.5">{p.bowlingStyle?.replaceAll('_', ' ') ?? '—'}</td>
                    <td className="px-3 py-2.5 text-right">
                      <Link to={`/players/${p.id}`} className="font-semibold text-primary">
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-3 md:hidden">
            {query.data.items.map((p) => (
              <Card key={p.id} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Avatar name={p.name} src={p.profileImageUrl} />
                  <div>
                    <p className="font-semibold">{p.name}</p>
                    <p className="text-xs text-text-muted">{p.role.replaceAll('_', ' ')}</p>
                  </div>
                </div>
                <Link to={`/players/${p.id}`} className="text-sm font-semibold text-primary">
                  View
                </Link>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
