import { create } from 'zustand';

type UiState = {
  mobileMoreOpen: boolean;
  setMobileMoreOpen: (open: boolean) => void;
  toastMessage: string | null;
  showToast: (message: string) => void;
  clearToast: () => void;
};

export const useUiStore = create<UiState>((set) => ({
  mobileMoreOpen: false,
  setMobileMoreOpen: (open) => set({ mobileMoreOpen: open }),
  toastMessage: null,
  showToast: (message) => set({ toastMessage: message }),
  clearToast: () => set({ toastMessage: null }),
}));
