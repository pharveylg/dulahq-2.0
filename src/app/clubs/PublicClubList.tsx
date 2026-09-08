'use client';

import { useState } from 'react';
import Link from 'next/link';
import Reveal from '@/components/motion/Reveal';

type PublicClub = {
  slug: string;
  name: string;
  orgName: string;
  location: string | null;
};

// Below this count a search box is just extra chrome over a handful of
// tiles someone can scan in a glance -- it earns its place once the list
// is long enough that scanning stops being the fastest way to find one.
const SEARCH_THRESHOLD = 6;

export default function PublicClubList({ clubs }: { clubs: PublicClub[] }) {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const filtered = q
    ? clubs.filter((c) => c.name.toLowerCase().includes(q) || c.orgName.toLowerCase().includes(q))
    : clubs;

  return (
    <>
      {clubs.length > SEARCH_THRESHOLD && (
        <div className="form-group">
          <input
            type="search"
            placeholder="Search clubs…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search clubs"
          />
        </div>
      )}
      <div className="card">
        {filtered.length === 0 && (
          <p style={{ fontSize: 13, color: 'var(--text-muted)', padding: '4px 2px' }}>No clubs match &quot;{query}&quot;.</p>
        )}
        {filtered.map((club, i) => (
          <Reveal key={club.slug} index={i}>
            <Link href={`/c/${club.slug}`} className="list-row" style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className="list-row-main">
                <div className="list-row-title">{club.name}</div>
                <div className="list-row-meta">
                  {club.orgName}
                  {club.location ? ` · ${club.location}` : ''}
                </div>
              </div>
              <span className="chip">View →</span>
            </Link>
          </Reveal>
        ))}
      </div>
    </>
  );
}
