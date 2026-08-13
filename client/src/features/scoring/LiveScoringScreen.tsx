import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { Button, Card, ConfirmDialog, EmptyState, Skeleton } from '@/components/ui';
import type { MatchDto } from '@/features/matches/types';
import { LiveSharingPanel } from '@/features/realtime/LiveSharingPanel';
import { OfflineBanner } from '@/features/offline/OfflineBanner';
import { SyncStatusPanel } from '@/features/offline/SyncStatusPanel';
import { persistServerSnapshot } from '@/features/offline/sync';
import { useOfflineUiStore } from '@/features/offline/offlineUiStore';
import { CurrentBatters } from './components/CurrentBatters';
import { CurrentBowler } from './components/CurrentBowler';
import { CurrentOver } from './components/CurrentOver';
import { ExtraRunsSheet, NoBallSheet, WicketSheet } from './components/ExtraAndWicketSheets';
import { PartnershipCard } from './components/PartnershipCard';
import { DeliveryDetailModal, RecentDeliveries } from './components/RecentDeliveries';
import { ScoreHeader } from './components/ScoreHeader';
import { ScoringKeypad } from './components/ScoringKeypad';
import {
  BowlerSelectSheet,
  OpeningBattersSheet,
  ReplacementBatterSheet,
} from './components/SetupSheets';
import { useScoringUiStore } from './scoringUiStore';
import type { DeliveryDto, ScoringStateResponse } from './types';
import { useScoringActions } from './useScoringActions';

type Props = {
  matchId: string;
  match: MatchDto;
  scoring: ScoringStateResponse;
};

