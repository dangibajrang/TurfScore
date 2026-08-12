import { z } from 'zod';
import type { WizardState } from './types';
import { buildRulePreset } from './rulePresets';

export const detailsSchema = z.object({
  name: z.string().trim().min(2, 'Match name is required').max(160),
  venue: z.string().trim().min(1, 'Venue is required').max(200),
  date: z.string().min(1, 'Date is required'),
  time: z.string().min(1, 'Time is required'),
  description: z.string().trim().max(500).optional(),
});

export function createInitialWizardState(): WizardState {
  const today = new Date();
  const date = today.toISOString().slice(0, 10);
  return {
    name: '',
    description: '',
    venue: '',
    date,
    time: '18:00',
    teamAId: '',
    teamBId: '',
    rules: buildRulePreset('10'),
    teamAXi: [],
    teamBXi: [],
    tossWinnerId: '',
    tossDecision: '',
  };
}

export function scheduledAtFromWizard(state: WizardState): string {
  return new Date(`${state.date}T${state.time}:00`).toISOString();
}

export function validateTeamsStep(state: WizardState): string | null {
  if (!state.teamAId || !state.teamBId) return 'Select both teams';
  if (state.teamAId === state.teamBId) return 'Team A and Team B must be different';
  return null;
}

export function validateXiStep(state: WizardState): string | null {
  const n = state.rules.playersPerSide;
  if (state.teamAXi.length !== n) return `Team A needs exactly ${n} players`;
  if (state.teamBXi.length !== n) return `Team B needs exactly ${n} players`;
  const ids = [...state.teamAXi, ...state.teamBXi].map((e) => e.playerId);
  if (new Set(ids).size !== ids.length) return 'Players cannot be duplicated';
  return null;
}

export function validateTossStep(state: WizardState): string | null {
  if (!state.tossWinnerId) return 'Select toss winner';
  if (!state.tossDecision) return 'Select bat or bowl';
  if (state.tossWinnerId !== state.teamAId && state.tossWinnerId !== state.teamBId) {
    return 'Toss winner must be one of the match teams';
  }
  return null;
}
