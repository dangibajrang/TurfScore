import { useState, forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/cn';

type PasswordInputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string;
  leadingIcon?: ReactNode;
};

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, label, error, id, leadingIcon, ...props }, ref) => {
    const [visible, setVisible] = useState(false);
    const inputId = id ?? props.name;

    return (
      <label className="flex w-full flex-col gap-1.5">
        {label ? <span className="text-sm font-medium text-text-muted">{label}</span> : null}
        <div className="relative">
          {leadingIcon ? (
            <span className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-text-subtle">
              {leadingIcon}
            </span>
          ) : null}
          <input
            ref={ref}
            id={inputId}
            type={visible ? 'text' : 'password'}
            className={cn(
              'h-11 w-full rounded-control border border-border-subtle bg-surface px-3 pr-11 text-sm text-text placeholder:text-text-subtle',
              'hover:border-border focus:border-primary/50',
              leadingIcon && 'pl-10',
              error && 'border-danger/60',
              className,
            )}
            {...props}
          />
          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-text-muted hover:text-text"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? 'Hide password' : 'Show password'}
          >
            {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {error ? <span className="text-xs text-danger">{error}</span> : null}
      </label>
    );
  },
);

PasswordInput.displayName = 'PasswordInput';
