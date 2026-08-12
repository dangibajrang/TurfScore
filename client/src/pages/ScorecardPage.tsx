import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Printer, Share2 } from 'lucide-react';
import { Button, EmptyState } from '@/components/ui';
import { ScorecardSkeleton, ScorecardView } from '@/features/scoring/ScorecardView';
import { useMatchMeta, useScorecardQuery } from '@/features/scoring/useScoringActions';
import { useUiStore } from '@/stores/uiStore';
import { ApiError } from '@/lib/apiClient';

export function ScorecardPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const highlightPlayerId = params.get('highlight');
  const showToast = useUiStore((s) => s.showToast);
  const matchQ = useMatchMeta(id!);
  const scorecardQ = useScorecardQuery(id!);

  if (!id) return <EmptyState title="Match not found" />;

  if (matchQ.isLoading || scorecardQ.isLoading) {
    return <ScorecardSkeleton />;
  }

  if (matchQ.isError || !matchQ.data || scorecardQ.isError || !scorecardQ.data) {
    return (
      <EmptyState
        title="Scorecard unavailable"
        description={
          scorecardQ.error instanceof ApiError
            ? scorecardQ.error.message
            : 'Unable to load scorecard'
        }
        action={
          <Link to="/matches" className="text-sm font-semibold text-primary">
            Back to matches
          </Link>
        }
      />
    );
  }

  const match = matchQ.data;
  const publicId = match.publicMatchId;
  const shareUrl =
    typeof window !== 'undefined' && publicId && match.publicLiveEnabled
      ? `${window.location.origin}/live/${publicId}/scorecard`
      : typeof window !== 'undefined'
        ? window.location.href
        : '';

  return (
    <div className="space-y-3">
      <div className="print:hidden mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-2">
        <Link to={`/matches/${id}`} className="text-sm text-text-muted hover:text-primary">
          ← Match details
        </Link>
        <div className="flex flex-wrap gap-2">
          {match.status === 'LIVE' ? (
            <Link
              to={`/matches/${id}/live`}
              className="rounded-control bg-primary px-3 py-2 text-sm font-semibold text-background"
            >
              Open scoring
            </Link>
          ) : null}
          {publicId && match.publicLiveEnabled ? (
            <Link
              to={`/live/${publicId}/scorecard`}
              className="rounded-control border border-border px-3 py-2 text-sm font-semibold"
            >
              Public scorecard
            </Link>
          ) : null}
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              void navigator.clipboard.writeText(shareUrl).then(
                () => showToast('Link copied'),
                () => showToast('Could not copy link'),
              );
            }}
          >
            <Share2 className="mr-1 h-4 w-4" />
            Copy link
          </Button>
          <Button size="sm" variant="secondary" onClick={() => window.print()}>
            <Printer className="mr-1 h-4 w-4" />
            Print
          </Button>
        </div>
      </div>
      <div className="scorecard-print">
        <ScorecardView
          match={match}
          scorecard={scorecardQ.data}
          highlightPlayerId={highlightPlayerId}
        />
      </div>
    </div>
  );
}
