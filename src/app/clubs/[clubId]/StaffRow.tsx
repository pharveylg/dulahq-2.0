'use client';

import { useState, useTransition } from 'react';
import { removeStaff, assignStaffToTeam, unassignStaffFromTeam } from './actions';

type Staff = {
  id: string;
  role: string;
  user_id: string;
  users: { name: string | null; email: string } | null;
};

type Team = { id: string; name: string };

export default function StaffRow({
  clubId,
  staff,
  clubTeams,
  assignedTeamIds,
}: {
  clubId: string;
  staff: Staff;
  clubTeams: Team[];
  assignedTeamIds: string[];
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showAssign, setShowAssign] = useState(false);

  const needsTeamAssignment = staff.role === 'coach' || staff.role === 'team_manager';
  const assignedTeams = clubTeams.filter((t) => assignedTeamIds.includes(t.id));
  const unassignedClubTeams = clubTeams.filter((t) => !assignedTeamIds.includes(t.id));

  function handleRemoveStaff() {
    setError(null);
    startTransition(async () => {
      const result = await removeStaff(clubId, staff.id);
      if (result?.error) setError(result.error);
    });
  }

  function handleAssign(teamId: string) {
    setError(null);
    const fd = new FormData();
    fd.set('userId', staff.user_id);
    fd.set('teamId', teamId);
    startTransition(async () => {
      const result = await assignStaffToTeam(clubId, fd);
      if (result?.error) setError(result.error);
      else setShowAssign(false);
    });
  }

  function handleUnassign(teamId: string) {
    setError(null);
    startTransition(async () => {
      const result = await unassignStaffFromTeam(clubId, staff.user_id, teamId);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="list-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div className="list-row-main">
          <div className="list-row-title">{staff.users?.name ?? staff.users?.email ?? 'Unknown'}</div>
          <div className="list-row-meta">{staff.users?.email}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className={`chip chip-${staff.role}`}>{staff.role}</span>
          <button className="btn" onClick={handleRemoveStaff} disabled={pending} style={{ fontSize: 12 }}>
            Remove
          </button>
        </div>
      </div>

      {needsTeamAssignment && (
        <div style={{ paddingLeft: 2 }}>
          {assignedTeams.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
              {assignedTeams.map((t) => (
                <span key={t.id} className="chip" style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                  {t.name}
                  <button
                    onClick={() => handleUnassign(t.id)}
                    disabled={pending}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0 }}
                    aria-label={`Unassign from ${t.name}`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
          {!showAssign && unassignedClubTeams.length > 0 && (
            <button className="btn" style={{ fontSize: 11.5 }} onClick={() => setShowAssign(true)}>
              + Assign to team
            </button>
          )}
          {showAssign && (
            <select
              defaultValue=""
              onChange={(e) => e.target.value && handleAssign(e.target.value)}
              style={{ fontSize: 12.5, padding: '4px 8px' }}
            >
              <option value="" disabled>Choose a team…</option>
              {unassignedClubTeams.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          )}
        </div>
      )}

      {error && <p className="error-text" style={{ marginTop: 0 }}>{error}</p>}
    </div>
  );
}
