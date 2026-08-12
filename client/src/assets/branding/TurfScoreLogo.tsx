import { cn } from '@/lib/cn';

type LogoProps = {
  className?: string;
  showWordmark?: boolean;
  showTagline?: boolean;
  size?: 'sm' | 'md' | 'lg';
  /** When true, "Score" renders in primary green (auth mockup). */
  accentWordmark?: boolean;
};

const sizeMap = {
  sm: { icon: 28, text: 'text-lg' },
  md: { icon: 36, text: 'text-xl' },
  lg: { icon: 44, text: 'text-2xl' },
} as const;

export function TurfScoreLogo({
  className,
  showWordmark = true,
  showTagline = true,
  size = 'md',
  accentWordmark = false,
}: LogoProps) {
  const s = sizeMap[size];

  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <svg
        width={s.icon}
        height={s.icon}
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
      >
        <circle cx="32" cy="32" r="22" stroke="#35D05F" strokeWidth="3" />
        <rect x="28" y="12" width="8" height="36" rx="2" fill="#35D05F" />
        <circle cx="44" cy="42" r="6" fill="#EF4444" />
      </svg>
      {showWordmark ? (
        <div className="leading-tight">
          <div className={cn('font-display font-semibold tracking-tight', s.text)}>
            {accentWordmark ? (
              <>
                <span className="text-white">Turf</span>
                <span className="text-primary">Score</span>
              </>
            ) : (
              <span className="text-text">TurfScore</span>
            )}
          </div>
          {showTagline && size !== 'sm' ? (
            <div
              className={cn(
                'text-[10px] font-medium uppercase tracking-[0.16em]',
                accentWordmark ? 'text-white/55' : 'text-text-muted',
              )}
            >
              Live cricket scoring
            </div>
          ) : null}
        </div>
      ) : (
        <span className="sr-only">TurfScore</span>
      )}
    </div>
  );
}
