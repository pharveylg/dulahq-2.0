import Link from 'next/link';

type Entry = {
  id: string;
  status: string;
  teamName: string;
  categoryName: string | null;
  tournamentName: string;
  tournamentSlug: string | null;
  eventDate: string | null;
  rosterCount: number;
};

const STATUS_STYLE: Record<string, React.CSSProperties> = {
  accepted: { color: 'var(--accent)', background: 'var(--accent-soft)', borderColor: 'var(--accent-soft-border)' },
  pending: { color: 'var(--warn)', background: 'var(--warn-soft)', borderColor: 'var(--warn-soft-border)' },
  declined: { color: 'var(--danger)', background: 'var(--danger-soft)', borderColor: 'var(--danger-soft-border)' },
  withdrawn: { color: 'var(--text-muted)' },
};

/**
 * Coach Module spec §8/§9: tournaments the team is entered in, and the
 * roster-building workflow for each. The entry itself (registering the
 * team into a tournament category) stays an org_admin action -- see
 * phase6d's migration comment on why finalizing is coach-authorized but
 * entering isn't. This tab only lists entries that already exist.
 */
export default function TeamTournaments({ clubSlug, teamSlug, entries }: { clubSlug: string; teamSlug: string; entries: Entry[] }) {
  return (
    <div>
      <div className="card">
        {entries.length === 0 && (
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            This team isn&apos;t entered in any tournament yet — ask your org admin to enter it.
          </p>
        )}
        {entries.map((e) => (
          <Link
            key={e.id}
            href={`/c/${clubSlug}/teams/${teamSlug}/tournaments/${e.id}`}
            className="list-row"
            style={{ textDecoration: 'none', color: 'inherit' }}
          >
            <div className="list-row-main">
              <div className="list-row-title">{e.tournamentName}{e.categoryName ? ` — ${e.categoryName}` : ''}</div>
              <div className="list-row-meta">
                {e.eventDate ? new Date(e.eventDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Date TBD'}
                {e.rosterCount > 0 ? ` · ${e.rosterCount} on final roster` : ''}
              </div>
            </div>
            <span className="chip" style={STATUS_STYLE[e.status]}>{e.status}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
