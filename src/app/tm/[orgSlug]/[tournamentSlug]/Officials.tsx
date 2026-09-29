'use client';

import { useState, useTransition } from 'react';
import { addOrgOfficial, setOrgOfficialActive, assignOfficial, removeOfficialAssignment } from './actions';

export type OrgOfficial = { id: string; fullName: string; grade: string | null; designation: string | null; phone: string | null; email: string | null; active: boolean };
export type OfficialAssignment = { id: string; officialId: string; officialName: string; role: string };

const ROLE_LABEL: Record<string, string> = {
  referee: 'Referee',
  assistant_referee: 'Assistant referee',
  fourth_official: 'Fourth official',
  commissioner: 'Commissioner',
  table_official: 'Table official',
};

function AddOfficialForm({ orgId }: { orgId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const r = await addOrgOfficial(orgId, formData);
      if (r?.error) setError(r.error); else (e.target as HTMLFormElement).reset();
    });
  }

  return (
    <form onSubmit={submit} className="card" style={{ display: 'grid', gap: 8, marginBottom: 16 }}>
      <div className="section-label">Add an official</div>
      <div className="form-row" style={{ flexWrap: 'wrap' }}>
        <div className="form-group" style={{ flex: 2, minWidth: 160 }}>
          <label htmlFor="off-name">Name</label>
          <input id="off-name" name="fullName" required />
        </div>
        <div className="form-group" style={{ flex: 1, minWidth: 120 }}>
          <label htmlFor="off-grade">Grade</label>
          <input id="off-grade" name="grade" placeholder="e.g. National" />
        </div>
        <div className="form-group" style={{ flex: 1, minWidth: 140 }}>
          <label htmlFor="off-designation">Designation</label>
          <input id="off-designation" name="designation" />
        </div>
      </div>
      <div className="form-row" style={{ flexWrap: 'wrap' }}>
        <div className="form-group" style={{ flex: 1, minWidth: 140 }}>
          <label htmlFor="off-phone">Phone</label>
          <input id="off-phone" name="phone" />
        </div>
        <div className="form-group" style={{ flex: 1, minWidth: 160 }}>
          <label htmlFor="off-email">Email</label>
          <input id="off-email" name="email" type="email" />
        </div>
      </div>
      {error && <p className="error-text" style={{ margin: 0 }}>{error}</p>}
      <button type="submit" className="btn btn-primary" disabled={pending} style={{ justifySelf: 'start' }}>
        {pending ? 'Adding…' : 'Add official'}
      </button>
    </form>
  );
}

function PoolRow({ official, canManagePool }: { official: OrgOfficial; canManagePool: boolean }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    setError(null);
    startTransition(async () => {
      const r = await setOrgOfficialActive(official.id, !official.active);
      if (r?.error) setError(r.error);
    });
  }

  return (
    <div className="list-row">
      <div className="list-row-main">
        <div className="list-row-title">{official.fullName}</div>
        <div className="list-row-meta">
          {[official.grade, official.designation].filter(Boolean).join(' · ') || 'No grade or designation on file'}
          {official.email ? ` · ${official.email}` : ''}
        </div>
        {error && <p className="error-text" style={{ margin: '4px 0 0' }}>{error}</p>}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <span className="chip" style={!official.active ? { color: 'var(--text-muted)' } : undefined}>{official.active ? 'active' : 'inactive'}</span>
        {canManagePool && (
          <button className="btn" style={{ fontSize: 11.5 }} disabled={pending} onClick={toggle}>
            {official.active ? 'Deactivate' : 'Reactivate'}
          </button>
        )}
      </div>
    </div>
  );
}

function AssignForm({ tournamentId, orgId, pool }: { tournamentId: string; orgId: string; pool: OrgOfficial[] }) {
  const [officialId, setOfficialId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const available = pool.filter((o) => o.active);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const r = await assignOfficial(tournamentId, orgId, formData);
      if (r?.error) setError(r.error); else setOfficialId('');
    });
  }

  if (available.length === 0) {
    return <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: '0 0 16px' }}>No active officials in the pool to assign yet.</p>;
  }

  return (
    <form onSubmit={submit} className="card" style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 16 }}>
      <div className="form-group" style={{ flex: 2, minWidth: 180, margin: 0 }}>
        <label htmlFor="assign-official">Official</label>
        <select id="assign-official" name="officialId" value={officialId} onChange={(e) => setOfficialId(e.target.value)} required>
          <option value="" disabled>Choose…</option>
          {available.map((o) => <option key={o.id} value={o.id}>{o.fullName}</option>)}
        </select>
      </div>
      <div className="form-group" style={{ flex: 1, minWidth: 160, margin: 0 }}>
        <label htmlFor="assign-role">Role</label>
        <select id="assign-role" name="role" defaultValue="referee">
          {Object.entries(ROLE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>
      <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? 'Assigning…' : 'Assign'}</button>
      {error && <p className="error-text" style={{ margin: 0, flexBasis: '100%' }}>{error}</p>}
    </form>
  );
}

function AssignmentRow({ assignment, canAssign }: { assignment: OfficialAssignment; canAssign: boolean }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function remove() {
    setError(null);
    startTransition(async () => {
      const r = await removeOfficialAssignment(assignment.id);
      if (r?.error) setError(r.error);
    });
  }

  return (
    <div className="list-row">
      <div className="list-row-main">
        <div className="list-row-title">{assignment.officialName}</div>
        <div className="list-row-meta">{ROLE_LABEL[assignment.role] ?? assignment.role}</div>
        {error && <p className="error-text" style={{ margin: '4px 0 0' }}>{error}</p>}
      </div>
      {canAssign && <button className="btn" style={{ fontSize: 11.5 }} disabled={pending} onClick={remove}>Remove</button>}
    </div>
  );
}

export default function Officials({
  tournamentId,
  orgId,
  pool,
  assignments,
  canAssign,
  canManagePool,
}: {
  tournamentId: string;
  orgId: string;
  pool: OrgOfficial[];
  assignments: OfficialAssignment[];
  canAssign: boolean;
  canManagePool: boolean;
}) {
  return (
    <>
      <div className="section-label">This tournament</div>
      {canAssign && <AssignForm tournamentId={tournamentId} orgId={orgId} pool={pool} />}
      <div className="card" style={{ marginBottom: 24 }}>
        {assignments.length === 0 && <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>Nobody assigned yet.</p>}
        {assignments.map((a) => <AssignmentRow key={a.id} assignment={a} canAssign={canAssign} />)}
      </div>

      <div className="section-label">Organization's officials pool</div>
      <p style={{ margin: '0 0 12px', fontSize: 12.5, color: 'var(--text-muted)' }}>
        Spans every tournament this organization runs. {canManagePool ? '' : 'Only an organization admin adds or deactivates one.'}
      </p>
      {canManagePool && <AddOfficialForm orgId={orgId} />}
      <div className="card">
        {pool.length === 0 && <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>No officials on file for this organization yet.</p>}
        {pool.map((o) => <PoolRow key={o.id} official={o} canManagePool={canManagePool} />)}
      </div>
    </>
  );
}
