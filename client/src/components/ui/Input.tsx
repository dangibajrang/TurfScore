import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string;
  hint?: string;
  leadingIcon?: ReactNode;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, id, leadingIcon, ...props }, ref) => {
    const inputId = id ?? props.name;

    return (
      <label className="flex w-full flex-col gap-1.5">
        {label ? (
          <span className="text-sm font-medium text-text-muted">{label}</span>
        ) : null}
        <span className="relative block">
          {leadingIcon ? (
            <span className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-text-subtle">
              {leadingIcon}
            </span>
          ) : null}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              'h-11 w-full rounded-control border border-border-subtle bg-surface px-3 text-sm text-text placeholder:text-text-subtle',
              'hover:border-border focus:border-primary/50',
              leadingIcon && 'pl-10',
              error && 'border-danger/60',
              className,
            )}
            {...props}
          />
        </span>
        {error ? <span className="text-xs text-danger">{error}</span> : null}
        {!error && hint ? <span className="text-xs text-text-subtle">{hint}</span> : null}
      </label>
    );
  },
);

Input.displayName = 'Input';
