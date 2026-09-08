'use client';

import { useState, useTransition } from 'react';
// Reusing the team roster's own guardian/account actions rather than
// duplicating them -- they're already club/team-scoped and RLS-authorized,
// not coupled to that route beyond living in its folder.
import {
  addGuardian,
  removeGuardianLink,
  inviteGuardian,
  linkPlayerAccount,
  unlinkPlayerAccount,
  setGuardianPermission,
} from '@/app/c/[clubSlug]/teams/[teamSlug]/actions';

type Guardian = {
  linkId: string;
  guardianId: string;
  name: string;
  relationship: string;
  isPrimaryContact: boolean;
  contactInfo: { phone?: string | null; email?: string | null } | null;
  accountStatus: 'no_account' | 'invited' | 'active';
};

type LinkedAccount = { name: string | null; email: string | null } | null;
type GuardianPermission = { key: string; label: string; granted: boolean; isOverride: boolean };

/**
 * "Who is connected to this player, and what access do they have?" (Player
 * Profile spec §Family). canManage governs the same add/remove/invite/link
 * controls PlayerDetailPanel.tsx already has for the roster-row quick view --
 * this is the full-page equivalent, shown to coach/staff. Player and
 * guardian viewers pass canManage=false and see a plain read-only list.
 */
export default function Family({
  clubId,
  teamId,
  playerId,
  orgId,
  guardians,
  linkedAccount,
  canManage,
  guardianPermissions = {},
}: {
  clubId: string;
  teamId: string;
  playerId: string;
  orgId: string;
  guardians: Guardian[];
  linkedAccount: LinkedAccount;
  canManage: boolean;
  guardianPermissions?: Record<string, GuardianPermission[]>;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showAddGuardian, setShowAddGuardian] = useState(false);
  const [expandedPermissions, setExpandedPermissions] = useState<string | null>(null);

  function handleTogglePermission(linkId: string, key: string, currentlyGranted: boolean) {
    setError(null);
    startTransition(async () => {
      const result = await setGuardianPermission(linkId, key, currentlyGranted ? 'revoked' : 'granted', orgId);
      if (result?.error) setError(result.error);
    });
  }

  function handleResetPermission(linkId: string, key: string) {
    setError(null);
    startTransition(async () => {
      const result = await setGuardianPermission(linkId, key, 'reset', orgId);
      if (result?.error) setError(result.error);
    });
  }

  function handleAddGuardian(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await addGuardian(clubId, teamId, playerId, formData);
      if (result?.error) setError(result.error);
      else setShowAddGuardian(false);
    });
  }

  function handleInviteGuardian(guardianId: string, email: string | null | undefined) {
    setError(null);
    startTransition(async () => {
      const result = await inviteGuardian(clubId, teamId, guardianId, email ?? '');
      if (result?.error) setError(result.error);
    });
  }

  function handleRemoveGuardian(linkId: string) {
    setError(null);
    startTransition(async () => {
      const result = await removeGuardianLink(clubId, teamId, linkId);
      if (result?.error) setError(result.error);
    });
  }

  function handleLinkAccount(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await linkPlayerAccount(clubId, teamId, playerId, formData);
      if (result?.error) setError(result.error);
    });
  }

  function handleUnlinkAccount() {
    setError(null);
    startTransition(async () => {
      const result = await unlinkPlayerAccount(clubId, teamId, playerId);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div>
      <div className="section-label" style={{ fontSize: 11 }}>Guardians</div>
      {guardians.length === 0 && (
        <p style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>No guardians linked yet.</p>
      )}
      <div className="card" style={{ marginBottom: canManage ? 8 : 20 }}>
        {guardians.map((g) => {
          const perms = guardianPermissions[g.linkId];
          const overrideCount = perms?.filter((p) => p.isOverride).length ?? 0;
          const expanded = expandedPermissions === g.linkId;
          return (
            <div key={g.linkId} style={{ padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
              <div className="list-row" style={{ borderBottom: 'none', padding: 0 }}>
                <span style={{ fontSize: 13 }}>
                  {g.name}
                  <span style={{ color: 'var(--text-muted)' }}>
                    {' '}
                    · {g.relationship.replace('_', ' ')}
                    {canManage && g.contactInfo?.phone ? ` · ${g.contactInfo.phone}` : ''}
                    {canManage && g.contactInfo?.email ? ` · ${g.contactInfo.email}` : ''}
                  </span>
                  {g.accountStatus !== 'no_account' && (
                    <span className="chip" style={{ marginLeft: 6, fontSize: 10 }}>{g.accountStatus}</span>
                  )}
                </span>
                {canManage && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {perms && (
                      <button
                        onClick={() => setExpandedPermissions(expanded ? null : g.linkId)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontSize: 12 }}
                      >
                        Permissions{overrideCount > 0 ? ` (${overrideCount} custom)` : ''}
                      </button>
                    )}
                    {g.accountStatus === 'no_account' && (
                      <button
                        onClick={() => handleInviteGuardian(g.guardianId, g.contactInfo?.email)}
                        disabled={pending || !g.contactInfo?.email}
                        title={g.contactInfo?.email ? undefined : 'Add an email first'}
                        style={{ background: 'none', border: 'none', cursor: g.contactInfo?.email ? 'pointer' : 'not-allowed', color: 'var(--accent)', fontSize: 12 }}
                      >
                        Invite
                      </button>
                    )}
                    <button
                      onClick={() => handleRemoveGuardian(g.linkId)}
                      disabled={pending}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 12 }}
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>

              {expanded && perms && (
                <div style={{ marginTop: 8, marginLeft: 2, padding: 10, background: 'var(--surface-2, rgba(0,0,0,.02))', borderRadius: 'var(--radius, 6px)' }}>
                  <p style={{ fontSize: 11.5, color: 'var(--text-muted)', margin: '0 0 8px' }}>
                    What {g.name} can see and do for this player. Unchecked items follow the default for every guardian unless overridden here.
                  </p>
                  {perms.map((p) => (
                    <div key={p.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '3px 0' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={p.granted}
                          disabled={pending}
                          onChange={() => handleTogglePermission(g.linkId, p.key, p.granted)}
                        />
                        {p.label}
                      </label>
                      {p.isOverride && (
                        <button
                          onClick={() => handleResetPermission(g.linkId, p.key)}
                          disabled={pending}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 11 }}
                        >
                          Reset to default
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {canManage && !showAddGuardian && (
        <button className="btn" style={{ fontSize: 11.5, marginBottom: 20 }} onClick={() => setShowAddGuardian(true)}>
          + Add guardian
        </button>
      )}
      {canManage && showAddGuardian && (
        <form action={handleAddGuardian} className="form-row" style={{ marginBottom: 20, flexWrap: 'wrap' }}>
          <div className="form-group" style={{ flex: 2, minWidth: 130 }}>
            <input name="name" placeholder="Guardian name" required />
          </div>
          <div className="form-group" style={{ flex: 1, minWidth: 110 }}>
            <select name="relationship" defaultValue="parent">
              <option value="parent">Parent</option>
              <option value="legal_guardian">Legal guardian</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="form-group" style={{ flex: 1, minWidth: 110 }}>
            <input name="phone" placeholder="Phone" />
          </div>
          <div className="form-group" style={{ flex: 1, minWidth: 140 }}>
            <input name="email" type="email" placeholder="Email" />
          </div>
          <button type="submit" className="btn btn-primary" disabled={pending} style={{ fontSize: 12 }}>
            {pending ? 'Saving…' : 'Save'}
          </button>
        </form>
      )}

      {canManage && (
        <>
          <div className="section-label" style={{ fontSize: 11 }}>Player account</div>
          {linkedAccount ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ fontSize: 13 }}>
                Linked to {linkedAccount.name ?? linkedAccount.email}
                {linkedAccount.email && linkedAccount.name && <span style={{ color: 'var(--text-muted)' }}> · {linkedAccount.email}</span>}
              </span>
              <button onClick={handleUnlinkAccount} disabled={pending} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 12 }}>
                Unlink
              </button>
            </div>
          ) : (
            <>
              <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: 0 }}>No player account linked yet.</p>
              <form action={handleLinkAccount} className="form-row" style={{ marginTop: 8, flexWrap: 'wrap' }}>
                <div className="form-group" style={{ flex: 1, minWidth: 180 }}>
                  <input name="email" type="email" placeholder="Their Dula HQ email" required />
                </div>
                <button type="submit" className="btn btn-primary" disabled={pending} style={{ fontSize: 12 }}>
                  {pending ? 'Linking…' : 'Link'}
                </button>
              </form>
              <p style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 6 }}>
                They need an existing Dula HQ account first (e.g. their own guardian account).
              </p>
            </>
          )}
        </>
      )}

      {error && <p className="error-text" style={{ marginTop: 12 }}>{error}</p>}
    </div>
  );
}
