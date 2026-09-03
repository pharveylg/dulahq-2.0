import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient, getClubAccess, getAssignedTeamIds } from '@/lib/supabase/server';
import EditNameForm from './EditNameForm';
import AddStaffForm from './AddStaffForm';
import LinkTeamForm from './LinkTeamForm';
import StaffRow from './StaffRow';
import Trips from './Trips';
import Announcements from './Announcements';
import MediaGallery from './MediaGallery';
import { getDownloadUrl } from '../../../../shared/files/lib/r2';

export default async function ClubDetailPage({ params }: { params: Promise<{ clubSlug: string }> }) {
  const { clubSlug } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: club, error: clubError } = await supabase
    .from('clubs')
    .select('id, slug, name, created_at')
    .eq('slug', clubSlug)
    .maybeSingle();

  if (clubError) {
    return (
      <main className="page">
        <div className="container">
          <p className="error-text">Couldn&apos;t load this club: {clubError.message}</p>
        </div>
      </main>
    );
  }
  if (!club) notFound();

  // Everything below this line uses club.id (the real UUID) for every
  // query/action/RLS check exactly as before slugs existed -- only the
  // route param and the hrefs built for navigation use the slug.
  const clubId = club.id;

  // access.isClubAdmin gates club-wide actions (rename, staff, link teams,
  // any-audience announcements); access.isStaff gates the broader "any
  // club_staff role" actions RLS still allows unscoped (trips, media).
  const access = await getClubAccess(clubId);
  const canManage = access.isClubAdmin;
  const canManageWide = access.isStaff;
  const myAssignedTeamIds = access.isClubAdmin ? [] : await getAssignedTeamIds();

  const { data: staffRows } = await supabase
    .from('club_staff')
    .select('id, role, user_id, users(name, email)')
    .eq('club_id', clubId)
    .order('role');

  const { data: clubTeams } = await supabase
    .from('teams')
    .select('id, slug, name')
    .eq('club_id', clubId)
    .order('name');

  const { data: unclaimedTeams } = canManage
    ? await supabase.from('teams').select('id, name').is('club_id', null).order('name')
    : { data: [] };

  // Assigned-team lookups, per staff member with a coach/team_manager role.
  const relevantStaffUserIds = (staffRows ?? [])
    .filter((s) => s.role === 'coach' || s.role === 'team_manager')
    .map((s) => s.user_id);

  const { data: assignments } = relevantStaffUserIds.length
    ? await supabase
        .from('user_assigned_teams')
        .select('user_id, team_id')
        .in('user_id', relevantStaffUserIds)
    : { data: [] };

  const assignedTeamIdsByUser = new Map<string, string[]>();
  for (const a of assignments ?? []) {
    const list = assignedTeamIdsByUser.get(a.user_id) ?? [];
    list.push(a.team_id);
    assignedTeamIdsByUser.set(a.user_id, list);
  }

  const { data: trips } = await supabase
    .from('trips')
    .select('id, name, purpose, starts_at, ends_at')
    .eq('club_id', clubId)
    .order('starts_at', { ascending: false });

  const { data: announcementRows } = await supabase
    .from('announcements')
    .select('id, title, body, audience, team_id, pinned, created_at, teams(name)')
    .eq('club_id', clubId)
    .order('created_at', { ascending: false });

  const announcements = (announcementRows ?? []).map((a: any) => ({
    id: a.id,
    title: a.title,
    body: a.body,
    audience: a.audience,
    teamId: a.team_id,
    teamName: a.teams?.name ?? null,
    pinned: a.pinned,
    createdAt: a.created_at,
  }));

  const { data: mediaRows } = await supabase
    .from('media')
    .select('id, r2_key, file_name, caption')
    .eq('club_id', clubId)
    .order('created_at', { ascending: false });

  // Dashboard rollups (club_admin only) -- pure aggregation over data that
  // already exists elsewhere (roster, guardians, fees, Coach module) rather
  // than new tables. Skipped entirely for non-admins since RLS would just
  // filter these down to their assigned teams anyway, which isn't a
  // meaningful club-wide summary.
  let dashboard: {
    playerCount: number;
    pendingInvites: { guardianName: string; playerName: string }[];
    outstandingFees: { currency: string; total: number; count: number }[];
    playersWithoutEvaluation: number;
    activeGoals: number;
    goalsNeedingAttention: number;
    attendancePct30d: number | null;
  } | null = null;

  if (canManage) {
    const teamIds = (clubTeams ?? []).map((t) => t.id);

    const { data: players } = teamIds.length
      ? await supabase.from('players').select('id').in('team_id', teamIds)
      : { data: [] };
    const playerIds = (players ?? []).map((p) => p.id);

    const { data: inviteRows } = playerIds.length
      ? await supabase
          .from('player_guardians')
          .select('player_id, players(name), guardians!inner(name, account_status)')
          .in('player_id', playerIds)
          .eq('guardians.account_status', 'invited')
      : { data: [] };

    const { data: feeRows } = await supabase
      .from('fee_charges')
      .select('amount, currency')
      .eq('club_id', clubId)
      .neq('status', 'paid');

    const feesByCurrency = new Map<string, { total: number; count: number }>();
    for (const f of feeRows ?? []) {
      const entry = feesByCurrency.get(f.currency) ?? { total: 0, count: 0 };
      entry.total += Number(f.amount);
      entry.count += 1;
      feesByCurrency.set(f.currency, entry);
    }

    const { data: evaluatedRows } = playerIds.length
      ? await supabase.from('player_evaluations').select('player_id').in('player_id', playerIds)
      : { data: [] };
    const evaluatedPlayerIds = new Set((evaluatedRows ?? []).map((e) => e.player_id));

    const { data: goalRows } = playerIds.length
      ? await supabase.from('development_goals').select('status').in('player_id', playerIds)
      : { data: [] };

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: attendanceRows } = teamIds.length
      ? await supabase
          .from('attendance')
          .select('status, training_sessions!inner(team_id, starts_at)')
          .in('training_sessions.team_id', teamIds)
          .gte('training_sessions.starts_at', thirtyDaysAgo)
      : { data: [] };
    const eligibleAttendance = (attendanceRows ?? []).filter((a) => !['injured', 'suspended'].includes(a.status));
    const attendedCount = eligibleAttendance.filter((a) => a.status === 'present' || a.status === 'late').length;

    dashboard = {
      playerCount: playerIds.length,
      pendingInvites: (inviteRows ?? []).map((r: any) => ({
        guardianName: r.guardians?.name ?? 'Unknown',
        playerName: r.players?.name ?? 'Unknown',
      })),
      outstandingFees: [...feesByCurrency.entries()].map(([currency, v]) => ({ currency, ...v })),
      playersWithoutEvaluation: playerIds.filter((id) => !evaluatedPlayerIds.has(id)).length,
      activeGoals: (goalRows ?? []).filter((g) => !['achieved', 'archived'].includes(g.status)).length,
      goalsNeedingAttention: (goalRows ?? []).filter((g) => g.status === 'needs_attention').length,
      attendancePct30d: eligibleAttendance.length ? Math.round((attendedCount / eligibleAttendance.length) * 100) : null,
    };
  }

  // Signed URLs are generated server-side per request rather than stored
  // -- R2 objects aren't public, and a signed URL expires in an hour
  // (see shared/files/lib/r2.ts), so caching one wouldn't stay valid.
  const mediaItems = await Promise.all(
    (mediaRows ?? []).map(async (m) => ({
      id: m.id,
      url: await getDownloadUrl(m.r2_key),
      fileName: m.file_name,
      caption: m.caption,
    }))
  );

  return (
    <main className="page">
      <div className="container">
        <Link href="/clubs" className="back-link">← Clubs</Link>

        <div className="page-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h1>{club.name}</h1>
            {canManage && <EditNameForm clubId={club.id} initialName={club.name} />}
          </div>
          <span className="chip">
            {access.isPlatformAdmin ? 'Platform admin' : access.role ? access.role.replace('_', ' ') : 'No access here'}
          </span>
        </div>

        {access.isStaff && (
          <Link href={`/clubs/${club.slug}/drills`} className="btn" style={{ display: 'inline-block', marginBottom: 20, textDecoration: 'none' }}>
            Drill library →
          </Link>
        )}

        {dashboard && (
          <>
            <div className="section-label">Dashboard</div>
            <div className="card" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 16, marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 22, fontWeight: 700 }}>{clubTeams?.length ?? 0}</div>
                <div className="list-row-meta">Teams</div>
              </div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 700 }}>{dashboard.playerCount}</div>
                <div className="list-row-meta">Players</div>
              </div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 700 }}>{staffRows?.length ?? 0}</div>
                <div className="list-row-meta">Staff</div>
              </div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 700 }}>
                  {dashboard.attendancePct30d !== null ? `${dashboard.attendancePct30d}%` : '—'}
                </div>
                <div className="list-row-meta">Attendance (30d)</div>
              </div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 700 }}>{dashboard.activeGoals}</div>
                <div className="list-row-meta">Active goals</div>
              </div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 700, color: dashboard.goalsNeedingAttention > 0 ? 'var(--warn)' : undefined }}>
                  {dashboard.goalsNeedingAttention}
                </div>
                <div className="list-row-meta">Goals needing attention</div>
              </div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 700, color: dashboard.playersWithoutEvaluation > 0 ? 'var(--warn)' : undefined }}>
                  {dashboard.playersWithoutEvaluation}
                </div>
                <div className="list-row-meta">Never evaluated</div>
              </div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 700, color: dashboard.pendingInvites.length > 0 ? 'var(--warn)' : undefined }}>
                  {dashboard.pendingInvites.length}
                </div>
                <div className="list-row-meta">Pending guardian invites</div>
              </div>
              {dashboard.outstandingFees.map((f) => (
                <div key={f.currency}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--warn)' }}>{f.currency} {f.total.toFixed(2)}</div>
                  <div className="list-row-meta">Outstanding ({f.count} charge{f.count === 1 ? '' : 's'})</div>
                </div>
              ))}
            </div>

            {dashboard.pendingInvites.length > 0 && (
              <details style={{ marginBottom: 20 }}>
                <summary style={{ fontSize: 12.5, color: 'var(--text-muted)', cursor: 'pointer' }}>
                  {dashboard.pendingInvites.length} guardian invite{dashboard.pendingInvites.length === 1 ? '' : 's'} awaiting acceptance
                </summary>
                <div className="card" style={{ marginTop: 8 }}>
                  {dashboard.pendingInvites.map((inv, i) => (
                    <div key={i} className="list-row" style={{ padding: '6px 0' }}>
                      <span style={{ fontSize: 13 }}>{inv.guardianName} — {inv.playerName}</span>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </>
        )}

        <div className="section-label">
          {access.isClubAdmin ? `Teams (${clubTeams?.length ?? 0})` : `My teams (${myAssignedTeamIds.length} of ${clubTeams?.length ?? 0})`}
        </div>
        <div className="card">
          {(!clubTeams || clubTeams.length === 0) && (
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No teams linked yet.</p>
          )}
          {[...(clubTeams ?? [])]
            .sort((a, b) => {
              if (access.isClubAdmin) return 0;
              return Number(myAssignedTeamIds.includes(b.id)) - Number(myAssignedTeamIds.includes(a.id));
            })
            .map((t) => {
              const assigned = access.isClubAdmin || myAssignedTeamIds.includes(t.id);
              return (
                <Link key={t.id} href={`/clubs/${club.slug}/teams/${t.slug}`} className="list-row" style={{ textDecoration: 'none', color: 'inherit' }}>
                  <span className="list-row-title">{t.name}</span>
                  <span className="chip" style={assigned ? undefined : { color: 'var(--text-muted)' }}>
                    {assigned ? 'Roster →' : 'Not assigned →'}
                  </span>
                </Link>
              );
            })}
          {canManage && <LinkTeamForm clubId={club.id} unclaimedTeams={unclaimedTeams ?? []} />}
        </div>

        <div className="section-label" style={{ marginTop: 28 }}>
          Staff ({staffRows?.length ?? 0})
        </div>
        <div className="card">
          {(!staffRows || staffRows.length === 0) && (
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No staff added yet.</p>
          )}
          {staffRows?.map((s: any) => (
            <StaffRow
              key={s.id}
              clubId={club.id}
              staff={s}
              clubTeams={clubTeams ?? []}
              assignedTeamIds={assignedTeamIdsByUser.get(s.user_id) ?? []}
            />
          ))}
        </div>

        {canManage ? (
          <AddStaffForm clubId={club.id} />
        ) : (
          <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 16 }}>
            Only a club admin or a platform admin can manage club settings and staff.
          </p>
        )}

        <div className="section-label" style={{ marginTop: 28 }}>
          Trips ({trips?.length ?? 0})
        </div>
        <Trips clubId={club.id} clubSlug={club.slug} trips={trips ?? []} canManage={canManageWide} />

        <div className="section-label" style={{ marginTop: 28 }}>
          Announcements ({announcements.length})
        </div>
        <Announcements
          clubId={club.id}
          announcements={announcements}
          teams={clubTeams ?? []}
          canManage={canManageWide}
          isClubAdmin={access.isClubAdmin}
          assignedTeamIds={myAssignedTeamIds}
        />

        <div className="section-label" style={{ marginTop: 28 }}>
          Photos ({mediaItems.length})
        </div>
        <MediaGallery clubId={club.id} items={mediaItems} canManage={canManageWide} />
      </div>
    </main>
  );
}
