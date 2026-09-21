'use client';

import { useState } from 'react';
import Reveal from '@/components/motion/Reveal';
import { Crest } from '@/components/directory/DirectoryArt';
import { safeAccent, darkenHex } from '@/lib/crest';
import type { PublicTournamentCard } from '@/lib/public-directory';

// Below this count a search box is just extra chrome over a handful of
// tiles someone can scan in a glance -- it earns its place once the list
// is long enough that scanning stops being the fastest way to find one.
const SEARCH_THRESHOLD = 6;

// 'YYYY-MM-DD' from a date column. Formatted in UTC so the day can't shift with
// the viewer's timezone, and so server and browser render the same text.
function formatDate(value: string | null): string | null {
  if (!value) return null;
  const d = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

function PosterCard({ t }: { t: PublicTournamentCard }) {
  const [posterFailed, setPosterFailed] = useState(false);
  const date = formatDate(t.eventDate);
  const showPoster = !!t.posterUrl && !posterFailed;
  const accent = safeAccent(t.accent);

  return (
    // Proxied to the Tournament Manager app (next.config.js rewrites) -- a
    // plain <a>, not next/link, since this crosses to a different app entirely.
    <a href={`/t/${t.orgSlug}/${t.slug}`} className="poster">
      <span className="poster-art">
        {showPoster ? (
          // eslint-disable-next-line @next/next/no-img-element -- organizer-uploaded posters of arbitrary size
          <img src={t.posterUrl!} alt={`${t.name} poster`} loading="lazy" onError={() => setPosterFailed(true)} />
        ) : (
          <span className="poster-fallback" style={{ background: darkenHex(accent, 0.55) }}>
            <Crest name={t.name} seed={`${t.orgSlug}/${t.slug}`} accent={accent} primary={accent} kind="tournament" size={96} />
          </span>
        )}
        {date && <span className="poster-date">{date}</span>}
      </span>
      <span className="poster-cap">
        <span className="dir-name" style={{ marginTop: 0 }}>{t.name}</span>
        <span className="dir-meta">{t.orgName}</span>
        {t.venue && <span className="dir-meta">{t.venue}</span>}
      </span>
    </a>
  );
}

export default function PublicTournamentList({ tournaments }: { tournaments: PublicTournamentCard[] }) {
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
      {filtered.length === 0 && (
        <p style={{ fontSize: 13, color: 'var(--text-muted)', padding: '4px 2px' }}>No tournaments match &quot;{query}&quot;.</p>
      )}
      <div className="dir-grid dir-grid-posters">
        {filtered.map((t, i) => (
          // Two organizers can both run a "Tiger Cup", so the slug alone is not
          // a unique key -- it was, and React warned about the duplicates.
          <Reveal key={`${t.orgSlug}/${t.slug}`} index={i}>
            <PosterCard t={t} />
          </Reveal>
        ))}
      </div>
    </>
  );
}
