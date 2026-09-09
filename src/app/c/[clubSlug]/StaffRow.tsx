'use client';

import { useState, useTransition } from 'react';
import { removeStaff, assignStaffToTeam, unassignStaffFromTeam, setTeamPrimaryCoach } from './actions';
import { upsertMyStaffProfile } from './staff-profile-actions';

type Staff = {
  id: string;
  role: string;
  user_id: string;
  users: { name: string | null; email: string } | null;
};

type Certification = { name: string; issuer: string; expiresOn: string | null };
type StaffProfile = {
  phone: string | null;
  bio: string | null;
  photoUrl: string | null;
  certifications: Certification[];
};

type Team = { id: string; name: string };
type Assignment = { teamId: string; isPrimary: boolean };

// phase6x: assistant_coach was created with real team-scope permissions in
// phase6l and then never offered a team assignment, so none of them could be
// reached. It belongs on this list.
const TEAM_SCOPED_ROLES = ['coach', 'assistant_coach', 'team_manager'];

/**
 * P1-7 (gap analysis §1): self-editable phone/bio/photo/certifications,
 * layered on club_staff without duplicating anything users/club_staff
 * already own. Read-only for everyone viewing someone else's row; the edit
 * form only appears on the viewer's own row (isSelf).
 */
function ProfileEditor({ clubId, staffId, profile }: { clubId: string; staffId: string; profile: StaffProfile | null }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [certs, setCerts] = useState<Certification[]>(profile?.certifications ?? []);
  const [certName, setCertName] = useState('');
  const [certIssuer, setCertIssuer] = useState('');
  const [certExpires, setCertExpires] = useState('');

  function addCert() {
    if (!certName.trim()) return;
    setCerts((c) => [...c, { name: certName.trim(), issuer: certIssuer.trim(), expiresOn: certExpires || null }]);
    setCertName('');
    setCertIssuer('');
    setCertExpires('');
  }

  function removeCert(i: number) {
    setCerts((c) => c.filter((_, idx) => idx !== i));
  }

  function handleSave(formData: FormData) {
    setError(null);
    formData.set('certifications', JSON.stringify(certs));
    startTransition(async () => {
      const result = await upsertMyStaffProfile(clubId, formData);
      if (result?.error) setError(result.error);
      else setEditing(false);
    });
  }

  if (!editing) {
    return (
      <button className="btn" style={{ fontSize: 11.5 }} onClick={() => setEditing(true)}>
        {profile ? 'Edit my profile' : 'Add my profile'}
      </button>
    );
  }

  return (
    <form action={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 360, marginTop: 8 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        {profile?.photoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={profile.photoUrl} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--border)' }} />
        )}
        <input name="photo" type="file" accept="image/jpeg,image/png,image/webp" style={{ fontSize: 12 }} />
      </div>
      <input name="phone" placeholder="Phone" defaultValue={profile?.phone ?? ''} style={{ fontSize: 12.5 }} />
      <textarea name="bio" placeholder="Short bio" defaultValue={profile?.bio ?? ''} rows={2} style={{ fontSize: 12.5, resize: 'vertical' }} />

      <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Certifications</div>
      {certs.map((c, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
          <span style={{ flex: 1 }}>
            {c.name}{c.issuer ? ` — ${c.issuer}` : ''}{c.expiresOn ? ` (expires ${c.expiresOn})` : ''}
          </span>
          <button type="button" onClick={() => removeCert(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
            ×
          </button>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <input placeholder="Name" value={certName} onChange={(e) => setCertName(e.target.value)} style={{ fontSize: 12, flex: '1 1 100px' }} />
        <input placeholder="Issuer" value={certIssuer} onChange={(e) => setCertIssuer(e.target.value)} style={{ fontSize: 12, flex: '1 1 90px' }} />
        <input type="date" value={certExpires} onChange={(e) => setCertExpires(e.target.value)} style={{ fontSize: 12, flex: '1 1 100px' }} />
        <button type="button" className="btn" style={{ fontSize: 11 }} onClick={addCert}>Add</button>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button type="submit" className="btn btn-primary" disabled={pending} style={{ fontSize: 12 }}>
          {pending ? 'Saving…' : 'Save'}
        </button>
        <button type="button" className="btn" style={{ fontSize: 12 }} onClick={() => setEditing(false)} disabled={pending}>
          Cancel
        </button>
      </div>
      {error && <span className="error-text">{error}</span>}
    </form>
  );
}

export default function StaffRow({
  clubId,
  staff,
  clubTeams,
  assignedTeams: assignments,
  teamsWithPrimary,
  canManageStaff,
  profile,
  isSelf,
}: {
  clubId: string;
  staff: Staff;
  clubTeams: Team[];
  assignedTeams: Assignment[];
  teamsWithPrimary: string[];
  canManageStaff: boolean;
  profile?: StaffProfile | null;
  isSelf?: boolean;
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {profile?.photoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.photoUrl} alt="" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--border)' }} />
          )}
          <div className="list-row-main">
            <div className="list-row-title">{staff.users?.name ?? staff.users?.email ?? 'Unknown'}</div>
            <div className="list-row-meta">
              {staff.users?.email}
              {profile?.phone ? ` · ${profile.phone}` : ''}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className={`chip chip-${staff.role}`}>{staff.role}</span>
          <button className="btn" onClick={handleRemoveStaff} disabled={pending} style={{ fontSize: 12 }}>
            Remove
          </button>
        </div>
      </div>

      {profile?.bio && <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: '0 0 0 2px' }}>{profile.bio}</p>}
      {profile && profile.certifications.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginLeft: 2 }}>
          {profile.certifications.map((c, i) => (
            <span key={i} className="chip" style={{ fontSize: 10.5 }} title={c.expiresOn ? `Expires ${c.expiresOn}` : undefined}>
              {c.name}{c.issuer ? ` (${c.issuer})` : ''}
            </span>
          ))}
        </div>
      )}
      {isSelf && (
        <div style={{ marginLeft: 2 }}>
          <ProfileEditor clubId={clubId} staffId={staff.id} profile={profile ?? null} />
        </div>
      )}

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
