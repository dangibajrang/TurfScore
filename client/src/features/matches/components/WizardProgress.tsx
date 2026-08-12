import { cn } from '@/lib/cn';

const STEPS = [
  { id: 1, label: 'Details' },
  { id: 2, label: 'Teams' },
  { id: 3, label: 'Rules' },
  { id: 4, label: 'Playing XI' },
  { id: 5, label: 'Toss' },
  { id: 6, label: 'Review' },
];

export function WizardProgress({ step }: { step: number }) {
  return (
    <ol className="flex gap-1 overflow-x-auto pb-1" aria-label="Match creation steps">
      {STEPS.map((s) => {
        const active = s.id === step;
        const done = s.id < step;
        return (
          <li
            key={s.id}
            className={cn(
              'flex min-w-[4.5rem] flex-col items-center rounded-control px-2 py-2 text-center',
              active && 'bg-primary-muted',
            )}
          >
            <span
              className={cn(
                'text-[10px] font-bold tracking-wide',
                active ? 'text-primary' : done ? 'text-text-muted' : 'text-text-subtle',
              )}
            >
              {String(s.id).padStart(2, '0')}
            </span>
            <span
              className={cn(
                'text-xs font-semibold',
                active ? 'text-text' : 'text-text-muted',
              )}
            >
              {s.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
