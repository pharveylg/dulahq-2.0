'use client';

import { useState } from 'react';
import Reveal from '@/components/motion/Reveal';

type PublicTournament = {
  slug: string;
  name: string;
  posterUrl: string | null;
  eventDate: string | null;
  venue: string | null;
  orgSlug: string;
  orgName: string;
};

// Below this count a search box is just extra chrome over a handful of
// tiles someone can scan in a glance -- it earns its place once the list
// is long enough that scanning stops being the fastest way to find one.
const SEARCH_THRESHOLD = 6;

export default function PublicTournamentList({ tournaments }: { tournaments: PublicTournament[] }) {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const filtered = q
    ? tournaments.filter((t) => t.name.toLowerCase().includes(q) || t.orgName.toLowerCase().includes(q))
    : tournaments;

  return (
    <>
      {tournaments.length > SEARCH_THRESHOLD && (
        <div className="form-group">
          <input
            type="search"
            placeholder="Search tournaments…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search tournaments"
          />
        </div>
      )}
      <div className="card">
        {filtered.length === 0 && (
          <p style={{ fontSize: 13, color: 'var(--text-muted)', padding: '4px 2px' }}>No tournaments match &quot;{query}&quot;.</p>
        )}
        {filtered.map((t, i) => (
          <Reveal key={t.slug} index={i}>
            {/* Proxied to the Tournament Manager app (next.config.js rewrites)
                -- a plain <a>, not next/link, since this crosses to a
                different app entirely. */}
            <a href={`/t/${t.orgSlug}/${t.slug}`} className="list-row" style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className="list-row-main">
                <div className="list-row-title">{t.name}</div>
                <div className="list-row-meta">
                  {t.orgName}
                  {t.eventDate ? ` · ${t.eventDate}` : ''}
                  {t.venue ? ` · ${t.venue}` : ''}
                </div>
              </div>
              <span className="chip">View →</span>
            </a>
          </Reveal>
        ))}
      </div>
    </>
  );
}
