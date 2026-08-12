import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useUiStore } from '@/stores/uiStore';

export function Toast() {
  const message = useUiStore((s) => s.toastMessage);
  const clearToast = useUiStore((s) => s.clearToast);

  useEffect(() => {
    if (!message) return;
    const t = window.setTimeout(() => clearToast(), 3200);
    return () => window.clearTimeout(t);
  }, [message, clearToast]);

  if (!message) return null;

  return createPortal(
    <div
      role="status"
      className="fixed bottom-[calc(var(--bottom-nav-height)+16px+env(safe-area-inset-bottom,0px))] left-1/2 z-[60] max-w-[90vw] -translate-x-1/2 rounded-control border border-border bg-surface-elevated px-4 py-2.5 text-sm font-medium text-text shadow-card md:bottom-6"
    >
      {message}
    </div>,
    document.body,
  );
}
