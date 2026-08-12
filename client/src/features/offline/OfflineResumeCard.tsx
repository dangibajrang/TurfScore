import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Card } from '@/components/ui';
import { listResumeCandidates } from './queue';
import type { OfflineMatchContext } from './types';

/** Dashboard/match list resume card when pending offline actions exist. */
export function OfflineResumeCard() {
  const [items, setItems] = useState<OfflineMatchContext[]>([]);

  useEffect(() => {
    void listResumeCandidates().then(setItems);
  }, []);

  if (items.length === 0) return null;

  const top = items[0]!;
  const hint = top.localPresentationHint;
  const pending = hint?.pendingCount ?? 0;

  return (
    <Card className="border-warning/30 bg-warning/5" data-testid="offline-resume-card">
      <p className="text-xs font-semibold uppercase tracking-wider text-warning">Resume match</p>
      <h3 className="mt-1 font-display text-lg font-semibold">{top.match.name}</h3>
      <p className="mt-1 text-sm text-text-muted">
        {hint
          ? `${hint.totalRuns}/${hint.wickets} · ${hint.oversDisplay} overs`
          : 'Local scoring in progress'}
        {pending > 0 ? ` · ${pending} actions waiting to sync` : ''}
      </p>
      <Link to={`/matches/${top.matchId}/live`} className="mt-3 inline-block">
        <Button size="sm">Resume scoring</Button>
      </Link>
    </Card>
  );
}
