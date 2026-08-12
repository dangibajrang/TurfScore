import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, Input, Select, Skeleton } from '@/components/ui';
import { teamsApi } from '@/features/teams/teamsApi';
import { useUiStore } from '@/stores/uiStore';
import { ApiError } from '@/lib/apiClient';
import { matchesApi } from './matchesApi';
import { WizardProgress } from './components/WizardProgress';
import { TeamSelector } from './components/TeamSelector';
import { PlayingXiPicker } from './components/PlayingXiPicker';
import {
  createInitialWizardState,
  detailsSchema,
  scheduledAtFromWizard,
  validateTeamsStep,
  validateTossStep,
  validateXiStep,
} from './schemas';
import {
  OVER_PRESETS,
  PLAYERS_PER_SIDE_OPTIONS,
  buildRulePreset,
  defaultMaxOversPerBowler,
  type RulePresetId,
} from './rulePresets';
import type { CreateMatchPayload, MatchDto, WizardState } from './types';

const STEP_COUNT = 6;

function wizardStateFromMatch(m: MatchDto): WizardState {
  const scheduled = m.scheduledAt ? new Date(m.scheduledAt) : new Date();
  return {
    name: m.name,
    description: m.description ?? '',
    venue: m.venue ?? '',
    date: scheduled.toISOString().slice(0, 10),
    time: scheduled.toISOString().slice(11, 16),
    teamAId: m.teamA.teamId,
    teamBId: m.teamB.teamId,
    rules: {
      overs: m.rules.overs,
      ballsPerOver: m.rules.ballsPerOver,
      playersPerSide: m.rules.playersPerSide,
      maxOversPerBowler: m.rules.maxOversPerBowler,
      powerplayEnabled: m.rules.powerplayEnabled,
      powerplayOvers: m.rules.powerplayOvers,
      superOverEnabled: m.rules.superOverEnabled,
    },
    teamAXi: m.teamA.playingXi.map((e) => ({
      playerId: e.playerId,
      role: (e.role as WizardState['teamAXi'][number]['role']) ?? undefined,
      battingOrder: e.battingOrder,
      isWicketKeeper: e.isWicketKeeper,
      isCaptain: e.isCaptain,
      isViceCaptain: e.isViceCaptain,
    })),
    teamBXi: m.teamB.playingXi.map((e) => ({
      playerId: e.playerId,
      role: (e.role as WizardState['teamBXi'][number]['role']) ?? undefined,
      battingOrder: e.battingOrder,
      isWicketKeeper: e.isWicketKeeper,
      isCaptain: e.isCaptain,
      isViceCaptain: e.isViceCaptain,
    })),
    tossWinnerId: m.toss?.wonByTeamId ?? '',
    tossDecision: m.toss?.decision ?? '',
  };
}

export function MatchCreateWizard({ mode = 'create' }: { mode?: 'create' | 'edit' }) {
  const { id } = useParams();
  const existing = useQuery({
    queryKey: ['match', id],
    queryFn: () => matchesApi.get(id!),
    enabled: mode === 'edit' && !!id,
  });

  if (mode === 'edit') {
    if (existing.isLoading) return <Skeleton className="mx-auto h-96 max-w-4xl w-full" />;
    if (!existing.data) {
      return (
        <Card className="mx-auto max-w-xl">
          <p className="text-sm">Match not found.</p>
          <Link to="/matches" className="text-sm font-semibold text-primary">
            Back to matches
          </Link>
        </Card>
      );
    }
    if (!['DRAFT', 'UPCOMING'].includes(existing.data.status)) {
      return (
        <Card className="mx-auto max-w-xl space-y-3">
          <h2 className="font-display text-xl font-semibold">Match is locked</h2>
          <p className="text-sm text-text-muted">
            {existing.data.status} matches cannot be edited in the setup wizard.
          </p>
          <Link to={`/matches/${id}`} className="text-sm font-semibold text-primary">
            View match
          </Link>
        </Card>
      );
    }
    return (
      <WizardForm
        key={existing.data.id}
        mode="edit"
        matchId={id!}
        initial={wizardStateFromMatch(existing.data)}
      />
    );
  }

  return <WizardForm mode="create" initial={createInitialWizardState()} />;
}

