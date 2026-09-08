'use client';

import { useState, useTransition } from 'react';
import { toggleOrgStatus, renameOrganization, updateOrgEntitlements } from './actions';

type Org = {
  id: string;
  slug: string;
  name: string;
  accent: string;
  status: string;
  clubCount: number;
  memberCount: number;
  entitlements: string[];
};

function OrgRow({ org }: { org: Org }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const suspended = org.status === 'suspended';

  function handleToggle() {
    setError(null);
    startTransition(async () => {
      const result = await toggleOrgStatus(org.id, !suspended);
      if (result?.error) setError(result.error);
    });
  }

  function handleRename(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await renameOrganization(org.id, formData);
      if (result?.error) setError(result.error);
      else setExpanded(false);
    });
  }

  function handleEntitlements(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await updateOrgEntitlements(org.id, formData);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="list-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ width: 14, height: 14, borderRadius: 4, background: org.accent, flexShrink: 0, border: '1px solid var(--border-strong)' }} />
        <div className="list-row-main">
          <div className="list-row-title">
            {org.name}{' '}
            <span className="chip" style={suspended ? { color: 'var(--danger)', background: 'var(--danger-soft)', borderColor: 'var(--danger-soft-border)' } : { color: 'var(--accent)', background: 'var(--accent-soft)', borderColor: 'var(--accent-soft-border)' }}>
              {suspended ? 'Suspended' : 'Active'}
            </span>
          </div>
          <div className="list-row-meta">
            /clubs/… · {org.clubCount} club{org.clubCount === 1 ? '' : 's'} · {org.memberCount} member{org.memberCount === 1 ? '' : 's'}
            {' · '}
            {org.entitlements.length > 0 ? (
              org.entitlements.map((p) => p[0].toUpperCase() + p.slice(1)).join(', ')
            ) : (
              <span style={{ color: 'var(--warn)' }}>No products — can&apos;t create anything</span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn" style={{ fontSize: 11 }} onClick={() => setExpanded((v) => !v)}>Manage</button>
          <button className="btn" style={{ fontSize: 11 }} onClick={handleToggle} disabled={pending}>
            {suspended ? 'Activate' : 'Suspend'}
          </button>
        </div>
      </div>

      {expanded && (
        <>
          <form action={handleRename} className="form-row" style={{ flexWrap: 'wrap', paddingLeft: 26 }}>
            <div className="form-group" style={{ flex: 2, minWidth: 160 }}>
              <input name="name" defaultValue={org.name} required />
            </div>
            <div className="form-group" style={{ flex: 0, minWidth: 70 }}>
              <input name="accent" type="color" defaultValue={org.accent} style={{ padding: 2, height: 38 }} />
            </div>
            <button type="submit" className="btn btn-primary" disabled={pending} style={{ fontSize: 12 }}>
              {pending ? 'Saving…' : 'Save'}
            </button>
          </form>

          {/* Uncontrolled, like the rename form's defaultValue inputs above --
              keyed on the entitlements themselves so a successful save (which
              changes org.entitlements via revalidatePath) remounts these
              checkboxes with fresh defaults instead of showing pre-save state
              forever, which controlled checked={state} did the first time
              this was tested: the summary line updated but the boxes didn't. */}
          <form
            key={org.entitlements.join(',')}
            action={handleEntitlements}
            style={{ display: 'flex', alignItems: 'center', gap: 16, paddingLeft: 26 }}
          >
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Products:</span>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
              <input type="checkbox" name="products" value="club" defaultChecked={org.entitlements.includes('club')} />
              Club
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
              <input type="checkbox" name="products" value="tournament" defaultChecked={org.entitlements.includes('tournament')} />
              Tournament
            </label>
            <button type="submit" className="btn" disabled={pending} style={{ fontSize: 12 }}>
              {pending ? 'Saving…' : 'Save products'}
            </button>
          </form>
        </>
      )}
      {error && <p className="error-text" style={{ marginTop: 0, paddingLeft: 26 }}>{error}</p>}
    </div>
  );
}

export default function Directory({ orgs }: { orgs: Org[] }) {
  return (
    <div className="card">
      {orgs.length === 0 && <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No tenants yet — provision one to get started.</p>}
      {orgs.map((org) => <OrgRow key={org.id} org={org} />)}
    </div>
  );
}
