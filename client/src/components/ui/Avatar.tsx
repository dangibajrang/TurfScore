import { cn } from '@/lib/cn';
import { resolveMediaUrl } from '@/lib/mediaUrl';

type AvatarProps = {
  name: string;
  src?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
};

const sizes = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-14 w-14 text-base',
} as const;

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

export function Avatar({ name, src, size = 'md', className }: AvatarProps) {
  const resolved = resolveMediaUrl(src);
  if (resolved) {
    return (
      <img
        src={resolved}
        alt={name}
        className={cn('rounded-full object-cover', sizes[size], className)}
      />
    );
  }

  return (
    <div
      className={cn(
        'inline-flex items-center justify-center rounded-full bg-primary-muted font-semibold text-primary',
        sizes[size],
        className,
      )}
      aria-label={name}
    >
      {initials(name) || '?'}
    </div>
  );
}
