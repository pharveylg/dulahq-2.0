import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient, getClubAccess, getAssignedTeamIds } from '@/lib/supabase/server';
import EditNameForm from './EditNameForm';
import AddStaffForm from './AddStaffForm';
import LinkTeamForm from './LinkTeamForm';
import StaffRow from './StaffRow';
import Trips from './Trips';
import Announcements from './Announcements';
import MediaGallery from './MediaGallery';
import ClubDashboardStats from './ClubDashboardStats';
import ActionCenter from './ActionCenter';
import ClubPageTabs from './ClubPageTabs';
import Finances from './Finances';
import Reports from './Reports';
import Meetings from './Meetings';
import { getDownloadUrl } from '../../../../shared/files/lib/r2';

/**
 * Guest overview (§6.C) for a signed-out visitor. Only public_clubs (the
 * anon-readable, publicly_listed-gated view) is queried -- the same
 * outcome whether this club doesn't exist or exists but isn't public, by
 * design: an anonymous session has no way to tell those apart anyway
 * (the base clubs table has no anon-read policy at all), so showing the
 * same "sign in" prompt for both never leaks which one it is.
 */
async function GuestClubOverview({ clubSlug }: { clubSlug: string }) {
  const supabase = await createClient();
  const { data: club } = await supabase
    .from('public_clubs')
    .select('name, about, location, org_name')
    .eq('slug', clubSlug)
    .maybeSingle();

  if (!club) {
    return (
      <main className="page">
        <div className="container" style={{ maxWidth: 480 }}>
          <div className="page-header"><h1>Club not found</h1></div>
          <p style={{ fontSize: 13.5, color: 'var(--text-muted)' }}>
            This club isn&apos;t publicly visible. If you&apos;re a member, staff, or a
            guardian, <Link href="/login">sign in</Link> to view it.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="container" style={{ maxWidth: 640 }}>
        <div className="page-header">
          <div>
            <h1>{club.name}</h1>
            <p className="subtitle">{club.org_name}{club.location ? ` · ${club.location}` : ''}</p>
          </div>
          <Link href="/login" className="btn btn-primary">Sign in</Link>
        </div>
        {club.about && <div className="card"><p style={{ fontSize: 14 }}>{club.about}</p></div>}
      </div>
    </main>
  );
}

export default async function ClubDetailPage({ params }: { params: Promise<{ clubSlug: string }> }) {
  const { clubSlug } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return <GuestClubOverview clubSlug={clubSlug} />;

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

  // access.isClubManager gates club-wide actions (rename, staff, link teams,
  // any-audience announcements); access.isStaff gates the broader "any
  // club_staff role" actions RLS still allows unscoped (trips, media).
  const access = await getClubAccess(clubId);
  const canManage = access.isClubManager;
  const canManageWide = access.isStaff;
  const canManageFinances = access.isClubManager || access.role === 'staff';
  const myAssignedTeamIds = access.isClubManager ? [] : await getAssignedTeamIds();

  // The IT surface is permission-gated, not role-gated: a club_it_admin gets
  // there via impersonate_user, a club_manager via view_audit_log oversight.
  const supabaseForPerms = await createClient();
  const [{ data: canImpersonate }, { data: canViewAudit }] = await Promise.all([
    supabaseForPerms.rpc('has_staff_permission', { p_permission_key: 'impersonate_user', p_club_id: clubId }),
    supabaseForPerms.rpc('has_staff_permission', { p_permission_key: 'view_audit_log', p_club_id: clubId }),
  ]);
  const canViewItAdmin = !!canImpersonate || !!canViewAudit;

  // club_staff has two FKs into users (user_id, created_by) -- the embed
  // must be disambiguated with !user_id or PostgREST rejects the whole
  // query as ambiguous, which silently produced an empty staffRows here.
  const { data: staffRows, error: staffError } = await supabase
    .from('club_staff')
    .select('id, role, user_id, users!user_id(name, email)')
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
    .select('id, storage_key, file_name, caption')
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

  // Coach Module spec §1: "what do I need to know and do today" -- shown to
  // club_admin (club-wide) and coach/team_manager (their assigned teams
  // only), same component, scoped by relevantTeamIds. Action-first: what's
  // flagged below drives the Action Center list, not just tile counts.
  const relevantTeamIds = access.isClubManager ? (clubTeams ?? []).map((t) => t.id) : myAssignedTeamIds;
  const teamsById = new Map((clubTeams ?? []).map((t) => [t.id, t]));

  let actionCenter: {
    todaySessions: { id: string; teamId: string; teamSlug: string; teamName: string; startsAt: string; endsAt: string }[];
    upcomingSessions: { id: string; teamId: string; teamSlug: string; teamName: string; startsAt: string; endsAt: string }[];
    actionItems: { id: string; labelPrefix: string; startsAt?: string; href: string; urgent?: boolean }[];
    teamSnapshots: { teamId: string; teamSlug: string; teamName: string; playerCount: number; attendancePct: number | null; activeGoals: number; goalsNeedingAttention: number }[];
  } | null = null;

  if (relevantTeamIds.length > 0) {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const threeDaysAhead = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString();
    const thirtyDaysAgoAC = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const [
      { data: todayRows },
      { data: upcomingRows },
      { data: recentSessionRows },
      { data: soonSessionRows },
      { data: acPlayerRows },
      { data: acAttendanceRows },
      { data: acGoalRows },
    ] = await Promise.all([
      supabase.from('training_sessions').select('id, team_id, starts_at, ends_at').in('team_id', relevantTeamIds).gte('starts_at', startOfToday).lt('starts_at', endOfToday).order('starts_at'),
      supabase.from('training_sessions').select('id, team_id, starts_at, ends_at').in('team_id', relevantTeamIds).gte('starts_at', endOfToday).eq('status', 'scheduled').order('starts_at').limit(5),
      supabase.from('training_sessions').select('id, team_id, starts_at, status, attendance(id)').in('team_id', relevantTeamIds).gte('starts_at', threeDaysAgo).lt('starts_at', startOfToday),
      supabase.from('training_sessions').select('id, team_id, starts_at, session_drills(id)').in('team_id', relevantTeamIds).gte('starts_at', startOfToday).lte('starts_at', threeDaysAhead).eq('status', 'scheduled'),
      supabase.from('players').select('id, team_id').in('team_id', relevantTeamIds),
      supabase.from('attendance').select('status, training_sessions!inner(team_id, starts_at)').in('training_sessions.team_id', relevantTeamIds).gte('training_sessions.starts_at', thirtyDaysAgoAC),
      supabase.from('development_goals').select('id, title, status, player_id, team_id, players(name)').in('team_id', relevantTeamIds),
    ]);

    const toSession = (s: any) => {
      const team = teamsById.get(s.team_id);
      if (!team || !team.slug) return null;
      return { id: s.id, teamId: s.team_id, teamSlug: team.slug, teamName: team.name, startsAt: s.starts_at, endsAt: s.ends_at };
    };

    const actionItems: { id: string; labelPrefix: string; startsAt?: string; href: string; urgent?: boolean }[] = [];

    for (const s of recentSessionRows ?? []) {
      const team = teamsById.get((s as any).team_id);
      if (!team || !team.slug || (s as any).status === 'cancelled' || ((s as any).attendance ?? []).length > 0) continue;
      actionItems.push({
        id: `attendance-${s.id}`,
        labelPrefix: `Take attendance — ${team.name}`,
        startsAt: (s as any).starts_at,
        href: `/c/${clubSlug}/teams/${team.slug}/training/${s.id}`,
        urgent: true,
      });
    }
    for (const s of soonSessionRows ?? []) {
      const team = teamsById.get((s as any).team_id);
      if (!team || !team.slug || ((s as any).session_drills ?? []).length > 0) continue;
      actionItems.push({
        id: `plan-${s.id}`,
        labelPrefix: `Plan training session — ${team.name}`,
        startsAt: (s as any).starts_at,
        href: `/c/${clubSlug}/teams/${team.slug}/training/${s.id}`,
      });
    }
    for (const g of (acGoalRows ?? []).filter((g: any) => g.status === 'needs_attention')) {
      const team = teamsById.get((g as any).team_id);
      if (!team || !team.slug) continue;
      actionItems.push({
        id: `goal-${g.id}`,
        labelPrefix: `Review goal — ${(g as any).players?.name ?? 'Player'}: ${g.title}`,
        href: `/c/${clubSlug}/teams/${team.slug}/players/${g.player_id}`,
        urgent: true,
      });
    }
    actionItems.sort((a, b) => Number(b.urgent) - Number(a.urgent));

    const playersByTeam = new Map<string, string[]>();
    for (const p of acPlayerRows ?? []) {
      if (!p.team_id) continue;
      const list = playersByTeam.get(p.team_id) ?? [];
      list.push(p.id);
      playersByTeam.set(p.team_id, list);
    }
    const goalsByTeam = new Map<string, any[]>();
    for (const g of acGoalRows ?? []) {
      const list = goalsByTeam.get((g as any).team_id) ?? [];
      list.push(g);
      goalsByTeam.set((g as any).team_id, list);
    }

    const teamSnapshots = relevantTeamIds
      .map((teamId) => teamsById.get(teamId))
      .filter((t): t is { id: string; slug: string; name: string } => !!t && !!t.slug)
      .map((team) => {
        const teamPlayerIds = new Set(playersByTeam.get(team.id) ?? []);
        const teamAttendance = (acAttendanceRows ?? []).filter(
          (a: any) => a.training_sessions?.team_id === team.id && !['injured', 'suspended'].includes(a.status)
        );
        const teamAttended = teamAttendance.filter((a: any) => a.status === 'present' || a.status === 'late').length;
        const teamGoals = goalsByTeam.get(team.id) ?? [];
        return {
          teamId: team.id,
          teamSlug: team.slug,
          teamName: team.name,
          playerCount: teamPlayerIds.size,
          attendancePct: teamAttendance.length ? Math.round((teamAttended / teamAttendance.length) * 100) : null,
          activeGoals: teamGoals.filter((g: any) => !['achieved', 'archived'].includes(g.status)).length,
          goalsNeedingAttention: teamGoals.filter((g: any) => g.status === 'needs_attention').length,
        };
      });

    actionCenter = {
      todaySessions: (todayRows ?? []).map(toSession).filter((s): s is NonNullable<typeof s> => !!s),
      upcomingSessions: (upcomingRows ?? []).map(toSession).filter((s): s is NonNullable<typeof s> => !!s),
      actionItems,
      teamSnapshots,
    };
  }

  // Meetings + action items -- club-wide staff tool, visible/manageable
  // by any club_staff role (unlike fees, which are admin/staff-only).
  const { data: meetingRows } = await supabase
    .from('meetings')
    .select('id, title, meeting_date, location, notes, status, meeting_action_items(id, description, due_date, status)')
    .eq('club_id', clubId)
    .order('meeting_date', { ascending: false });

  const meetings = (meetingRows ?? []).map((m: any) => ({
    id: m.id,
    title: m.title,
    meetingDate: m.meeting_date,
    location: m.location,
    notes: m.notes,
    status: m.status,
    actionItems: (m.meeting_action_items ?? []).map((a: any) => ({
      id: a.id,
      description: a.description,
      dueDate: a.due_date,
      status: a.status,
    })),
  }));

  // Finances + Reports (club_admin/staff only -- club-wide financial
  // detail isn't meaningful scoped to a single assigned team).
  let financesData: { feeCharges: any[]; expenses: any[] } | null = null;
  let reportsData: { teams: any[]; financials: { collected: number; outstanding: number; expenses: number; currency: string } } | null = null;

  if (canManageFinances) {
    const { data: allFeeCharges } = await supabase
      .from('fee_charges')
      .select('id, fee_type, amount, currency, status, due_date, players(name)')
      .eq('club_id', clubId)
      .order('due_date');

    const feeCharges = (allFeeCharges ?? []).map((f: any) => ({
      id: f.id,
      playerName: f.players?.name ?? 'Unknown',
      feeType: f.fee_type,
      amount: Number(f.amount),
      currency: f.currency,
      status: f.status,
      dueDate: f.due_date,
    }));

    const { data: expenseRows } = await supabase
      .from('expenses')
      .select('id, description, category, amount, currency, expense_date')
      .eq('club_id', clubId)
      .order('expense_date', { ascending: false });

    const expenses = (expenseRows ?? []).map((e: any) => ({
      id: e.id,
      description: e.description,
      category: e.category,
      amount: Number(e.amount),
      currency: e.currency,
      expenseDate: e.expense_date,
    }));

    financesData = { feeCharges, expenses };

    const collected = feeCharges.filter((f) => f.status === 'paid').reduce((sum, f) => sum + f.amount, 0);
    const outstanding = feeCharges.filter((f) => f.status !== 'paid').reduce((sum, f) => sum + f.amount, 0);
    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

    const teamIds = (clubTeams ?? []).map((t) => t.id);
    const { data: teamPlayers } = teamIds.length
      ? await supabase.from('players').select('id, team_id').in('team_id', teamIds)
      : { data: [] };
    const playerIdsByTeam = new Map<string, string[]>();
    for (const p of teamPlayers ?? []) {
      // players.team_id is nullable (phase3_free_the_player) -- a player not
      // on any team isn't part of this per-team report.
      if (!p.team_id) continue;
      const list = playerIdsByTeam.get(p.team_id) ?? [];
      list.push(p.id);
      playerIdsByTeam.set(p.team_id, list);
    }
    const allPlayerIds = (teamPlayers ?? []).map((p) => p.id);

    const thirtyDaysAgoR = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: reportAttendance } = teamIds.length
      ? await supabase
          .from('attendance')
          .select('player_id, status, training_sessions!inner(team_id, starts_at)')
          .in('training_sessions.team_id', teamIds)
          .gte('training_sessions.starts_at', thirtyDaysAgoR)
      : { data: [] };
    const { data: reportEvaluations } = allPlayerIds.length
      ? await supabase.from('player_evaluations').select('player_id').in('player_id', allPlayerIds)
      : { data: [] };
    const { data: reportGoals } = allPlayerIds.length
      ? await supabase.from('development_goals').select('player_id, status').in('player_id', allPlayerIds)
      : { data: [] };

    const teams = (clubTeams ?? []).map((t) => {
      const teamPlayerIds = new Set(playerIdsByTeam.get(t.id) ?? []);
      const teamAttendance = (reportAttendance ?? []).filter((a: any) => teamPlayerIds.has(a.player_id) && !['injured', 'suspended'].includes(a.status));
      const teamAttended = teamAttendance.filter((a: any) => a.status === 'present' || a.status === 'late').length;
      const teamGoals = (reportGoals ?? []).filter((g) => teamPlayerIds.has(g.player_id));
      return {
        teamId: t.id,
        teamName: t.name,
        playerCount: teamPlayerIds.size,
        attendancePct: teamAttendance.length ? Math.round((teamAttended / teamAttendance.length) * 100) : null,
        evaluationsCount: (reportEvaluations ?? []).filter((e) => teamPlayerIds.has(e.player_id)).length,
        activeGoals: teamGoals.filter((g) => !['achieved', 'archived'].includes(g.status)).length,
        goalsNeedingAttention: teamGoals.filter((g) => g.status === 'needs_attention').length,
      };
    });

    reportsData = {
      teams,
      financials: { collected, outstanding, expenses: totalExpenses, currency: feeCharges[0]?.currency ?? 'PHP' },
    };
  }

  // Signed URLs are generated server-side per request rather than stored
  // -- R2 objects aren't public, and a signed URL expires in an hour
  // (see shared/files/lib/r2.ts), so caching one wouldn't stay valid.
  const mediaItems = await Promise.all(
    (mediaRows ?? []).map(async (m) => ({
      id: m.id,
      url: await getDownloadUrl(m.storage_key),
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

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
          {access.isStaff && (
            <Link href={`/c/${club.slug}/drills`} className="btn" style={{ textDecoration: 'none' }}>
              Drill library →
            </Link>
          )}
          {/* Technical administration is a separate surface, not a tab in the
              business console -- Club Admin spec §6. */}
          {canViewItAdmin && (
            <Link href={`/c/${club.slug}/it`} className="btn" style={{ textDecoration: 'none' }}>
              IT administration →
            </Link>
          )}
        </div>

        <ClubPageTabs
          hasDashboard={!!dashboard || !!actionCenter}
          counts={{
            teams: clubTeams?.length ?? 0,
            staff: staffRows?.length ?? 0,
            trips: trips?.length ?? 0,
            announcements: announcements.length,
            photos: mediaItems.length,
            meetings: meetings.length,
          }}
          dashboardSlot={(dashboard || actionCenter) && (
            <>
              {actionCenter && (
                <ActionCenter
                  clubSlug={club.slug}
                  todaySessions={actionCenter.todaySessions}
                  upcomingSessions={actionCenter.upcomingSessions}
                  actionItems={actionCenter.actionItems}
                  teamSnapshots={actionCenter.teamSnapshots}
                />
              )}
              {dashboard && (
                <div style={{ marginTop: actionCenter ? 28 : 0 }}>
                  {actionCenter && <div className="section-label">Club-wide</div>}
                  <ClubDashboardStats teamCount={clubTeams?.length ?? 0} staffCount={staffRows?.length ?? 0} dashboard={dashboard} />
                </div>
              )}
            </>
          )}
          teamsSlot={
            <>
              <div className="section-label">
                {access.isClubManager ? `Teams (${clubTeams?.length ?? 0})` : `My teams (${myAssignedTeamIds.length} of ${clubTeams?.length ?? 0})`}
              </div>
              <div className="card">
                {(!clubTeams || clubTeams.length === 0) && (
                  <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No teams linked yet.</p>
                )}
                {[...(clubTeams ?? [])]
                  .sort((a, b) => {
                    if (access.isClubManager) return 0;
                    return Number(myAssignedTeamIds.includes(b.id)) - Number(myAssignedTeamIds.includes(a.id));
                  })
                  .map((t) => {
                    const assigned = access.isClubManager || myAssignedTeamIds.includes(t.id);
                    return (
                      <Link key={t.id} href={`/c/${club.slug}/teams/${t.slug}`} className="list-row" style={{ textDecoration: 'none', color: 'inherit' }}>
                        <span className="list-row-title">{t.name}</span>
                        <span className="chip" style={assigned ? undefined : { color: 'var(--text-muted)' }}>
                          {assigned ? 'Roster →' : 'Not assigned →'}
                        </span>
                      </Link>
                    );
                  })}
                {canManage && <LinkTeamForm clubId={club.id} unclaimedTeams={unclaimedTeams ?? []} />}
              </div>
            </>
          }
          staffSlot={
            <>
              <div className="section-label">Staff ({staffRows?.length ?? 0})</div>
              {staffError && <p className="error-text">Couldn&apos;t load staff: {staffError.message}</p>}
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
            </>
          }
          financesSlot={financesData && (
            <Finances clubId={club.id} feeCharges={financesData.feeCharges} expenses={financesData.expenses} canManage={canManageFinances} />
          )}
          reportsSlot={reportsData && (
            <Reports teams={reportsData.teams} financials={reportsData.financials} />
          )}
          meetingsSlot={
            <>
              <div className="section-label">Meetings ({meetings.length})</div>
              <Meetings clubId={club.id} meetings={meetings} canManage={canManageWide} />
            </>
          }
          tripsSlot={
            <>
              <div className="section-label">Trips ({trips?.length ?? 0})</div>
              <Trips clubId={club.id} clubSlug={club.slug} trips={trips ?? []} canManage={canManageWide} />
            </>
          }
          announcementsSlot={
            <>
              <div className="section-label">Announcements ({announcements.length})</div>
              <Announcements
                clubId={club.id}
                announcements={announcements}
                teams={clubTeams ?? []}
                canManage={canManageWide}
                isClubManager={access.isClubManager}
                assignedTeamIds={myAssignedTeamIds}
              />
            </>
          }
          photosSlot={
            <>
              <div className="section-label">Photos ({mediaItems.length})</div>
              <MediaGallery clubId={club.id} items={mediaItems} canManage={canManageWide} />
            </>
          }
        />
      </div>
    </main>
  );
}
