import { forwardRef, type SelectHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  error?: string;
  options: Array<{ value: string; label: string }>;
};

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, options, id, ...props }, ref) => {
    const selectId = id ?? props.name;

    return (
      <label className="flex w-full flex-col gap-1.5">
        {label ? (
          <span className="text-sm font-medium text-text-muted">{label}</span>
        ) : null}
        <select
          ref={ref}
          id={selectId}
          className={cn(
            'h-11 w-full rounded-control border border-border-subtle bg-surface px-3 text-sm text-text',
            'hover:border-border focus:border-primary/50',
            error && 'border-danger/60',
            className,
          )}
          {...props}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {error ? <span className="text-xs text-danger">{error}</span> : null}
      </label>
    );
  },
);

Select.displayName = 'Select';
