import { Link } from 'react-router-dom';
import { Badge, Card } from '@/components/ui';
import type { MatchDto, MatchStatus } from './types';

function statusTone(status: MatchStatus) {
  if (status === 'LIVE') return 'danger' as const;
  if (status === 'UPCOMING') return 'info' as const;
  if (status === 'COMPLETED') return 'primary' as const;
  if (status === 'DRAFT') return 'warning' as const;
  return 'default' as const;
}

function formatSide(
  name: string | null,
  shortName: string | null,
  score: { runs: number; wickets: number; overs: string } | null | undefined,
) {
  const label = shortName || name || 'Team';
  if (!score) return { label, line: '—' };
  return { label, line: `${score.runs}/${score.wickets}`, overs: score.overs };
}

type Props = {
  match: MatchDto;
};

export function MatchHistoryCard({ match: m }: Props) {
  const a = formatSide(m.teamA.teamName, m.teamA.teamShortName, m.scoreSummary?.teamA);
  const b = formatSide(m.teamB.teamName, m.teamB.teamShortName, m.scoreSummary?.teamB);
  const when =
    m.status === 'COMPLETED' && m.completedAt
      ? new Date(m.completedAt).toLocaleDateString()
      : m.scheduledAt
        ? new Date(m.scheduledAt).toLocaleString()
        : null;

  return (
    <Card className="transition hover:border-primary/30" data-testid="match-history-card">
      <Link to={`/matches/${m.id}`} className="block space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Badge tone={statusTone(m.status)}>{m.status === 'LIVE' ? 'LIVE NOW' : m.status}</Badge>
          {when ? <span className="text-xs text-text-muted">{when}</span> : null}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-sm font-semibold">{a.label}</p>
            <p className="font-display text-2xl font-semibold tabular-nums">{a.line}</p>
            {'overs' in a && a.overs ? (
              <p className="text-xs text-text-muted">{a.overs} OV</p>
            ) : null}
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold">{b.label}</p>
            <p className="font-display text-2xl font-semibold tabular-nums">{b.line}</p>
            {'overs' in b && b.overs ? (
              <p className="text-xs text-text-muted">{b.overs} OV</p>
            ) : null}
          </div>
        </div>

        <p className="truncate text-sm text-text-muted">{m.name}</p>
        {m.status === 'COMPLETED' && m.resultText ? (
          <p className="text-sm font-medium text-primary">{m.resultText}</p>
        ) : null}
        <p className="text-xs text-text-muted">{m.venue ?? 'Venue TBD'}</p>
      </Link>
      <div className="mt-3 flex flex-wrap gap-2 border-t border-border-subtle pt-3">
        <Link
          to={`/matches/${m.id}`}
          className="inline-flex h-10 items-center rounded-control border border-border px-3 text-sm font-semibold"
        >
          View
        </Link>
        {m.status === 'LIVE' ? (
          <Link
            to={`/matches/${m.id}/live`}
            className="inline-flex h-10 items-center rounded-control bg-primary px-3 text-sm font-semibold text-background"
          >
            Open scoring
          </Link>
        ) : null}
        {m.status === 'COMPLETED' ? (
          <Link
            to={`/matches/${m.id}/scorecard`}
            className="inline-flex h-10 items-center rounded-control border border-border px-3 text-sm font-semibold"
          >
            Scorecard
          </Link>
        ) : null}
        {m.status === 'DRAFT' || m.status === 'UPCOMING' ? (
          <Link
            to={`/matches/${m.id}/edit`}
            className="inline-flex h-10 items-center rounded-control border border-border px-3 text-sm font-semibold"
          >
            Edit
          </Link>
        ) : null}
      </div>
    </Card>
  );
}
