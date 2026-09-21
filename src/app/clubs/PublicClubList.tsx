'use client';

import { useState } from 'react';
import Link from 'next/link';
import Reveal from '@/components/motion/Reveal';
import { LogoOrCrest } from '@/components/directory/DirectoryArt';
import type { PublicClubTile } from '@/lib/public-directory';

// Below this count a search box is just extra chrome over a handful of
// tiles someone can scan in a glance -- it earns its place once the list
// is long enough that scanning stops being the fastest way to find one.
const SEARCH_THRESHOLD = 6;

export default function PublicClubList({ clubs }: { clubs: PublicClubTile[] }) {
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
      {filtered.length === 0 && (
        <p style={{ fontSize: 13, color: 'var(--text-muted)', padding: '4px 2px' }}>No clubs match &quot;{query}&quot;.</p>
      )}
      <div className="dir-grid">
        {filtered.map((club, i) => (
          <Reveal key={club.slug} index={i}>
            <Link href={`/c/${club.slug}`} className="dir-tile">
              <span className="dir-logo">
                <LogoOrCrest
                  src={club.logoUrl}
                  alt={`${club.name} logo`}
                  name={club.name}
                  seed={club.slug}
                  accent={club.accent}
                  kind="club"
                  size={96}
                />
              </span>
              <span className="dir-name">{club.name}</span>
              <span className="dir-meta">{club.orgName}</span>
              {club.location && <span className="dir-meta">{club.location}</span>}
            </Link>
          </Reveal>
        ))}
      </div>
    </>
  );
}
