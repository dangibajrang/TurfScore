import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/cn';

export type CalendarHighlight = {
  date: string;
  matchId: string;
  label: string;
  status?: string;
};

type MiniCalendarProps = {
  highlights?: CalendarHighlight[];
};

function localIso(year: number, monthIndex: number, day: number) {
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function todayIso() {
  const d = new Date();
  return localIso(d.getFullYear(), d.getMonth(), d.getDate());
}

export function MiniCalendar({ highlights = [] }: MiniCalendarProps) {
  const navigate = useNavigate();
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selected, setSelected] = useState<string | null>(todayIso);

  const byDate = useMemo(() => {
    const map = new Map<string, CalendarHighlight[]>();
    for (const h of highlights) {
      const list = map.get(h.date) ?? [];
      list.push(h);
      map.set(h.date, list);
    }
    return map;
  }, [highlights]);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startWeekday = new Date(year, month, 1).getDay();
  const label = cursor.toLocaleString(undefined, { month: 'long', year: 'numeric' });
  const today = todayIso();

  const cells: Array<number | null> = [
    ...Array.from({ length: startWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const selectedMatches = selected ? (byDate.get(selected) ?? []) : [];

  const openDay = (iso: string) => {
    setSelected(iso);
    const matches = byDate.get(iso) ?? [];
    if (matches.length === 1) {
      navigate(`/matches/${matches[0]!.matchId}`);
      return;
    }
    if (matches.length > 1) {
      navigate('/matches');
    }
  };

  return (
    <div className="rounded-card border border-border-subtle bg-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          className="rounded-control px-2.5 py-1.5 text-sm text-text-muted hover:bg-surface-elevated hover:text-text"
          onClick={() => setCursor(new Date(year, month - 1, 1))}
          aria-label="Previous month"
        >
          ‹
        </button>
        <h3 className="font-display text-sm font-semibold">{label}</h3>
        <button
          type="button"
          className="rounded-control px-2.5 py-1.5 text-sm text-text-muted hover:bg-surface-elevated hover:text-text"
          onClick={() => setCursor(new Date(year, month + 1, 1))}
          aria-label="Next month"
        >
          ›
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-text-subtle">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
          <div key={`wd-${i}`} className="py-1">
            {d}
          </div>
        ))}
        {cells.map((day, idx) => {
          if (!day) return <div key={`e-${idx}`} />;
          const iso = localIso(year, month, day);
          const matches = byDate.get(iso) ?? [];
          const hasMatch = matches.length > 0;
          const isToday = iso === today;
          const isSelected = iso === selected;
          const isLive = matches.some((m) => m.status === 'LIVE');

          return (
            <button
              key={iso}
              type="button"
              title={
                hasMatch
                  ? matches.map((m) => m.label).join(', ')
                  : isToday
                    ? 'Today'
                    : undefined
              }
              onClick={() => openDay(iso)}
              className={cn(
                'rounded-md py-1.5 text-xs transition-colors',
                'hover:bg-surface-elevated hover:text-text focus-visible:outline-none',
                hasMatch && 'cursor-pointer font-semibold',
                !hasMatch && 'cursor-pointer text-text-muted',
                hasMatch && !isLive && 'bg-primary/20 text-primary',
                isLive && 'bg-danger text-white',
                isToday && !hasMatch && 'ring-1 ring-primary/50',
                isSelected && !hasMatch && 'bg-surface-elevated text-text',
                isSelected && hasMatch && 'ring-2 ring-primary ring-offset-1 ring-offset-surface',
              )}
            >
              {day}
            </button>
          );
        })}
      </div>

      {selectedMatches.length > 0 ? (
        <ul className="mt-3 space-y-1.5 border-t border-border-subtle pt-3">
          {selectedMatches.map((m) => (
            <li key={m.matchId}>
              <button
                type="button"
                className="w-full rounded-control px-2 py-1.5 text-left text-xs hover:bg-surface-elevated"
                onClick={() => navigate(`/matches/${m.matchId}`)}
              >
                <span className="font-semibold text-text">{m.label}</span>
                {m.status === 'LIVE' ? (
                  <span className="ml-2 text-[10px] font-bold uppercase text-danger">Live</span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 border-t border-border-subtle pt-3 text-xs text-text-subtle">
          Click a highlighted day to open that match.
        </p>
      )}
    </div>
  );
}
