'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { removePlayer, addGuardian, removeGuardianLink, inviteGuardian, linkPlayerAccount, unlinkPlayerAccount } from './actions';
import PlayerFees from './PlayerFees';
import PlayerMembership from './PlayerMembership';
import Tabs from '@/components/motion/Tabs';

type Guardian = {
  linkId: string;
  guardianId: string;
  name: string;
  relationship: string;
  isPrimaryContact: boolean;
  contactInfo: { phone?: string | null; email?: string | null } | null;
  accountStatus: 'no_account' | 'invited' | 'active';
};

type FeeCharge = {
  id: string;
  feeType: string;
  amount: number;
  currency: string;
  status: 'pending' | 'paid' | 'overdue' | 'refunded';
  dueDate: string | null;
  payments: { id: string; amount: number; method: string | null; paid_at: string }[];
};

type Player = {
  id: string;
  name: string;
  jersey: string | null;
  position: string | null;
  age: string | null;
  linkedAccount: { name: string | null; email: string | null } | null;
  guardians: Guardian[];
  fees: FeeCharge[];
  memberships: { id: string; periodStart: string; periodEnd: string | null; status: string }[];
};

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'development', label: 'Development' },
  { id: 'fees', label: 'Fees' },
  { id: 'membership', label: 'Membership' },
  { id: 'family', label: 'Family' },
];

export default function PlayerDetailPanel({
  clubId,
  teamId,
  clubSlug,
  teamSlug,
  player,
  canManage,
}: {
  clubId: string;
  teamId: string;
  clubSlug: string;
  teamSlug: string;
  player: Player;
  canManage: boolean;
}) {
  const [activeTab, setActiveTab] = useState('overview');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showAddGuardian, setShowAddGuardian] = useState(false);

  function handleRemovePlayer() {
    setError(null);
    startTransition(async () => {
      const result = await removePlayer(clubId, teamId, player.id);
      if (result?.error) setError(result.error);
    });
  }

  function handleLinkAccount(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await linkPlayerAccount(clubId, teamId, player.id, formData);
      if (result?.error) setError(result.error);
    });
  }

  function handleUnlinkAccount() {
    setError(null);
    startTransition(async () => {
      const result = await unlinkPlayerAccount(clubId, teamId, player.id);
      if (result?.error) setError(result.error);
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

  function handleAddGuardian(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await addGuardian(clubId, teamId, player.id, formData);
      if (result?.error) setError(result.error);
      else setShowAddGuardian(false);
    });
  }

  const meta = [player.jersey && `#${player.jersey}`, player.position, player.age && `${player.age}y`]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 4 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--font-heading)' }}>{player.name}</div>
          {meta && <div className="list-row-meta">{meta}</div>}
        </div>
        {canManage && (
          <button className="btn" onClick={handleRemovePlayer} disabled={pending} style={{ fontSize: 11.5 }}>
            Remove player
          </button>
        )}
      </div>

      <Tabs
        tabs={TABS.map((t) => t.id === 'fees' ? { ...t, badge: player.fees.filter((f) => f.status !== 'paid').length } : t)}
        active={activeTab}
        onChange={setActiveTab}
        layoutId={`player-tabs-${player.id}`}
      />

      {activeTab === 'overview' && (
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          {player.guardians.length} guardian{player.guardians.length === 1 ? '' : 's'} linked ·{' '}
          {player.linkedAccount ? 'has a player account' : 'no player account yet'} ·{' '}
          {player.fees.length} fee charge{player.fees.length === 1 ? '' : 's'}
        </p>
      )}

      {activeTab === 'development' && (
        <div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
            Evaluations, development goals, coach notes, and the development timeline live on this player&apos;s full profile.
          </p>
          <Link href={`/clubs/${clubSlug}/teams/${teamSlug}/players/${player.id}`} className="btn btn-primary" style={{ textDecoration: 'none' }}>
            Open development profile →
          </Link>
        </div>
      )}

      {activeTab === 'fees' && (
        <PlayerFees clubId={clubId} teamId={teamId} playerId={player.id} charges={player.fees} canManage={canManage} />
      )}

      {activeTab === 'membership' && (
        <PlayerMembership clubId={clubId} teamId={teamId} playerId={player.id} memberships={player.memberships} canManage={canManage} />
      )}

      {activeTab === 'family' && (
        <div>
          <div className="section-label" style={{ fontSize: 11 }}>Guardians</div>
          {player.guardians.length === 0 && (
            <p style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>No guardians linked yet.</p>
          )}
          {player.guardians.map((g) => (
            <div
              key={g.linkId}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border)' }}
            >
              <span style={{ fontSize: 13 }}>
                {g.name}
                <span style={{ color: 'var(--text-muted)' }}>
                  {' '}
                  · {g.relationship}
                  {g.contactInfo?.phone ? ` · ${g.contactInfo.phone}` : ''}
                  {g.contactInfo?.email ? ` · ${g.contactInfo.email}` : ''}
                </span>
                {g.accountStatus !== 'no_account' && (
                  <span className="chip" style={{ marginLeft: 6, fontSize: 10 }}>{g.accountStatus}</span>
                )}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {canManage && g.accountStatus === 'no_account' && (
                  <button
                    onClick={() => handleInviteGuardian(g.guardianId, g.contactInfo?.email)}
                    disabled={pending || !g.contactInfo?.email}
                    title={g.contactInfo?.email ? undefined : 'Add an email first'}
                    style={{ background: 'none', border: 'none', cursor: g.contactInfo?.email ? 'pointer' : 'not-allowed', color: 'var(--accent)', fontSize: 12 }}
                  >
                    Invite
                  </button>
                )}
                {canManage && (
                  <button
                    onClick={() => handleRemoveGuardian(g.linkId)}
                    disabled={pending}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 12 }}
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          ))}

          {canManage && !showAddGuardian && (
            <button className="btn" style={{ fontSize: 11.5, marginTop: 8 }} onClick={() => setShowAddGuardian(true)}>
              + Add guardian
            </button>
          )}

          {canManage && showAddGuardian && (
            <form action={handleAddGuardian} className="form-row" style={{ marginTop: 8, flexWrap: 'wrap' }}>
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

          <div className="section-label" style={{ fontSize: 11, marginTop: 20 }}>Player account</div>
          {player.linkedAccount ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ fontSize: 13 }}>
                Linked to {player.linkedAccount.name ?? player.linkedAccount.email}
                {player.linkedAccount.email && player.linkedAccount.name && (
                  <span style={{ color: 'var(--text-muted)' }}> · {player.linkedAccount.email}</span>
                )}
              </span>
              {canManage && (
                <button
                  onClick={handleUnlinkAccount}
                  disabled={pending}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 12 }}
                >
                  Unlink
                </button>
              )}
            </div>
          ) : (
            <>
              <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: 0 }}>
                No player account linked yet.
              </p>
              {canManage && (
                <form action={handleLinkAccount} className="form-row" style={{ marginTop: 8, flexWrap: 'wrap' }}>
                  <div className="form-group" style={{ flex: 1, minWidth: 180 }}>
                    <input name="email" type="email" placeholder="Their Dula HQ email" required />
                  </div>
                  <button type="submit" className="btn btn-primary" disabled={pending} style={{ fontSize: 12 }}>
                    {pending ? 'Linking…' : 'Link'}
                  </button>
                </form>
              )}
              {canManage && (
                <p style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 6 }}>
                  They need an existing Dula HQ account first (e.g. their own guardian account).
                </p>
              )}
            </>
          )}
        </div>
      )}

      {error && <p className="error-text" style={{ marginTop: 12 }}>{error}</p>}
    </div>
  );
}