function WizardForm({
  mode,
  matchId,
  initial,
}: {
  mode: 'create' | 'edit';
  matchId?: string;
  initial: WizardState;
}) {
  const navigate = useNavigate();
  const showToast = useUiStore((s) => s.showToast);
  const qc = useQueryClient();
  const [step, setStep] = useState(1);
  const [state, setState] = useState<WizardState>(initial);
  const [dirty, setDirty] = useState(false);
  const [stepError, setStepError] = useState<string | null>(null);

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!dirty) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  const patch = (partial: Partial<WizardState>) => {
    setDirty(true);
    setStepError(null);
    setState((s) => ({ ...s, ...partial }));
  };

  const teamAQuery = useQuery({
    queryKey: ['team', state.teamAId],
    queryFn: () => teamsApi.get(state.teamAId),
    enabled: !!state.teamAId,
  });
  const teamBQuery = useQuery({
    queryKey: ['team', state.teamBId],
    queryFn: () => teamsApi.get(state.teamBId),
    enabled: !!state.teamBId,
  });

  const payload = useMemo((): CreateMatchPayload => {
    return {
      name: state.name.trim(),
      description: state.description.trim() || undefined,
      venue: state.venue.trim(),
      scheduledAt: scheduledAtFromWizard(state),
      teamA: { teamId: state.teamAId, playingXi: state.teamAXi },
      teamB: { teamId: state.teamBId, playingXi: state.teamBXi },
      rules: state.rules,
      toss:
        state.tossWinnerId && state.tossDecision
          ? { wonByTeamId: state.tossWinnerId, decision: state.tossDecision }
          : undefined,
    };
  }, [state]);

  const saveDraft = useMutation({
    mutationFn: async () => {
      const body = { ...payload, status: 'DRAFT' as const };
      if (mode === 'edit' && matchId) return matchesApi.update(matchId, body);
      return matchesApi.create(body);
    },
    onSuccess: (match) => {
      setDirty(false);
      void qc.invalidateQueries({ queryKey: ['matches'] });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
      showToast('Draft saved');
      navigate(`/matches/${match.id}`);
    },
    onError: (e) => showToast(e instanceof ApiError ? e.message : 'Could not save draft'),
  });

  const startMatch = useMutation({
    mutationFn: async () => {
      if (mode === 'edit' && matchId) {
        await matchesApi.update(matchId, { ...payload, status: 'UPCOMING' });
        return matchesApi.start(matchId);
      }
      return matchesApi.create({ ...payload, startNow: true });
    },
    onSuccess: (match) => {
      setDirty(false);
      void qc.invalidateQueries({ queryKey: ['matches'] });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
      showToast('Match is LIVE');
      navigate(`/matches/${match.id}`);
    },
    onError: (e) => showToast(e instanceof ApiError ? e.message : 'Could not start match'),
  });

  const validateCurrent = (): boolean => {
    if (step === 1) {
      const parsed = detailsSchema.safeParse({
        name: state.name,
        venue: state.venue,
        date: state.date,
        time: state.time,
        description: state.description,
      });
      if (!parsed.success) {
        setStepError(parsed.error.issues[0]?.message ?? 'Invalid details');
        return false;
      }
    }
    if (step === 2) {
      const err = validateTeamsStep(state);
      if (err) {
        setStepError(err);
        return false;
      }
    }
    if (step === 4) {
      const err = validateXiStep(state);
      if (err) {
        setStepError(err);
        return false;
      }
    }
    if (step === 5) {
      const err = validateTossStep(state);
      if (err) {
        setStepError(err);
        return false;
      }
    }
    setStepError(null);
    return true;
  };

  const goNext = () => {
    if (!validateCurrent()) return;
    setStep((s) => Math.min(STEP_COUNT, s + 1));
  };

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 lg:flex-row">
      <div className="min-w-0 flex-1 space-y-4">
        <WizardProgress step={step} />

        {step === 1 ? (
          <Card className="space-y-4">
            <h2 className="font-display text-xl font-semibold">Match details</h2>
            <Input
              label="Match name"
              value={state.name}
              onChange={(e) => patch({ name: e.target.value })}
            />
            <Input
              label="Venue"
              value={state.venue}
              onChange={(e) => patch({ venue: e.target.value })}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                label="Date"
                type="date"
                value={state.date}
                onChange={(e) => patch({ date: e.target.value })}
              />
              <Input
                label="Time"
                type="time"
                value={state.time}
                onChange={(e) => patch({ time: e.target.value })}
              />
            </div>
            <Input
              label="Description (optional)"
              value={state.description}
              onChange={(e) => patch({ description: e.target.value })}
            />
          </Card>
        ) : null}

        {step === 2 ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <TeamSelector
                label="Team A"
                value={state.teamAId}
                excludeId={state.teamBId}
                onChange={(teamAId) => patch({ teamAId, teamAXi: [], tossWinnerId: '' })}
              />
            </Card>
            <Card>
              <TeamSelector
                label="Team B"
                value={state.teamBId}
                excludeId={state.teamAId}
                onChange={(teamBId) => patch({ teamBId, teamBXi: [], tossWinnerId: '' })}
              />
            </Card>
          </div>
        ) : null}

        {step === 3 ? (
          <Card className="space-y-4">
            <h2 className="font-display text-xl font-semibold">Match rules</h2>
            <div>
              <p className="mb-2 text-sm font-semibold">Overs preset</p>
              <div className="flex flex-wrap gap-2">
                {OVER_PRESETS.map((id) => (
                  <Button
                    key={id}
                    size="sm"
                    variant={state.rules.overs === Number(id) ? 'primary' : 'secondary'}
                    onClick={() => patch({ rules: buildRulePreset(id as RulePresetId), teamAXi: [], teamBXi: [] })}
                  >
                    {id}
                  </Button>
                ))}
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                label="Overs"
                type="number"
                min={1}
                max={50}
                value={state.rules.overs}
                onChange={(e) => {
                  const overs = Number(e.target.value);
                  patch({
                    rules: {
                      ...state.rules,
                      overs,
                      maxOversPerBowler: defaultMaxOversPerBowler(overs),
                    },
                    teamAXi: [],
                    teamBXi: [],
                  });
                }}
              />
              <Input
                label="Balls per over"
                type="number"
                min={1}
                max={12}
                value={state.rules.ballsPerOver}
                onChange={(e) =>
                  patch({ rules: { ...state.rules, ballsPerOver: Number(e.target.value) } })
                }
              />
              <Select
                label="Players per side"
                options={PLAYERS_PER_SIDE_OPTIONS.map((n) => ({
                  value: String(n),
                  label: String(n),
                }))}
                value={String(state.rules.playersPerSide)}
                onChange={(e) =>
                  patch({
                    rules: { ...state.rules, playersPerSide: Number(e.target.value) },
                    teamAXi: [],
                    teamBXi: [],
                  })
                }
              />
              <Input
                label="Max overs / bowler"
                type="number"
                min={1}
                value={state.rules.maxOversPerBowler ?? defaultMaxOversPerBowler(state.rules.overs)}
                onChange={(e) =>
                  patch({
                    rules: { ...state.rules, maxOversPerBowler: Number(e.target.value) },
                  })
                }
              />
            </div>
            <label className="flex min-h-[44px] items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={Boolean(state.rules.powerplayEnabled)}
                onChange={(e) =>
                  patch({
                    rules: {
                      ...state.rules,
                      powerplayEnabled: e.target.checked,
                      powerplayOvers: e.target.checked
                        ? state.rules.powerplayOvers || Math.min(2, state.rules.overs)
                        : 0,
                    },
                  })
                }
              />
              Powerplay enabled
            </label>
            {state.rules.powerplayEnabled ? (
              <Input
                label="Powerplay overs"
                type="number"
                min={1}
                max={state.rules.overs}
                value={state.rules.powerplayOvers ?? 0}
                onChange={(e) =>
                  patch({ rules: { ...state.rules, powerplayOvers: Number(e.target.value) } })
                }
              />
            ) : null}
            <label className="flex min-h-[44px] items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={Boolean(state.rules.superOverEnabled)}
                onChange={(e) =>
                  patch({ rules: { ...state.rules, superOverEnabled: e.target.checked } })
                }
              />
              Super over enabled
            </label>
          </Card>
        ) : null}

        {step === 4 ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <PlayingXiPicker
              teamId={state.teamAId}
              teamLabel={teamAQuery.data?.name ?? 'Team A'}
              playersPerSide={state.rules.playersPerSide}
              value={state.teamAXi}
              onChange={(teamAXi) => patch({ teamAXi })}
            />
            <PlayingXiPicker
              teamId={state.teamBId}
              teamLabel={teamBQuery.data?.name ?? 'Team B'}
              playersPerSide={state.rules.playersPerSide}
              value={state.teamBXi}
              onChange={(teamBXi) => patch({ teamBXi })}
            />
          </div>
        ) : null}

        {step === 5 ? (
          <Card className="space-y-4">
            <h2 className="font-display text-xl font-semibold">Toss</h2>
            <p className="text-sm text-text-muted">Who won the toss?</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {[
                { id: state.teamAId, name: teamAQuery.data?.name ?? 'Team A' },
                { id: state.teamBId, name: teamBQuery.data?.name ?? 'Team B' },
              ].map((t) => (
                <Button
                  key={t.id}
                  variant={state.tossWinnerId === t.id ? 'primary' : 'secondary'}
                  className="min-h-[44px]"
                  onClick={() => patch({ tossWinnerId: t.id })}
                >
                  {t.name}
                </Button>
              ))}
            </div>
            <p className="text-sm text-text-muted">They chose to</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {(['BAT', 'BOWL'] as const).map((d) => (
                <Button
                  key={d}
                  variant={state.tossDecision === d ? 'primary' : 'secondary'}
                  className="min-h-[44px]"
                  onClick={() => patch({ tossDecision: d })}
                >
                  {d === 'BAT' ? 'Bat' : 'Bowl'}
                </Button>
              ))}
            </div>
            {state.tossWinnerId && state.tossDecision ? (
              <p className="rounded-control bg-primary-muted px-3 py-2 text-sm font-medium text-primary">
                {(state.tossWinnerId === state.teamAId
                  ? teamAQuery.data?.name
                  : teamBQuery.data?.name) ?? 'Winner'}{' '}
                won the toss and chose to {state.tossDecision === 'BAT' ? 'bat' : 'bowl'}.
              </p>
            ) : null}
          </Card>
        ) : null}

        {step === 6 ? (
          <Card className="space-y-4">
            <h2 className="font-display text-xl font-semibold">Review & start</h2>
            <div className="space-y-2 text-sm">
              <p>
                <span className="text-text-muted">Match:</span> {state.name}
              </p>
              <p>
                <span className="text-text-muted">Venue:</span> {state.venue}
              </p>
              <p>
                <span className="text-text-muted">When:</span> {state.date} · {state.time}
              </p>
              <p>
                <span className="text-text-muted">Teams:</span>{' '}
                {teamAQuery.data?.name ?? 'Team A'} vs {teamBQuery.data?.name ?? 'Team B'}
              </p>
              <p>
                <span className="text-text-muted">Rules:</span> {state.rules.overs} overs ·{' '}
                {state.rules.ballsPerOver} balls/over · {state.rules.playersPerSide} players ·{' '}
                {state.rules.maxOversPerBowler ?? defaultMaxOversPerBowler(state.rules.overs)}{' '}
                overs/bowler
              </p>
              <p>
                <span className="text-text-muted">Toss:</span>{' '}
                {(state.tossWinnerId === state.teamAId
                  ? teamAQuery.data?.name
                  : teamBQuery.data?.name) ?? '—'}{' '}
                chose to {state.tossDecision === 'BAT' ? 'bat' : 'bowl'}
              </p>
              <p>
                <span className="text-text-muted">Playing XI:</span> {state.teamAXi.length} /{' '}
                {state.teamBXi.length} selected
              </p>
            </div>
          </Card>
        ) : null}

        {stepError ? (
          <p className="rounded-control border border-danger/40 bg-danger-muted px-3 py-2 text-sm text-danger">
            {stepError}
          </p>
        ) : null}

        <div className="sticky bottom-[calc(var(--bottom-nav-height)+8px)] z-20 flex flex-wrap gap-2 rounded-card border border-border-subtle bg-background/95 p-3 backdrop-blur md:static md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
          <Button
            variant="secondary"
            disabled={step === 1 || startMatch.isPending || saveDraft.isPending}
            onClick={() => {
              setStepError(null);
              setStep((s) => Math.max(1, s - 1));
            }}
          >
            Back
          </Button>
          {step < STEP_COUNT ? (
            <Button className="flex-1" onClick={goNext}>
              Continue
            </Button>
          ) : (
            <>
              <Button
                variant="secondary"
                disabled={saveDraft.isPending || startMatch.isPending}
                onClick={() => {
                  const d = detailsSchema.safeParse({
                    name: state.name,
                    venue: state.venue,
                    date: state.date,
                    time: state.time,
                    description: state.description,
                  });
                  const t = validateTeamsStep(state);
                  if (!d.success) {
                    setStepError(d.error.issues[0]?.message ?? 'Invalid details');
                    return;
                  }
                  if (t) {
                    setStepError(t);
                    return;
                  }
                  saveDraft.mutate();
                }}
              >
                {saveDraft.isPending ? 'Saving…' : 'Save Draft'}
              </Button>
              <Button
                className="flex-1"
                disabled={startMatch.isPending || saveDraft.isPending}
                onClick={() => {
                  const err =
                    validateTeamsStep(state) ||
                    validateXiStep(state) ||
                    validateTossStep(state);
                  if (err) {
                    setStepError(err);
                    return;
                  }
                  startMatch.mutate();
                }}
              >
                {startMatch.isPending ? 'Starting…' : 'Start Match'}
              </Button>
            </>
          )}
        </div>
      </div>

      <aside className="hidden w-72 shrink-0 lg:block">
        <Card className="sticky top-24 space-y-2 text-sm">
          <p className="font-semibold">Setup summary</p>
          <p className="text-text-muted">{state.name || 'Untitled match'}</p>
          <p className="text-text-muted">
            {teamAQuery.data?.shortName || 'A'} vs {teamBQuery.data?.shortName || 'B'}
          </p>
          <p className="text-text-muted">{state.rules.overs} overs</p>
          <p className="text-text-muted">Step {step} of {STEP_COUNT}</p>
        </Card>
      </aside>
    </div>
  );
}
