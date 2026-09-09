import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient, getCurrentDulaUser } from '@/lib/supabase/server';
import ViewAsPanel, { type AccessReadout } from './ViewAsPanel';
import AccountStatusPanel from './AccountStatusPanel';

/**
 * IT administration (Club Admin spec §24). Deliberately a separate route
 * rather than a tab on the club console: spec §6 says technical
 * administration must not be mixed into the business navigation.
 */
export default async function ItAdminPage({ params }: { params: Promise<{ clubSlug: string }> }) {
  const { clubSlug } = await params;
  const dulaUser = await getCurrentDulaUser();
  if (!dulaUser) redirect('/login');

  const supabase = await createClient();
  const { data: club } = await supabase.from('clubs').select('id, name, slug').eq('slug', clubSlug).maybeSingle();
  if (!club) notFound();

  const [{ data: canImpersonate }, { data: canViewAudit }, { data: canManageAccountStatus }] = await Promise.all([
    supabase.rpc('has_staff_permission', { p_permission_key: 'impersonate_user', p_club_id: club.id }),
    supabase.rpc('has_staff_permission', { p_permission_key: 'view_audit_log', p_club_id: club.id }),
    supabase.rpc('has_staff_permission', { p_permission_key: 'manage_account_status', p_club_id: club.id }),
  ]);

  if (!canImpersonate && !canViewAudit && !canManageAccountStatus) notFound();

  const { data: directoryRows } = await supabase.rpc('it_club_directory', { p_club_id: club.id });
  const { data: activeRows } = await supabase.rpc('my_active_impersonation');
  const active = (activeRows ?? [])[0] ?? null;

  // Only this club's session is actionable from this page.
  const activeSession = active && active.club_id === club.id
    ? {
        sessionId: active.session_id,
        targetUserId: active.target_user_id,
        targetName: active.target_name,
        reason: active.reason,
        expiresAt: active.expires_at,
      }
    : null;

  let readout: AccessReadout | null = null;
  if (activeSession) {
    const { data } = await supabase.rpc('effective_access_for', {
      p_target_user_id: activeSession.targetUserId,
      p_club_id: club.id,
    });
    readout = (data as unknown as AccessReadout) ?? null;
  }

  const { data: recentSessions } = await supabase
    .from('impersonation_sessions')
    .select('id, target_user_id, reason, started_at, ended_at, expires_at')
    .eq('club_id', club.id)
    .order('started_at', { ascending: false })
    .limit(10);

  // gap analysis P0-3: view_audit_log was granted to club_manager and
  // club_it_admin and consumed by nothing -- this page checked the
  // permission to decide whether to render at all, then never rendered an
  // audit entry. Scoped strictly to scope_type='club' AND scope_id=club.id
  // (not org_id alone): this org can own more than one club, and most
  // existing write_audit() calls don't consistently tag scope_id yet, so a
  // broader org_id filter would either leak a sibling club's actions or
  // require backfilling scope_id across every call site. Under-showing is
  // the safe default; over-showing across clubs is not.
  //
  // Goes through club_audit_log() (phase6z1), not a direct select --
  // audit_log's own RLS is is_org_admin-only, so a club_manager holding
  // view_audit_log still couldn't read a row directly. Same class of gap as
  // phase6x's team-assignment bug: a permission granted with no matching
  // read path. Confirmed live before landing this: the direct-select version
  // silently showed "no activity" for an action that had just been written.
  const { data: auditRows } = canViewAudit
    ? await supabase.rpc('club_audit_log', { p_club_id: club.id })
    : { data: null };

  const directory = (directoryRows ?? []).map((d: any) => ({
    userId: d.user_id,
    name: d.name,
    email: d.email,
    role: d.role,
    status: d.status,
    isPlatformAdmin: d.is_platform_admin,
  }));

  return (
    <main className="page">
      <div className="container">
        <Link href={`/c/${clubSlug}`} className="back-link">← {club.name}</Link>
        <div className="page-header">
          <div>
            <h1>IT administration</h1>
            <p className="subtitle">
              Accounts and access troubleshooting for {club.name}. Business settings are managed by the club manager.
            </p>
          </div>
        </div>

        <div className="section-label">View as a member</div>
        <ViewAsPanel
          clubId={club.id}
          directory={directory}
          activeSession={activeSession}
          readout={readout}
          canImpersonate={!!canImpersonate}
        />

        <div className="section-label" style={{ marginTop: 28 }}>Recent view-as sessions</div>
        <div className="card">
          {(recentSessions ?? []).length === 0 && (
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>Nothing recorded yet.</p>
          )}
          {(recentSessions ?? []).map((s) => {
            const target = directory.find((d) => d.userId === s.target_user_id);
            const live = !s.ended_at && new Date(s.expires_at) > new Date();
            return (
              <div key={s.id} className="list-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 2 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <span className="list-row-title">{target?.name ?? target?.email ?? 'Unknown user'}</span>
                  <span className="chip" style={live ? { color: 'var(--warn)', background: 'var(--warn-soft)', borderColor: 'var(--warn-soft-border)' } : undefined}>
                    {live ? 'active' : 'ended'}
                  </span>
                </div>
                <div className="list-row-meta">
                  {new Date(s.started_at).toLocaleString()} · {s.reason}
                </div>
              </div>
            );
          })}
        </div>

        {canManageAccountStatus && (
          <>
            <div className="section-label" style={{ marginTop: 28 }}>Accounts</div>
            <AccountStatusPanel clubId={club.id} accounts={directory.filter((d) => d.userId !== dulaUser.id)} />
          </>
        )}

        {canViewAudit && (
          <>
            <div className="section-label" style={{ marginTop: 28 }}>Audit log</div>
            <div className="card">
              {(!auditRows || auditRows.length === 0) && (
                <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
                  No recorded activity for this club yet.
                </p>
              )}
              {(auditRows ?? []).map((r) => (
                <div key={r.id} className="list-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 2 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <span className="list-row-title">{r.action}</span>
                    <span className="list-row-meta">{new Date(r.ts).toLocaleString()}</span>
                  </div>
                  <div className="list-row-meta">
                    {r.actor_email ?? 'system'} · {r.entity_type}
                    {r.entity_id ? ` · ${r.entity_id}` : ''}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
