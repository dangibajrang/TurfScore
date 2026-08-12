import { create } from 'zustand';
import type { DeliveryDto, WicketType } from './types';

export type ScoringSheet =
  | null
  | 'wide'
  | 'noBall'
  | 'bye'
  | 'legBye'
  | 'wicket'
  | 'openings'
  | 'bowler'
  | 'replacement'
  | 'secondInnings'
  | 'undo'
  | 'deliveryDetail'
  | 'editDelivery';

type ScoringUiState = {
  sheet: ScoringSheet;
  selectedDelivery: DeliveryDto | null;
  wicketDraft: {
    playerOutId: string | null;
    wicketType: WicketType | null;
    fielderId: string | null;
    runsCompleted: number;
    nextBatterId: string | null;
  };
  submitting: boolean;
  lastFlash: 'four' | 'six' | 'wicket' | 'over' | null;
  setSheet: (sheet: ScoringSheet) => void;
  setSelectedDelivery: (d: DeliveryDto | null) => void;
  setWicketDraft: ( partial: Partial<ScoringUiState['wicketDraft']>) => void;
  resetWicketDraft: () => void;
  setSubmitting: (v: boolean) => void;
  setLastFlash: (v: ScoringUiState['lastFlash']) => void;
};

const emptyWicket = {
  playerOutId: null,
  wicketType: null,
  fielderId: null,
  runsCompleted: 0,
  nextBatterId: null,
};

export const useScoringUiStore = create<ScoringUiState>((set) => ({
  sheet: null,
  selectedDelivery: null,
  wicketDraft: emptyWicket,
  submitting: false,
  lastFlash: null,
  setSheet: (sheet) => set({ sheet }),
  setSelectedDelivery: (selectedDelivery) => set({ selectedDelivery }),
  setWicketDraft: (partial) =>
    set((s) => ({ wicketDraft: { ...s.wicketDraft, ...partial } })),
  resetWicketDraft: () => set({ wicketDraft: emptyWicket }),
  setSubmitting: (submitting) => set({ submitting }),
  setLastFlash: (lastFlash) => set({ lastFlash }),
}));
