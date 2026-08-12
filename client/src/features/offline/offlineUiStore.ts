import { create } from 'zustand';
import type { ConnectionUiState } from './types';

type OfflineUiStore = {
  connection: ConnectionUiState;
  pendingCount: number;
  failedCount: number;
  syncingMatchId: string | null;
  authPaused: boolean;
  conflictPausedMatchId: string | null;
  lastFlash: 'queued' | 'synced' | 'failed' | null;
  setConnection: (s: ConnectionUiState) => void;
  setCounts: (pending: number, failed: number) => void;
  setSyncingMatchId: (id: string | null) => void;
  setAuthPaused: (v: boolean) => void;
  setConflictPausedMatchId: (id: string | null) => void;
  setLastFlash: (v: 'queued' | 'synced' | 'failed' | null) => void;
};

export const useOfflineUiStore = create<OfflineUiStore>((set) => ({
  connection: 'ONLINE',
  pendingCount: 0,
  failedCount: 0,
  syncingMatchId: null,
  authPaused: false,
  conflictPausedMatchId: null,
  lastFlash: null,
  setConnection: (connection) => set({ connection }),
  setCounts: (pendingCount, failedCount) => set({ pendingCount, failedCount }),
  setSyncingMatchId: (syncingMatchId) => set({ syncingMatchId }),
  setAuthPaused: (authPaused) => set({ authPaused }),
  setConflictPausedMatchId: (conflictPausedMatchId) => set({ conflictPausedMatchId }),
  setLastFlash: (lastFlash) => set({ lastFlash }),
}));
