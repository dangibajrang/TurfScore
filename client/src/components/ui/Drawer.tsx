import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { Button } from './Button';
import { cn } from '@/lib/cn';

type DrawerProps = {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  side?: 'left' | 'right';
  className?: string;
};

export function Drawer({
  open,
  title,
  children,
  onClose,
  side = 'right',
  className,
}: DrawerProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Close drawer overlay"
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
      />
      <aside
        className={cn(
          'absolute top-0 flex h-full w-[min(100%,360px)] flex-col border-border-subtle bg-surface shadow-card',
          side === 'right' ? 'right-0 border-l' : 'left-0 border-r',
          className,
        )}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
          <h2 className="font-display text-lg font-semibold">{title}</h2>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X className="h-5 w-5" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4">{children}</div>
      </aside>
    </div>,
    document.body,
  );
}
