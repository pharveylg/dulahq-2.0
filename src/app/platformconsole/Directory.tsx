'use client';

import { useEffect, useState, useTransition } from 'react';
import {
  toggleOrgStatus,
  renameOrganization,
  updateOrgEntitlements,
  loadTenantDetail,
  setTenantAdmin,
  addTenantStaff,
  deleteTenant,
} from './actions';

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

type Person = { user_id: string | null; name: string | null; email: string | null; source: string; role: string };
type Detail = {
  people: Person[];
  clubs: { id: string; name: string }[];
  tournaments: { id: string; name: string }[];
  clubRoles: string[];
  tournamentRoles: string[];
};

function label(role: string) {
  return role.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}

function ManagePanel({ org }: { org: Org }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [adminEmail, setAdminEmail] = useState('');
  const [scope, setScope] = useState<'club' | 'tournament'>('club');
  const [scopeId, setScopeId] = useState('');
  const [staffEmail, setStaffEmail] = useState('');
  const [staffRole, setStaffRole] = useState('');
  const [confirmSlug, setConfirmSlug] = useState('');

  function reload() {
    loadTenantDetail(org.id).then((result) => {
      if ('error' in result && result.error) setError(result.error);
      else setDetail(result as Detail);
    });
  }

  useEffect(() => { reload(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [org.id]);

  const admins = detail?.people.filter((p) => p.source === 'org_members' && p.role === 'admin') ?? [];
  const scopeOptions = scope === 'club' ? detail?.clubs ?? [] : detail?.tournaments ?? [];
  const roleOptions = scope === 'club' ? detail?.clubRoles ?? [] : detail?.tournamentRoles ?? [];

  function run(action: () => Promise<{ error?: string; success?: boolean } | undefined>, done?: string) {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await action();
      if (result?.error) setError(result.error);
      else {
        if (done) setNotice(done);
        reload();
      }
    });
  }

  const deleteReady = confirmSlug.trim().toLowerCase() === org.slug;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, paddingLeft: 26, minWidth: 0 }}>
      {notice && <p style={{ fontSize: 12.5, color: 'var(--accent)', margin: 0 }}>{notice}</p>}
      {error && <p className="error-text" style={{ margin: 0 }}>{error}</p>}

      <section>
        <div className="section-label" style={{ fontSize: 11 }}>Admins</div>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 8px' }}>
          Org admins can manage every club and tournament in this organization. An organization always keeps at least one.
        </p>
        {admins.length === 0 && <p style={{ fontSize: 12.5, color: 'var(--warn)' }}>No admin on record.</p>}
        {admins.map((a) => (
          <div key={a.email ?? a.user_id ?? ''} className="list-row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <span style={{ fontSize: 13 }}>{a.name ?? a.email ?? 'Unknown'} <span style={{ color: 'var(--text-muted)' }}>{a.email}</span></span>
            <button className="btn" style={{ fontSize: 11 }} disabled={pending || admins.length <= 1}
              title={admins.length <= 1 ? 'Add another admin first' : undefined}
              onClick={() => run(() => setTenantAdmin(org.id, a.email ?? '', false), 'Admin removed.')}>
              Remove admin
            </button>
          </div>
        ))}
        <form style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}
          onSubmit={(e) => { e.preventDefault(); run(() => setTenantAdmin(org.id, adminEmail, true), 'Admin added.'); setAdminEmail(''); }}>
          <input type="email" required placeholder="Admin's Dula HQ email" value={adminEmail}
            onChange={(e) => setAdminEmail(e.target.value)} style={{ flex: 1, minWidth: 200 }} />
          <button type="submit" className="btn btn-primary" disabled={pending} style={{ fontSize: 12 }}>Add admin</button>
        </form>
      </section>

      <section>
        <div className="section-label" style={{ fontSize: 11 }}>Staff by product</div>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 8px' }}>
          Add someone to a specific club or tournament with a role for that product. They need an existing Dula HQ login.
        </p>
        <form style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}
          onSubmit={(e) => { e.preventDefault(); run(() => addTenantStaff(scope, scopeId, staffEmail, staffRole), 'Staff added.'); setStaffEmail(''); }}>
          <select value={scope} onChange={(e) => { setScope(e.target.value as 'club' | 'tournament'); setScopeId(''); setStaffRole(''); }} style={{ minWidth: 130 }}>
            {org.entitlements.includes('club') && <option value="club">Club</option>}
            {org.entitlements.includes('tournament') && <option value="tournament">Tournament</option>}
          </select>
          <select required value={scopeId} onChange={(e) => setScopeId(e.target.value)} style={{ flex: 1, minWidth: 160 }}>
            <option value="">Choose {scope === 'club' ? 'a club' : 'a tournament'}</option>
            {scopeOptions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select required value={staffRole} onChange={(e) => setStaffRole(e.target.value)} style={{ flex: 1, minWidth: 160 }}>
            <option value="">Choose role</option>
            {roleOptions.map((r) => <option key={r} value={r}>{label(r)}</option>)}
          </select>
          <input type="email" required placeholder="Their Dula HQ email" value={staffEmail}
            onChange={(e) => setStaffEmail(e.target.value)} style={{ flex: 1, minWidth: 200 }} />
          <button type="submit" className="btn btn-primary" disabled={pending || !scopeId || !staffRole} style={{ fontSize: 12 }}>Add staff</button>
        </form>
        {detail && detail.people.some((p) => p.source !== 'org_members') && (
          <div style={{ marginTop: 10 }}>
            {detail.people.filter((p) => p.source !== 'org_members').map((p, i) => (
              <div key={`${p.email}-${p.role}-${i}`} style={{ fontSize: 12.5, padding: '3px 0', color: 'var(--text-muted)' }}>
                {p.name ?? p.email ?? 'Unknown'} · {label(p.role)} <span style={{ fontSize: 11 }}>({p.source.replace(/_/g, ' ')})</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section style={{ borderTop: '1px solid var(--danger-soft-border)', paddingTop: 14 }}>
        <div className="section-label" style={{ fontSize: 11, color: 'var(--danger)' }}>Delete organization</div>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 8px' }}>
          <b style={{ color: 'var(--danger)' }}>This cannot be undone.</b> It permanently removes every club, team, player,
          guardian, family record, document, fee and invoice, tournament, entry and roster this organization owns, and
          its audit history. Minors&apos; records go with it. Other organizations&apos; entries into this organization&apos;s
          tournaments are removed too. Suspend it instead if you only need to stop access.
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input placeholder={`Type ${org.slug} to confirm`} value={confirmSlug}
            onChange={(e) => setConfirmSlug(e.target.value)} style={{ flex: 1, minWidth: 200 }} />
          <button className="btn" disabled={pending || !deleteReady}
            style={{ fontSize: 12, color: 'var(--danger)', borderColor: 'var(--danger-soft-border)' }}
            onClick={() => {
              if (!window.confirm(`Permanently delete ${org.name} and all of its data? This cannot be undone.`)) return;
              run(() => deleteTenant(org.id, confirmSlug), 'Organization deleted.');
            }}>
            Delete permanently
          </button>
        </div>
      </section>
    </div>
  );
}

function OrgRow({ org }: { org: Org }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const suspended = org.status === 'suspended';

  function handleToggle() {
    setError(null);
    if (!suspended && !window.confirm(`Suspend ${org.name}? Every member — staff, guardians, players — loses access immediately until you reactivate it.`)) return;
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
    <div className="list-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 10, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ width: 14, height: 14, borderRadius: 4, background: org.accent, flexShrink: 0, marginTop: 4, border: '1px solid var(--border-strong)' }} />
        <div className="list-row-main" style={{ minWidth: 0, flex: '1 1 200px' }}>
          <div className="list-row-title">
            {org.name}{' '}
            <span className="chip" style={suspended ? { color: 'var(--danger)', background: 'var(--danger-soft)', borderColor: 'var(--danger-soft-border)' } : { color: 'var(--accent)', background: 'var(--accent-soft)', borderColor: 'var(--accent-soft-border)' }}>
              {suspended ? 'Suspended' : 'Active'}
            </span>
          </div>
          <div className="list-row-meta">
            /{org.slug} · {org.clubCount} club{org.clubCount === 1 ? '' : 's'} · {org.memberCount} member{org.memberCount === 1 ? '' : 's'}
            {' · '}
            {org.entitlements.length > 0 ? (
              org.entitlements.map((p) => p[0].toUpperCase() + p.slice(1)).join(', ')
            ) : (
              <span style={{ color: 'var(--warn)' }}>No products — can&apos;t create anything</span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button className="btn" style={{ fontSize: 11 }} onClick={() => setExpanded((v) => !v)}>{expanded ? 'Close' : 'Manage'}</button>
          <button className="btn" style={{ fontSize: 11 }} onClick={handleToggle} disabled={pending}>
            {suspended ? 'Activate' : 'Suspend'}
          </button>
        </div>
      </div>

      {expanded && (
        <>
          <form action={handleRename} className="form-row" style={{ flexWrap: 'wrap', paddingLeft: 26, gap: 8 }}>
            <div className="form-group" style={{ flex: '2 1 160px', minWidth: 0 }}>
              <input name="name" defaultValue={org.name} required />
            </div>
            <div className="form-group" style={{ flex: '0 0 auto' }}>
              <input name="accent" type="color" defaultValue={org.accent} style={{ padding: 2, height: 38 }} />
            </div>
            <button type="submit" className="btn btn-primary" disabled={pending} style={{ fontSize: 12 }}>
              {pending ? 'Saving…' : 'Save'}
            </button>
          </form>

          {/* Uncontrolled, keyed on the entitlements so a successful save remounts
              these checkboxes with fresh defaults (see the note in git history). */}
          <form
            key={org.entitlements.join(',')}
            action={handleEntitlements}
            style={{ display: 'flex', alignItems: 'center', gap: 16, paddingLeft: 26, flexWrap: 'wrap' }}
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

          <ManagePanel org={org} />
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
