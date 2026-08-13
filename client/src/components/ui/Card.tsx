import { cn } from '@/lib/cn';

type CardProps = {
  children: React.ReactNode;
  className?: string;
  padded?: boolean;
};

export function Card({ children, className, padded = true }: CardProps) {
  return (
    <div
      className={cn(
        'min-w-0 rounded-card border border-border-subtle bg-surface shadow-card',
        padded && 'p-4 sm:p-5',
        className,
      )}
    >
      {children}
    </div>
  );
}
