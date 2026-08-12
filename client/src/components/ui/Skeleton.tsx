import { cn } from '@/lib/cn';

type SkeletonProps = {
  className?: string;
};

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-control bg-surface-elevated/80',
        className,
      )}
      aria-hidden
    />
  );
}

export function SkeletonStatCard() {
  return (
    <div className="rounded-card border border-border-subtle bg-surface p-4">
      <Skeleton className="mb-3 h-4 w-24" />
      <Skeleton className="h-8 w-16" />
    </div>
  );
}
