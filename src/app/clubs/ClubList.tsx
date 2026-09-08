'use client';

import Link from 'next/link';
import Reveal from '@/components/motion/Reveal';

type Club = {
  id: string;
  slug: string;
  name: string;
  orgName: string;
  staffCount: number;
  teamCount: number;
};

export default function ClubList({ clubs }: { clubs: Club[] }) {
  return (
    <div className="card">
      {clubs.map((club, i) => (
        <Reveal key={club.id} index={i}>
          <Link href={`/c/${club.slug}`} className="list-row" style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="list-row-main">
              <div className="list-row-title">{club.name}</div>
              <div className="list-row-meta">
                {club.orgName} · {club.staffCount} staff · {club.teamCount} teams
              </div>
            </div>
            <span className="chip">View →</span>
          </Link>
        </Reveal>
      ))}
    </div>
  );
}