export function LiveScoringScreen({ matchId, match, scoring }: Props) {
  const { state, presentation, scorecard, recentDeliveries, status } = scoring;
  const sheet = useScoringUiStore((s) => s.sheet);
  const setSheet = useScoringUiStore((s) => s.setSheet);
  const submitting = useScoringUiStore((s) => s.submitting);
  const lastFlash = useScoringUiStore((s) => s.lastFlash);
  const setLastFlash = useScoringUiStore((s) => s.setLastFlash);
  const selectedDelivery = useScoringUiStore((s) => s.selectedDelivery);
  const setSelectedDelivery = useScoringUiStore((s) => s.setSelectedDelivery);

  const actions = useScoringActions(matchId);
  const keypadRef = useRef<HTMLDivElement>(null);
  const [keypadHeight, setKeypadHeight] = useState(240);
  const [desktopLayout, setDesktopLayout] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 768px)').matches : false,
  );
  const [editReason, setEditReason] = useState('');
  const [editRuns, setEditRuns] = useState(0);
  const offlinePending = useOfflineUiStore((s) => s.pendingCount);
  const offlineConnection = useOfflineUiStore((s) => s.connection);
  const allowOfflineScoring =
    offlineConnection === 'OFFLINE' || offlineConnection === 'SYNCING' || offlinePending > 0;

  useEffect(() => {
    void persistServerSnapshot(matchId, match, scoring);
  }, [matchId, match, scoring]);

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      const pending = useOfflineUiStore.getState().pendingCount;
      const failed = useOfflineUiStore.getState().failedCount;
      if (pending + failed <= 0) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  const inn = state.innings[state.currentInningsIndex];
  const scInn = scorecard.innings[state.currentInningsIndex];

  const playersById = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    for (const p of [...match.teamA.playingXi, ...match.teamB.playingXi]) {
      map.set(p.playerId, { id: p.playerId, name: p.playerName ?? 'Player' });
    }
    return map;
  }, [match]);

  const battingTeam =
    match.teamA.teamId === presentation.battingTeamId ? match.teamA : match.teamB;
  const bowlingTeam =
    match.teamA.teamId === presentation.bowlingTeamId ? match.teamA : match.teamB;

  useEffect(() => {
    if (!presentation.openingsSelected) setSheet('openings');
    else if (!presentation.bowlerSelected && !presentation.inningsComplete) setSheet('bowler');
    else if (presentation.pendingNewBatter) setSheet('replacement');
    else if (presentation.pendingNewBowler) setSheet('bowler');
    else if (
      presentation.inningsComplete &&
      !presentation.matchComplete &&
      presentation.inningsNumber === 1
    ) {
      setSheet('secondInnings');
    }
  }, [
    presentation.openingsSelected,
    presentation.bowlerSelected,
    presentation.pendingNewBatter,
    presentation.pendingNewBowler,
    presentation.inningsComplete,
    presentation.matchComplete,
    presentation.inningsNumber,
    setSheet,
  ]);

  useEffect(() => {
    if (!lastFlash) return;
    const t = window.setTimeout(() => setLastFlash(null), 700);
    return () => window.clearTimeout(t);
  }, [lastFlash, setLastFlash]);

  useLayoutEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const apply = () => setDesktopLayout(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  useLayoutEffect(() => {
    if (presentation.inningsComplete || desktopLayout) {
      setKeypadHeight(0);
      return;
    }
    const el = keypadRef.current;
    if (!el) return;
    const update = () => setKeypadHeight(Math.ceil(el.getBoundingClientRect().height));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [presentation.inningsComplete, desktopLayout]);

  const networkDown =
    typeof navigator !== 'undefined' &&
    (!navigator.onLine || offlineConnection === 'OFFLINE' || allowOfflineScoring);

  const busy =
    (!networkDown && (submitting || actions.recordDelivery.isPending)) ||
    !presentation.openingsSelected ||
    !presentation.bowlerSelected ||
    presentation.pendingNewBatter ||
    presentation.pendingNewBowler ||
    presentation.inningsComplete ||
    presentation.matchComplete ||
    status !== 'LIVE';

  const currentPlayers = () => ({
    batterId: inn.strikerId!,
    nonStrikerId: inn.nonStrikerId!,
    bowlerId: inn.currentBowlerId!,
  });

  const submitRuns = (batterRuns: number) => {
    if (busy || !inn.strikerId || !inn.nonStrikerId || !inn.currentBowlerId) return;
    actions.recordDelivery.mutate({ ...currentPlayers(), batterRuns });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (sheet) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (busy) return;
      if (e.key >= '0' && e.key <= '6') {
        e.preventDefault();
        submitRuns(Number(e.key));
      } else if (e.key.toLowerCase() === 'w') {
        e.preventDefault();
        setSheet('wicket');
      } else if (e.key.toLowerCase() === 'u') {
        e.preventDefault();
        setSheet('undo');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheet, busy, inn.strikerId, inn.nonStrikerId, inn.currentBowlerId]);

  if (status === 'COMPLETED' || presentation.matchComplete) {
    return (
      <MatchCompletePanel
        match={match}
        resultText={state.result?.resultText ?? match.resultText}
        matchId={matchId}
      />
    );
  }

  if (status !== 'LIVE') {
    return (
      <EmptyState
        title={
          status === 'ABANDONED'
            ? 'Match abandoned'
            : status === 'CANCELLED'
              ? 'Match cancelled'
              : 'Match not live'
        }
        description="Scoring controls are unavailable for this match status."
        action={
          <Link to={`/matches/${matchId}`} className="text-sm font-semibold text-primary">
            Back to match
          </Link>
        }
      />
    );
  }

  const keypadDock = !presentation.inningsComplete ? (
    <div
      ref={keypadRef}
      className={
        desktopLayout
          ? 'min-w-0'
          : 'fixed inset-x-0 bottom-0 z-20 border-t border-border-subtle bg-background px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom,0px))]'
      }
    >
      <ScoringKeypad
        disabled={busy}
        onRuns={submitRuns}
        onWicket={() => setSheet('wicket')}
        onWide={() => setSheet('wide')}
        onNoBall={() => setSheet('noBall')}
        onBye={() => setSheet('bye')}
        onLegBye={() => setSheet('legBye')}
        onUndo={() => setSheet('undo')}
      />
      {submitting || actions.recordDelivery.isPending ? (
        <p className="mt-2 text-center text-xs text-text-muted">
          {networkDown ? 'Saving locally…' : 'Submitting…'}
        </p>
      ) : networkDown ? (
        <p className="mt-2 text-center text-xs text-text-muted">
          Offline — taps are saved on this device
        </p>
      ) : null}
    </div>
  ) : null;

  return (
    <div className="mx-auto min-w-0 max-w-6xl space-y-4" data-testid="live-scoring-screen">
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="min-w-0">
          <Link
            to={`/matches/${matchId}`}
            className="block truncate text-sm text-text-muted hover:text-primary"
          >
            ← {match.name}
          </Link>
          <p className="text-xs text-text-muted">
            {match.rules.overs} overs · v{scoring.matchVersion}
          </p>
        </div>
        <Link
          to={`/matches/${matchId}/scorecard`}
          className="inline-flex h-10 shrink-0 items-center justify-center rounded-control border border-border px-3 text-sm font-semibold sm:h-auto sm:py-2"
        >
          Scorecard
        </Link>
      </div>

      <OfflineBanner />
      <SyncStatusPanel matchId={matchId} onRetry={() => void actions.retrySync()} />

      <div className="flex min-w-0 flex-col gap-4">
        <div className="order-2 min-w-0 lg:order-1">
          <LiveSharingPanel matchId={matchId} />
        </div>

        <div className="order-1 grid min-w-0 gap-4 lg:order-2 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-4">
          <ScoreHeader
            presentation={presentation}
            battingTeam={battingTeam}
            bowlingTeam={bowlingTeam}
            flash={lastFlash}
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <CurrentBatters
              innings={inn}
              scorecardInnings={scInn}
              playersById={playersById}
            />
            <CurrentBowler
              innings={inn}
              scorecardInnings={scInn}
              playersById={playersById}
              onSelectBowler={
                presentation.inningsComplete ? undefined : () => setSheet('bowler')
              }
            />
          </div>

          <Card>
            <CurrentOver presentation={presentation} recentDeliveries={recentDeliveries} />
          </Card>

          {presentation.inningsComplete ? (
            <Card className="space-y-3" data-testid="innings-complete">
              <h3 className="font-display text-xl font-semibold">Innings complete</h3>
              <p className="text-text-muted">
                {battingTeam.teamName} {presentation.totalRuns}/{presentation.wickets} (
                {presentation.oversDisplay} overs)
              </p>
              {presentation.inningsNumber === 1 ? (
                <Button onClick={() => setSheet('secondInnings')}>Continue to innings 2</Button>
              ) : null}
            </Card>
          ) : desktopLayout ? (
            keypadDock
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2 lg:hidden">
            <PartnershipCard
              partnership={inn.partnerships.find((p) => p.isActive)}
              playersById={playersById}
            />
            <RecentDeliveries
              deliveries={recentDeliveries}
              playersById={playersById}
              onSelect={(d) => {
                setSelectedDelivery(d);
                setSheet('deliveryDetail');
              }}
              compact
            />
          </div>
        </div>

        <aside className="hidden space-y-4 lg:block">
          <Card>
            <RecentDeliveries
              deliveries={recentDeliveries}
              playersById={playersById}
              onSelect={(d) => {
                setSelectedDelivery(d);
                setSheet('deliveryDetail');
              }}
            />
          </Card>
          <PartnershipCard
            partnership={inn.partnerships.find((p) => p.isActive)}
            playersById={playersById}
          />
        </aside>
        </div>
      </div>

      {!presentation.inningsComplete ? (
        <div className="md:hidden" style={{ height: keypadHeight }} aria-hidden />
      ) : null}

      {!desktopLayout && keypadDock ? createPortal(keypadDock, document.body) : null}

      <OpeningBattersSheet
        open={sheet === 'openings'}
        match={match}
        state={state}
        onClose={() => setSheet(null)}
        pending={actions.openings.isPending}
        onConfirm={(strikerId, nonStrikerId) =>
          actions.openings.mutate({ strikerId, nonStrikerId })
        }
      />

      <BowlerSelectSheet
        open={sheet === 'bowler'}
        match={match}
        state={state}
        onClose={() => setSheet(null)}
        pending={actions.bowler.isPending}
        onConfirm={(bowlerId) => actions.bowler.mutate(bowlerId)}
      />

      <ReplacementBatterSheet
        open={sheet === 'replacement'}
        match={match}
        state={state}
        onClose={() => setSheet(null)}
        pending={actions.replacement.isPending}
        onConfirm={(id) => actions.replacement.mutate(id)}
      />

      <ExtraRunsSheet
        open={sheet === 'wide'}
        title="Wide runs"
        options={[1, 2, 3, 4]}
        onClose={() => setSheet(null)}
        pending={actions.recordDelivery.isPending}
        onConfirm={(wide) => {
          if (!inn.strikerId || !inn.nonStrikerId || !inn.currentBowlerId) return;
          actions.recordDelivery.mutate({
            ...currentPlayers(),
            batterRuns: 0,
            extras: { wide },
          });
          setSheet(null);
        }}
      />

      <NoBallSheet
        open={sheet === 'noBall'}
        onClose={() => setSheet(null)}
        pending={actions.recordDelivery.isPending}
        onConfirm={(batterRuns) => {
          actions.recordDelivery.mutate({
            ...currentPlayers(),
            batterRuns,
            extras: { noBall: 1 },
          });
          setSheet(null);
        }}
      />

      <ExtraRunsSheet
        open={sheet === 'bye'}
        title="Bye runs"
        options={[1, 2, 3, 4, 5, 6]}
        onClose={() => setSheet(null)}
        pending={actions.recordDelivery.isPending}
        onConfirm={(bye) => {
          actions.recordDelivery.mutate({
            ...currentPlayers(),
            batterRuns: 0,
            extras: { bye },
          });
          setSheet(null);
        }}
      />

      <ExtraRunsSheet
        open={sheet === 'legBye'}
        title="Leg-bye runs"
        options={[1, 2, 3, 4, 5, 6]}
        onClose={() => setSheet(null)}
        pending={actions.recordDelivery.isPending}
        onConfirm={(legBye) => {
          actions.recordDelivery.mutate({
            ...currentPlayers(),
            batterRuns: 0,
            extras: { legBye },
          });
          setSheet(null);
        }}
      />

      <WicketSheet
        open={sheet === 'wicket'}
        match={match}
        state={state}
        onClose={() => setSheet(null)}
        pending={actions.recordDelivery.isPending}
        onConfirm={(w) => {
          actions.recordDelivery.mutate({
            ...currentPlayers(),
            batterRuns: 0,
            wicket: {
              wicketType: w.wicketType,
              playerOutId: w.playerOutId,
              fielderId: w.fielderId,
              runsCompleted: w.runsCompleted,
            },
            nextBatterId: w.nextBatterId,
          });
          setSheet(null);
        }}
      />

      <ConfirmDialog
        open={sheet === 'undo'}
        title="Undo last delivery?"
        description="Remove the last ball from the score. The match state updates immediately."
        confirmLabel="Undo"
        danger
        loading={actions.undo.isPending}
        onClose={() => setSheet(null)}
        onConfirm={() => actions.undo.mutate()}
      />

      <DeliveryDetailModal
        open={sheet === 'deliveryDetail'}
        delivery={selectedDelivery}
        playersById={playersById}
        onClose={() => setSheet(null)}
        canEdit={status === 'LIVE'}
        onEdit={() => {
          if (selectedDelivery) {
            setEditRuns(selectedDelivery.runs.batterRuns);
            setEditReason('');
            setSheet('editDelivery');
          }
        }}
      />

      <EditDeliveryDialog
        open={sheet === 'editDelivery'}
        delivery={selectedDelivery}
        editRuns={editRuns}
        setEditRuns={setEditRuns}
        editReason={editReason}
        setEditReason={setEditReason}
        pending={actions.editDelivery.isPending}
        onClose={() => setSheet(null)}
        onConfirm={() => {
          if (!selectedDelivery) return;
          actions.editDelivery.mutate({
            deliveryId: selectedDelivery.id,
            body: {
              expectedVersion: scoring.matchVersion,
              batterId: selectedDelivery.batterId,
              nonStrikerId: selectedDelivery.nonStrikerId,
              bowlerId: selectedDelivery.bowlerId,
              batterRuns: editRuns,
              extras: selectedDelivery.extras,
              wicket: selectedDelivery.wicket?.isWicket
                ? {
                    wicketType: selectedDelivery.wicket.wicketType!,
                    playerOutId: String(selectedDelivery.wicket.playerOutId),
                    fielderId: selectedDelivery.wicket.fielderId
                      ? String(selectedDelivery.wicket.fielderId)
                      : undefined,
                  }
                : null,
              reason: editReason || 'Correction from live scorer',
            },
          });
        }}
      />

      <SecondInningsSheet
        open={sheet === 'secondInnings'}
        match={match}
        state={state}
        target={presentation.target}
        pending={actions.startInnings.isPending}
        onClose={() => setSheet(null)}
        onConfirm={(body) => actions.startInnings.mutate(body)}
      />
    </div>
  );
}

function MatchCompletePanel({
  match,
  resultText,
  matchId,
}: {
  match: MatchDto;
  resultText: string | null;
  matchId: string;
}) {
  return (
    <Card className="mx-auto max-w-lg space-y-4 text-center" data-testid="match-complete">
      <p className="text-xs font-semibold uppercase tracking-wider text-primary">Match complete</p>
      <h2 className="font-display text-3xl font-bold">{resultText ?? 'Result recorded'}</h2>
      <p className="text-text-muted">
        {match.teamA.teamName} vs {match.teamB.teamName}
      </p>
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
        <Link
          to={`/matches/${matchId}/scorecard`}
          className="inline-flex h-11 items-center justify-center rounded-control bg-primary px-4 font-semibold text-background"
        >
          View scorecard
        </Link>
        <Link
          to="/dashboard"
          className="inline-flex h-11 items-center justify-center rounded-control border border-border px-4 font-semibold"
        >
          Back to dashboard
        </Link>
      </div>
    </Card>
  );
}

function EditDeliveryDialog({
  open,
  delivery,
  editRuns,
  setEditRuns,
  editReason,
  setEditReason,
  pending,
  onClose,
  onConfirm,
}: {
  open: boolean;
  delivery: DeliveryDto | null;
  editRuns: number;
  setEditRuns: (n: number) => void;
  editReason: string;
  setEditReason: (s: string) => void;
  pending?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (!delivery) return null;
  return (
    <ConfirmDialog
      open={open}
      title="Edit delivery"
      description={`Change batter runs for ${delivery.overNumber}.${delivery.ballNumber}. State will rebuild from the server.`}
      confirmLabel={pending ? 'Saving…' : 'Save correction'}
      loading={pending}
      onClose={onClose}
      onConfirm={onConfirm}
    >
      <div className="mb-3 space-y-3">
        <div className="flex flex-wrap gap-2">
          {[0, 1, 2, 3, 4, 5, 6].map((n) => (
            <button
              key={n}
              type="button"
              className={
                editRuns === n
                  ? 'min-h-10 min-w-10 rounded-control border border-primary bg-primary-muted font-bold'
                  : 'min-h-10 min-w-10 rounded-control border border-border-subtle font-bold'
              }
              onClick={() => setEditRuns(n)}
            >
              {n}
            </button>
          ))}
        </div>
        <label className="block text-sm">
          <span className="text-text-muted">Reason</span>
          <input
            className="mt-1 w-full rounded-control border border-border bg-surface-elevated px-3 py-2"
            value={editReason}
            onChange={(e) => setEditReason(e.target.value)}
            placeholder="Optional correction note"
          />
        </label>
      </div>
    </ConfirmDialog>
  );
}

function SecondInningsSheet({
  open,
  match,
  state,
  target,
  pending,
  onClose,
  onConfirm,
}: {
  open: boolean;
  match: MatchDto;
  state: ScoringStateResponse['state'];
  target: number | null;
  pending?: boolean;
  onClose: () => void;
  onConfirm: (body: { strikerId: string; nonStrikerId: string; bowlerId: string }) => void;
}) {
  const inn0 = state.innings[0];
  const battingTeamId = inn0.bowlingTeamId;
  const bowlingTeamId = inn0.battingTeamId;
  const battingXi =
    match.teamA.teamId === battingTeamId ? match.teamA.playingXi : match.teamB.playingXi;
  const bowlingXi =
    match.teamA.teamId === bowlingTeamId ? match.teamA.playingXi : match.teamB.playingXi;

  const [strikerId, setStrikerId] = useState(battingXi[0]?.playerId ?? '');
  const [nonStrikerId, setNonStrikerId] = useState(battingXi[1]?.playerId ?? '');
  const [bowlerId, setBowlerId] = useState(bowlingXi[0]?.playerId ?? '');

  return (
    <ConfirmDialog
      open={open}
      title="Start second innings"
      description={`Target ${target ?? '—'}. Select openings and bowler.`}
      confirmLabel={pending ? 'Starting…' : 'Start innings'}
      loading={pending}
      onClose={onClose}
      onConfirm={() => onConfirm({ strikerId, nonStrikerId, bowlerId })}
    >
      <div className="mb-3 space-y-3 text-sm">
        <label className="block">
          Striker
          <select
            className="mt-1 w-full rounded-control border border-border bg-surface-elevated px-3 py-2"
            value={strikerId}
            onChange={(e) => setStrikerId(e.target.value)}
          >
            {battingXi.map((p) => (
              <option key={p.playerId} value={p.playerId}>
                {p.playerName}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          Non-striker
          <select
            className="mt-1 w-full rounded-control border border-border bg-surface-elevated px-3 py-2"
            value={nonStrikerId}
            onChange={(e) => setNonStrikerId(e.target.value)}
          >
            {battingXi.map((p) => (
              <option key={p.playerId} value={p.playerId}>
                {p.playerName}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          Opening bowler
          <select
            className="mt-1 w-full rounded-control border border-border bg-surface-elevated px-3 py-2"
            value={bowlerId}
            onChange={(e) => setBowlerId(e.target.value)}
          >
            {bowlingXi.map((p) => (
              <option key={p.playerId} value={p.playerId}>
                {p.playerName}
              </option>
            ))}
          </select>
        </label>
      </div>
    </ConfirmDialog>
  );
}

export function LiveScoringSkeleton() {
  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <Skeleton className="h-36 w-full" />
      <div className="grid gap-3 sm:grid-cols-2">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
      <Skeleton className="h-48 w-full" />
    </div>
  );
}
