'use client';

import { useActionState, useEffect, useRef, useState, useTransition } from 'react';
import { addStaff, archiveStaff, setStaffStatus } from './actions';

export type StaffMember = { userId: string; name: string | null; email: string; role: string; status: string };
export type AuditRow = { id: number; ts: string; actorEmail: string | null; action: string };

const ROLES: { value: string; label: string }[] = [
  { value: 'organizer', label: 'Organizer' },
  { value: 'team_coordinator', label: 'Team coordinator' },
  { value: 'secretary', label: 'Secretary' },
  { value: 'treasurer', label: 'Treasurer' },
  { value: 'logistics', label: 'Logistics' },
  { value: 'communications', label: 'Communications' },
  { value: 'volunteer_coordinator', label: 'Volunteer coordinator' },
  { value: 'referee_coordinator', label: 'Referee coordinator' },
  { value: 'tournament_it_admin', label: 'IT admin' },
];
const roleLabel = (role: string) => ROLES.find((r) => r.value === role)?.label ?? role;

type FormState = { error?: string; success?: boolean };

function StaffRow({
  tournamentId,
  member,
  isSelf,
  canManage,
  canAccountStatus,
}: {
  tournamentId: string;
  member: StaffMember;
  isSelf: boolean;
  canManage: boolean;
  canAccountStatus: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const suspended = member.status === 'suspended';

  function run(fn: () => Promise<{ error?: string } | undefined>) {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="list-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div className="list-row-main">
          <div className="list-row-title">
            {member.name ?? member.email} {isSelf && <span className="chip">you</span>}{' '}
            {suspended && <span className="chip" style={{ color: 'var(--danger)' }}>suspended</span>}
          </div>
          <div className="list-row-meta">{member.email} · {roleLabel(member.role)}</div>
        </div>
        {!isSelf && (
          <div style={{ display: 'flex', gap: 6 }}>
            {canAccountStatus && (
              <button className="btn" style={{ fontSize: 12 }} disabled={pending}
                onClick={() => run(() => setStaffStatus(tournamentId, member.userId, suspended ? 'active' : 'suspended'))}>
                {suspended ? 'Reactivate' : 'Suspend'}
              </button>
            )}
            {canManage && (
              <button className="btn" style={{ fontSize: 12 }} disabled={pending}
                onClick={() => { if (window.confirm(`Remove ${member.name ?? member.email} as ${roleLabel(member.role)}?`)) run(() => archiveStaff(tournamentId, member.userId, member.role)); }}>
                Remove
              </button>
            )}
          </div>
        )}
      </div>
      {error && <p className="error-text" style={{ margin: 0 }}>{error}</p>}
    </div>
  );
}

export default function StaffPanel({
  tournamentId,
  currentUserId,
  staff,
  audit,
  canManage,
  canAccountStatus,
}: {
  tournamentId: string;
  currentUserId: string;
  staff: StaffMember[];
  audit: AuditRow[] | null;
  canManage: boolean;
  canAccountStatus: boolean;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    async (_prev, formData) => (await addStaff(tournamentId, formData)) ?? {},
    {}
  );
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state?.success) formRef.current?.reset(); }, [state]);
  // Removal archives rather than deletes (the row is the record of who staffed
  // the tournament), and the directory returns archived rows too.
  const current = staff.filter((m) => m.status !== 'archived');
  const former = staff.filter((m) => m.status === 'archived');

  return (
    <>
      {canManage && (
        <form ref={formRef} action={action} className="card" style={{ display: 'grid', gap: 10, marginBottom: 16 }}>
          <div className="section-label">Add staff</div>
          <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-muted)' }}>
            They need an existing Dulà HQ account — this can&apos;t create one.
          </p>
          <div className="form-row" style={{ flexWrap: 'wrap' }}>
            <div className="form-group" style={{ flex: 2, minWidth: 200, marginBottom: 0 }}>
              <input name="email" type="email" placeholder="Email" required />
            </div>
            <div className="form-group" style={{ flex: 1, minWidth: 160, marginBottom: 0 }}>
              <select name="role" defaultValue="team_coordinator">
                {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? 'Adding…' : 'Add'}</button>
          </div>
          {state?.error && <p className="error-text" style={{ margin: 0 }}>{state.error}</p>}
          {state?.success && <p style={{ margin: 0, fontSize: 13, color: 'var(--accent)' }}>Added.</p>}
        </form>
      )}

      <div className="section-label">Staff ({current.length})</div>
      <div className="card" style={{ marginBottom: 20 }}>
        {current.length === 0 && <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No staff yet.</p>}
        {current.map((m) => (
          <StaffRow key={`${m.userId}-${m.role}`} tournamentId={tournamentId} member={m}
            isSelf={m.userId === currentUserId} canManage={canManage} canAccountStatus={canAccountStatus} />
        ))}
      </div>

      {former.length > 0 && (
        <>
          <div className="section-label">Former staff ({former.length})</div>
          <div className="card" style={{ marginBottom: 20 }}>
            {former.map((m) => (
              <div key={`${m.userId}-${m.role}`} className="list-row">
                <div className="list-row-main">
                  <div className="list-row-title">{m.name ?? m.email}</div>
                  <div className="list-row-meta">{m.email} · {roleLabel(m.role)} · removed — add them again to restore access</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {audit && (
        <>
          <div className="section-label">Audit trail</div>
          <div className="card">
            {audit.length === 0 && <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Nothing recorded yet.</p>}
            {audit.map((row) => (
              <div key={row.id} className="list-row">
                <div className="list-row-main">
                  <div className="list-row-title">{row.action}</div>
                  <div className="list-row-meta">{row.actorEmail ?? 'system'} · {new Date(row.ts).toLocaleString()}</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
