'use client';

import { useState, useTransition } from 'react';
import { removeStaff, assignStaffToTeam, unassignStaffFromTeam, setTeamPrimaryCoach } from './actions';

type Staff = {
  id: string;
  role: string;
  user_id: string;
  users: { name: string | null; email: string } | null;
};

type Team = { id: string; name: string };
type Assignment = { teamId: string; isPrimary: boolean };

// phase6x: assistant_coach was created with real team-scope permissions in
// phase6l and then never offered a team assignment, so none of them could be
// reached. It belongs on this list.
const TEAM_SCOPED_ROLES = ['coach', 'assistant_coach', 'team_manager'];

export default function StaffRow({
  clubId,
  staff,
  clubTeams,
  assignedTeams: assignments,
  teamsWithPrimary,
  canManageStaff,
}: {
  clubId: string;
  staff: Staff;
  clubTeams: Team[];
  assignedTeams: Assignment[];
  teamsWithPrimary: string[];
  canManageStaff: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showAssign, setShowAssign] = useState(false);

  const needsTeamAssignment = TEAM_SCOPED_ROLES.includes(staff.role);
  const assignedTeamIds = assignments.map((a) => a.teamId);
  const primaryOn = new Set(assignments.filter((a) => a.isPrimary).map((a) => a.teamId));
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

  function handleSetPrimary(teamId: string, makePrimary: boolean) {
    setError(null);
    startTransition(async () => {
      const result = await setTeamPrimaryCoach(clubId, teamId, makePrimary ? staff.user_id : null);
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
              {assignedTeams.map((t) => {
                const isPrimary = primaryOn.has(t.id);
                // Only a coach can lead a team, and only where nobody already
                // does — handing the role over is done from the current
                // holder's own row, so the change reads as a handover.
                const canOffer =
                  canManageStaff && staff.role === 'coach' && !isPrimary && !teamsWithPrimary.includes(t.id);
                return (
                  <span
                    key={t.id}
                    className="chip"
                    style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}
                  >
                    {t.name}
                    {isPrimary && (
                      <span style={{ color: 'var(--accent)', fontWeight: 600 }} title="Primary coach for this team">
                        · Primary
                      </span>
                    )}
                    {canOffer && (
                      <button
                        onClick={() => handleSetPrimary(t.id, true)}
                        disabled={pending}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', padding: 0, font: 'inherit' }}
                      >
                        Make primary
                      </button>
                    )}
                    {isPrimary && canManageStaff && (
                      <button
                        onClick={() => handleSetPrimary(t.id, false)}
                        disabled={pending}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, font: 'inherit' }}
                        title="Leave this team without a designated lead coach"
                      >
                        Step down
                      </button>
                    )}
                    <button
                      onClick={() => handleUnassign(t.id)}
                      disabled={pending}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0 }}
                      aria-label={`Unassign from ${t.name}`}
                    >
                      ×
                    </button>
                  </span>
                );
              })}
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
