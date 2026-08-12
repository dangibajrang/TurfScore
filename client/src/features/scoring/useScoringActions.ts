import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef } from 'react';
import { matchesApi } from '@/features/matches/matchesApi';
import type { MatchDto } from '@/features/matches/types';
import { submitScoringCommand } from '@/features/offline/submitCommand';
import { useOfflineConnectivity } from '@/features/offline/useOfflineConnectivity';
import { persistServerSnapshot, syncMatchQueue } from '@/features/offline/sync';
import { useOfflineUiStore } from '@/features/offline/offlineUiStore';
import { useUiStore } from '@/stores/uiStore';
import { createEventId } from './eventId';
import { isVersionConflict, scoringErrorMessage } from './errorMessages';
import { scoringApi } from './scoringApi';
import { scoringKeys } from './scoringKeys';
import { useScoringUiStore } from './scoringUiStore';
import type { DeliveryCommandPayload, ScoringStateResponse } from './types';

export function useMatchMeta(matchId: string) {
  return useQuery({
    queryKey: scoringKeys.match(matchId),
    queryFn: () => matchesApi.get(matchId),
    enabled: !!matchId,
  });
}

export function useScoringState(matchId: string) {
  return useQuery({
    queryKey: scoringKeys.state(matchId),
    queryFn: () => scoringApi.getState(matchId),
    enabled: !!matchId,
    refetchOnWindowFocus: false,
  });
}

export function useScorecardQuery(matchId: string) {
  return useQuery({
    queryKey: scoringKeys.scorecard(matchId),
    queryFn: () => scoringApi.getScorecard(matchId),
    enabled: !!matchId,
  });
}

