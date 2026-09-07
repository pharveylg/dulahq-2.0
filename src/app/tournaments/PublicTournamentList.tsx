'use client';

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

export default function PublicTournamentList({ tournaments }: { tournaments: PublicTournament[] }) {
  return (
    <div className="card">
      {tournaments.map((t, i) => (
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
  );
}
