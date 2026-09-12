'use client';

import { useState, useTransition } from 'react';
import { listOrgPeople, startPlatformViewAs, endPlatformViewAs, getEffectiveAccessForPlatform } from './troubleshoot-actions';

type Org = { id: string; name: string; entitlements: string[] };
type Person = { user_id: string; name: string | null; email: string; source: string; role: string };
type ActiveSession = {
  session_id: string;
  org_id: string;
  org_name: string;
  target_user_id: string;
  target_name: string | null;
  reason: string;
  expires_at: string;
};

const SOURCE_LABEL: Record<string, string> = {
  club_staff: 'Club staff',
  tournament_staff: 'Tournament staff',
  tournament_entry_contact: 'External entry contact',
  org_member: 'Org admin',
};

export default function Troubleshoot({ orgs, activeSession: initialActiveSession }: { orgs: Org[]; activeSession: ActiveSession | null }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [orgId, setOrgId] = useState('');
  const [people, setPeople] = useState<Person[] | null>(null);
  const [readout, setReadout] = useState<any>(null);
  const [readoutFor, setReadoutFor] = useState<{ userId: string; name: string } | null>(null);
  // Server-rendered on page load only -- revalidatePath() invalidates the
  // route for the NEXT navigation, but this client tree keeps its own copy,
  // so start/end have to update it directly or the banner goes stale (an
  // ended session that still reads "Active" is worse than no banner).
  const [activeSession, setActiveSession] = useState(initialActiveSession);

  const selectedOrg = orgs.find((o) => o.id === orgId);

  function loadPeople(id: string) {
    setError(null);
    setOrgId(id);
    setPeople(null);
    setReadout(null);
    if (!id) return;
    startTransition(async () => {
      const result = await listOrgPeople(id);
      if (result.error) setError(result.error);
      else setPeople(result.people ?? []);
    });
  }

  function viewAs(person: Person) {
    const reason = window.prompt(`Why are you viewing as ${person.name ?? person.email}?`);
    if (!reason?.trim()) return;
    setError(null);
    startTransition(async () => {
      const result = await startPlatformViewAs(orgId, person.user_id, reason);
      if (result.error) { setError(result.error); return; }
      if (result.session) setActiveSession(result.session);
      const access = await getEffectiveAccessForPlatform(person.user_id, orgId);
      if (access.error) setError(access.error);
      else { setReadout(access.readout); setReadoutFor({ userId: person.user_id, name: person.name ?? person.email }); }
    });
  }

  function endSession(sessionId: string) {
    setError(null);
    startTransition(async () => {
      const result = await endPlatformViewAs(sessionId);
      if (result.error) setError(result.error);
      else { setReadout(null); setReadoutFor(null); setActiveSession(null); }
    });
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {activeSession && (
        <div className="card" style={{ borderColor: 'var(--warn-soft-border)', background: 'var(--warn-soft)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 13.5 }}>
              Active session: viewing as <strong>{activeSession.target_name ?? 'a user'}</strong> in{' '}
              <strong>{activeSession.org_name}</strong> — expires {new Date(activeSession.expires_at).toLocaleTimeString()}
            </div>
            <button className="btn" disabled={pending} onClick={() => endSession(activeSession.session_id)}>End session</button>
          </div>
        </div>
      )}

      <div className="card">
        <h2 style={{ fontSize: 18, marginBottom: 4 }}>Cross-org troubleshooting</h2>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 0 }}>
          Inspect any organization's people — club or tournament, or both — without changing what you can access.
          Every session is logged, and every audited action stays attributed to you, not the person you're viewing as.
        </p>
        <div className="form-group" style={{ maxWidth: 360 }}>
          <label>Organization</label>
          <select value={orgId} onChange={(e) => loadPeople(e.target.value)}>
            <option value="">Select an organization</option>
            {orgs.map((o) => (
              <option key={o.id} value={o.id}>{o.name}{o.entitlements.length ? ` (${o.entitlements.join(', ')})` : ' — no entitlements'}</option>
            ))}
          </select>
        </div>
        {error && <p className="error-text">{error}</p>}
      </div>

      {selectedOrg && people && (
        <div className="card">
          <h2 style={{ fontSize: 16, marginBottom: 8 }}>People in {selectedOrg.name}</h2>
          {people.length === 0 && <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No club staff, tournament staff, or entry contacts found for this org.</p>}
          {people.map((p) => (
            <div key={`${p.source}-${p.user_id}`} className="list-row">
              <div className="list-row-main">
                <div className="list-row-title">{p.name ?? p.email}</div>
                <div className="list-row-meta">{p.email} · {SOURCE_LABEL[p.source] ?? p.source} · {p.role}</div>
              </div>
              <button className="btn" disabled={pending} onClick={() => viewAs(p)}>View as</button>
            </div>
          ))}
        </div>
      )}

      {readout && readoutFor && (
        <div className="card">
          <h2 style={{ fontSize: 16, marginBottom: 8 }}>Effective access — {readoutFor.name}</h2>
          <p style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
            Entitlements: {(readout.entitlements ?? []).join(', ') || 'none'}
          </p>
          {readout.has_no_known_relationship && (
            <p style={{ fontSize: 13, color: 'var(--warn)' }}>No active club or tournament role found for this person in this org.</p>
          )}
          {(readout.club_memberships ?? []).map((m: any) => (
            <div key={m.club_id} style={{ padding: '10px 0', borderTop: '1px solid var(--border)' }}>
              <strong style={{ fontSize: 13.5 }}>{m.club_name}</strong> — {m.role}
              {m.is_player && ' · player'}{m.is_guardian && ' · guardian'}
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                {(m.permissions ?? []).map((perm: any) => perm.label).join(', ') || 'No club permissions'}
              </div>
            </div>
          ))}
          {(readout.tournament_memberships ?? []).map((m: any) => (
            <div key={m.tournament_id} style={{ padding: '10px 0', borderTop: '1px solid var(--border)' }}>
              <strong style={{ fontSize: 13.5 }}>{m.tournament_name}</strong> — {m.role}
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                {(m.permissions ?? []).map((perm: any) => perm.label).join(', ') || 'No tournament permissions'}
              </div>
            </div>
          ))}
          {(readout.tournament_entry_contacts ?? []).length > 0 && (
            <div style={{ padding: '10px 0', borderTop: '1px solid var(--border)' }}>
              <strong style={{ fontSize: 13.5 }}>External entry contact</strong>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                {readout.tournament_entry_contacts.map((c: any, i: number) => (
                  <div key={i}>{c.role} · {c.account_status}</div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
