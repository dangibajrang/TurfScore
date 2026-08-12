import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/apiClient';
import { useAuthStore } from '@/features/auth/authStore';
import { cn } from '@/lib/cn';

type SearchResult = {
  matches: Array<{ id: string; name: string; status: string; venue: string | null; label: string }>;
  teams: Array<{ id: string; name: string; shortName: string | null; logoUrl: string | null }>;
  players: Array<{ id: string; name: string; role: string; profileImageUrl: string | null }>;
};

export function GlobalSearch({ className }: { className?: string }) {
  const authStatus = useAuthStore((s) => s.status);
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [q, setQ] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setQ(input.trim()), 350);
    return () => window.clearTimeout(t);
  }, [input]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const query = useQuery({
    queryKey: ['global-search', q],
    queryFn: () =>
      apiRequest<SearchResult>(`/api/search?q=${encodeURIComponent(q)}&limit=5`, {
        method: 'GET',
        auth: true,
      }),
    enabled: authStatus === 'authenticated' && q.length >= 2,
    staleTime: 30_000,
  });

  if (authStatus !== 'authenticated') return null;

  const data = query.data;
  const hasResults =
    !!data && (data.matches.length > 0 || data.teams.length > 0 || data.players.length > 0);

  return (
    <div ref={rootRef} className={cn('relative min-w-0', className)}>
      <label className="sr-only" htmlFor="global-search">
        Search matches, teams, and players
      </label>
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-subtle"
          aria-hidden
        />
        <input
          id="global-search"
          data-testid="global-search"
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search…"
          className="h-10 w-full rounded-control border border-border bg-surface-elevated pl-9 pr-9 text-sm text-text placeholder:text-text-subtle focus-visible:outline-none"
          autoComplete="off"
        />
        {input ? (
          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-text-muted hover:text-text"
            aria-label="Clear search"
            onClick={() => {
              setInput('');
              setQ('');
            }}
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      {open && q.length >= 2 ? (
        <div
          className="absolute right-0 z-50 mt-2 max-h-80 w-[min(100vw-2rem,22rem)] overflow-y-auto rounded-control border border-border bg-surface p-2 shadow-lg"
          role="listbox"
          aria-label="Search results"
        >
          {query.isFetching ? (
            <p className="px-2 py-3 text-sm text-text-muted">Searching…</p>
          ) : !hasResults ? (
            <p className="px-2 py-3 text-sm text-text-muted">No results for “{q}”</p>
          ) : (
            <div className="space-y-3">
              {data!.players.length ? (
                <section>
                  <p className="px-2 text-[10px] font-semibold uppercase tracking-wider text-text-subtle">
                    Players
                  </p>
                  <ul>
                    {data!.players.map((p) => (
                      <li key={p.id}>
                        <Link
                          to={`/players/${p.id}`}
                          className="block rounded-control px-2 py-2 text-sm hover:bg-surface-elevated"
                          onClick={() => setOpen(false)}
                        >
                          {p.name}
                          <span className="ml-2 text-xs text-text-muted">{p.role}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
              {data!.teams.length ? (
                <section>
                  <p className="px-2 text-[10px] font-semibold uppercase tracking-wider text-text-subtle">
                    Teams
                  </p>
                  <ul>
                    {data!.teams.map((t) => (
                      <li key={t.id}>
                        <Link
                          to={`/teams/${t.id}`}
                          className="block rounded-control px-2 py-2 text-sm hover:bg-surface-elevated"
                          onClick={() => setOpen(false)}
                        >
                          {t.name}
                          {t.shortName ? (
                            <span className="ml-2 text-xs text-text-muted">{t.shortName}</span>
                          ) : null}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
              {data!.matches.length ? (
                <section>
                  <p className="px-2 text-[10px] font-semibold uppercase tracking-wider text-text-subtle">
                    Matches
                  </p>
                  <ul>
                    {data!.matches.map((m) => (
                      <li key={m.id}>
                        <Link
                          to={`/matches/${m.id}`}
                          className="block rounded-control px-2 py-2 text-sm hover:bg-surface-elevated"
                          onClick={() => setOpen(false)}
                        >
                          <span className="font-medium">{m.label}</span>
                          <span className="mt-0.5 block text-xs text-text-muted">
                            {m.name} · {m.status}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
