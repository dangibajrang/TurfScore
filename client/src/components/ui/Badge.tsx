import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  children: React.ReactNode;
  tone?: 'default' | 'primary' | 'danger' | 'warning' | 'info';
};

const tones: Record<NonNullable<BadgeProps['tone']>, string> = {
  default: 'bg-surface-elevated text-text-muted border-border-subtle',
  primary: 'bg-primary-muted text-primary border-primary/20',
  danger: 'bg-danger-muted text-danger border-danger/25',
  warning: 'bg-warning/15 text-warning border-warning/25',
  info: 'bg-info/15 text-info border-info/25',
};

export function Badge({ children, className, tone = 'default', ...rest }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide',
        tones[tone],
        className,
      )}
      {...rest}
    >
      {children}
    </span>
  );
}