export function useScoringActions(matchId: string) {
  const qc = useQueryClient();
  const showToast = useUiStore((s) => s.showToast);
  const setSubmitting = useScoringUiStore((s) => s.setSubmitting);
  const setLastFlash = useScoringUiStore((s) => s.setLastFlash);
  const setSheet = useScoringUiStore((s) => s.setSheet);
  const inFlight = useRef<string | null>(null);
  const offlineChain = useRef(Promise.resolve());

  useOfflineConnectivity(matchId);

  const invalidate = useCallback(async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: scoringKeys.state(matchId) }),
      qc.invalidateQueries({ queryKey: scoringKeys.scorecard(matchId) }),
      qc.invalidateQueries({ queryKey: scoringKeys.match(matchId) }),
    ]);
  }, [qc, matchId]);

  const refreshState = useCallback(async () => {
    const data = await qc.fetchQuery({
      queryKey: scoringKeys.state(matchId),
      queryFn: () => scoringApi.getState(matchId),
    });
    const match = qc.getQueryData<MatchDto>(scoringKeys.match(matchId));
    if (match && data) {
      await persistServerSnapshot(matchId, match, data);
    }
    return data;
  }, [qc, matchId]);

  const applyStateCache = useCallback(
    (partial: Partial<ScoringStateResponse> & { matchVersion: number; state: ScoringStateResponse['state'] }) => {
      qc.setQueryData<ScoringStateResponse>(scoringKeys.state(matchId), (prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          ...partial,
          matchVersion: partial.matchVersion,
          state: partial.state,
          scorecard: partial.scorecard ?? prev.scorecard,
          presentation: partial.presentation ?? prev.presentation,
          recentDeliveries: partial.recentDeliveries ?? prev.recentDeliveries,
          status: partial.state.status,
        };
      });
    },
    [qc, matchId],
  );

  const applyProjectedOffline = useCallback(
    (
      presentation: ScoringStateResponse['presentation'],
      state: ScoringStateResponse['state'],
    ) => {
      qc.setQueryData<ScoringStateResponse>(scoringKeys.state(matchId), (prev) => {
        if (!prev) return prev;
        return { ...prev, presentation, state };
      });
    },
    [qc, matchId],
  );

  const applyProjectedPresentation = useCallback(
    (presentation: ScoringStateResponse['presentation']) => {
      qc.setQueryData<ScoringStateResponse>(scoringKeys.state(matchId), (prev) => {
        if (!prev) return prev;
        return { ...prev, presentation };
      });
    },
    [qc, matchId],
  );

  const requireContext = useCallback(() => {
    const snapshot = qc.getQueryData<ScoringStateResponse>(scoringKeys.state(matchId));
    const match = qc.getQueryData<MatchDto>(scoringKeys.match(matchId));
    if (!snapshot || !match) {
      throw new Error('Match scoring state is not loaded yet.');
    }
    return {
      snapshot,
      match,
      expectedVersion: snapshot.matchVersion ?? snapshot.state.version ?? 0,
    };
  }, [qc, matchId]);

  const runCommand = useCallback(
    async (payload: Parameters<typeof submitScoringCommand>[0]['payload'], eventId?: string) => {
      const execute = async () => {
        const { snapshot, match, expectedVersion } = requireContext();
        const offlineNow =
          (typeof navigator !== 'undefined' && !navigator.onLine) ||
          useOfflineUiStore.getState().connection === 'OFFLINE';
        // Online: serialize one in-flight request. Offline: chained below so strike IDs stay ordered.
        if (inFlight.current && !offlineNow) {
          throw new Error('A scoring action is already being submitted.');
        }
        const eid = eventId ?? createEventId(payload.type === 'DELIVERY' ? 'del' : 'cmd');
        if (!offlineNow) inFlight.current = eid;
        setSubmitting(true);
        try {
          const outcome = await submitScoringCommand({
            matchId,
            payload,
            eventId: eid,
            expectedVersion,
            match,
            snapshot,
            forceQueue: offlineNow,
          });
          // Apply crease projection before the next offline command reads cache.
          if (outcome.mode === 'queued') {
            qc.setQueryData<ScoringStateResponse>(scoringKeys.state(matchId), (prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                presentation: outcome.projectedPresentation,
                state: outcome.projectedState,
              };
            });
          }
          return outcome;
        } finally {
          if (inFlight.current === eid) inFlight.current = null;
          setSubmitting(false);
        }
      };

      const offlineNow =
        (typeof navigator !== 'undefined' && !navigator.onLine) ||
        useOfflineUiStore.getState().connection === 'OFFLINE';

      if (offlineNow) {
        // Serialize offline taps so each command sees updated striker after prior projection.
        const next = offlineChain.current.then(execute, execute);
        offlineChain.current = next.then(
          () => undefined,
          () => undefined,
        );
        return next;
      }

      return execute();
    },
    [matchId, requireContext, setSubmitting, qc],
  );

  const recordDelivery = useMutation({
    networkMode: 'always',
    mutationFn: async (
      input: Omit<DeliveryCommandPayload, 'eventId' | 'expectedVersion'> & { eventId?: string },
    ) => {
      const { eventId: _e, ...body } = input as DeliveryCommandPayload & { eventId?: string };
      return runCommand({ type: 'DELIVERY', body }, input.eventId);
    },
    onSuccess: async (outcome, vars) => {
      if (outcome.mode === 'queued') {
        applyProjectedOffline(outcome.projectedPresentation, outcome.projectedState);
        showToast('Saved locally — waiting to sync');
        const runs = vars.batterRuns ?? 0;
        if (vars.wicket) setLastFlash('wicket');
        else if (runs === 6) setLastFlash('six');
        else if (runs === 4) setLastFlash('four');
        else setLastFlash(null);
        if (vars.wicket) setSheet('replacement');
        return;
      }

      const data = outcome.response as {
        result?: {
          overCompleted?: boolean;
          needsNewBatter?: boolean;
          needsNewBowler?: boolean;
          inningsCompleted?: boolean;
          matchCompleted?: boolean;
        };
        state?: { result?: { resultText?: string | null } };
        matchVersion?: number;
        scorecard?: ScoringStateResponse['scorecard'];
        presentation?: ScoringStateResponse['presentation'];
      };

      // Prefer response payload — avoid hanging refetch if the network drops mid-success.
      if (data.state && data.matchVersion != null) {
        applyStateCache({
          matchVersion: data.matchVersion,
          state: data.state as ScoringStateResponse['state'],
          scorecard: data.scorecard,
          presentation: data.presentation,
          recentDeliveries: undefined,
        });
      }
      void invalidate();

      const runs = vars.batterRuns ?? 0;
      if (vars.wicket) setLastFlash('wicket');
      else if (runs === 6) setLastFlash('six');
      else if (runs === 4) setLastFlash('four');
      else if (data.result?.overCompleted) setLastFlash('over');
      else setLastFlash(null);
      if (data.result?.overCompleted) showToast('Over complete — select next bowler');
      if (data.result?.needsNewBatter) {
        setSheet('replacement');
        showToast('Select replacement batter');
      } else if (data.result?.needsNewBowler) {
        setSheet('bowler');
      } else if (data.result?.inningsCompleted && !data.result.matchCompleted) {
        setSheet('secondInnings');
        showToast('Innings complete');
      } else if (data.result?.matchCompleted) {
        showToast(data.state?.result?.resultText ?? 'Match complete');
      }
    },
    onError: async (err) => {
      showToast(scoringErrorMessage(err));
      if (isVersionConflict(err)) await refreshState();
    },
  });

  const openings = useMutation({
    networkMode: 'always',
    mutationFn: async (body: { strikerId: string; nonStrikerId: string }) => {
      return runCommand({ type: 'SET_OPENINGS', body });
    },
    onSuccess: async (outcome) => {
      if (outcome.mode === 'queued') {
        applyProjectedPresentation(outcome.projectedPresentation);
        showToast('Openings saved locally');
        setSheet('bowler');
        return;
      }
      showToast('Opening batters selected');
      setSheet(null);
      await invalidate();
      setSheet('bowler');
    },
    onError: async (err) => {
      showToast(scoringErrorMessage(err));
      if (isVersionConflict(err)) await refreshState();
    },
  });

  const bowler = useMutation({
    networkMode: 'always',
    mutationFn: async (bowlerId: string) => {
      return runCommand({ type: 'SELECT_BOWLER', body: { bowlerId } });
    },
    onSuccess: async (outcome) => {
      if (outcome.mode === 'queued') {
        applyProjectedPresentation(outcome.projectedPresentation);
        showToast('Bowler saved locally');
        setSheet(null);
        return;
      }
      showToast('Bowler selected');
      setSheet(null);
      await invalidate();
    },
    onError: async (err) => {
      showToast(scoringErrorMessage(err));
      if (isVersionConflict(err)) await refreshState();
    },
  });

  const replacement = useMutation({
    networkMode: 'always',
    mutationFn: async (nextBatterId: string) => {
      return runCommand({ type: 'SELECT_BATTER', body: { nextBatterId } });
    },
    onSuccess: async (outcome) => {
      if (outcome.mode === 'queued') {
        applyProjectedPresentation(outcome.projectedPresentation);
        showToast('Batter saved locally');
        setSheet(null);
        return;
      }
      showToast('New batter in');
      setSheet(null);
      await invalidate();
    },
    onError: async (err) => {
      showToast(scoringErrorMessage(err));
      if (isVersionConflict(err)) await refreshState();
    },
  });

  const undo = useMutation({
    networkMode: 'always',
    mutationFn: async () => {
      return runCommand({ type: 'UNDO', body: {} });
    },
    onSuccess: async (outcome) => {
      if (outcome.mode === 'queued') {
        showToast('Undo queued — will sync in order');
        setSheet(null);
        return;
      }
      showToast('Last delivery undone');
      setSheet(null);
      await invalidate();
    },
    onError: async (err) => {
      showToast(scoringErrorMessage(err));
      if (isVersionConflict(err)) await refreshState();
    },
  });

  const startInnings = useMutation({
    networkMode: 'always',
    mutationFn: async (body: {
      strikerId: string;
      nonStrikerId: string;
      bowlerId: string;
    }) => {
      return runCommand({ type: 'START_INNINGS', body });
    },
    onSuccess: async (outcome) => {
      if (outcome.mode === 'queued') {
        applyProjectedPresentation(outcome.projectedPresentation);
        showToast('Innings start saved locally');
        setSheet(null);
        return;
      }
      showToast('Second innings started');
      setSheet(null);
      await invalidate();
    },
    onError: async (err) => {
      showToast(scoringErrorMessage(err));
      if (isVersionConflict(err)) await refreshState();
    },
  });

  const editDelivery = useMutation({
    mutationFn: async (input: {
      deliveryId: string;
      body: Parameters<typeof scoringApi.editDelivery>[2];
    }) => {
      // Edits of server-confirmed deliveries stay online-only (Phase 8 rule).
      setSubmitting(true);
      try {
        const cached = qc.getQueryData<ScoringStateResponse>(scoringKeys.state(matchId));
        return await scoringApi.editDelivery(matchId, input.deliveryId, {
          ...input.body,
          expectedVersion: input.body.expectedVersion ?? cached?.matchVersion ?? 0,
        });
      } finally {
        setSubmitting(false);
      }
    },
    onSuccess: async () => {
      showToast('Delivery corrected');
      setSheet(null);
      await invalidate();
    },
    onError: async (err) => {
      showToast(scoringErrorMessage(err));
      if (isVersionConflict(err)) await refreshState();
    },
  });

  const retrySync = useCallback(async () => {
    useOfflineUiStore.getState().setConflictPausedMatchId(null);
    useOfflineUiStore.getState().setAuthPaused(false);
    const cached = qc.getQueryData<ScoringStateResponse>(scoringKeys.state(matchId));
    await syncMatchQueue(matchId, {
      initialVersion: cached?.matchVersion,
      onAuthoritative: async () => {
        await refreshState();
      },
    });
    await refreshState();
  }, [matchId, qc, refreshState]);

  return {
    recordDelivery,
    openings,
    bowler,
    replacement,
    undo,
    startInnings,
    editDelivery,
    invalidate,
    refreshState,
    applyStateCache,
    retrySync,
  };
}
