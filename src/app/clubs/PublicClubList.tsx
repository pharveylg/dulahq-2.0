'use client';

import Link from 'next/link';
import Reveal from '@/components/motion/Reveal';

type PublicClub = {
  slug: string;
  name: string;
  orgName: string;
  location: string | null;
};

export default function PublicClubList({ clubs }: { clubs: PublicClub[] }) {
  return (
    <div className="card">
      {clubs.map((club, i) => (
        <Reveal key={club.slug} index={i}>
          <Link href={`/clubs/${club.slug}`} className="list-row" style={{ textDecoration: 'none', color: 'inherit' }}>
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
  );
}
