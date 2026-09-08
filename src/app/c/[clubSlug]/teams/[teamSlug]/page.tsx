import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient, getClubAccess, getAssignedTeamIds } from '@/lib/supabase/server';
import TeamRosterTabs from './TeamRosterTabs';

export default async function TeamRosterPage({
  params,
}: {
  params: Promise<{ clubSlug: string; teamSlug: string }>;
}) {
  const { clubSlug, teamSlug } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: club } = await supabase.from('clubs').select('id, slug, name').eq('slug', clubSlug).maybeSingle();
  if (!club) notFound();
  const clubId = club.id;

  const { data: team, error: teamError } = await supabase
    .from('teams')
    .select('id, slug, name, club_id')
    .eq('slug', teamSlug)
    .eq('club_id', clubId)
    .maybeSingle();

  if (teamError) {
    return (
      <main className="page">
        <div className="container">
          <p className="error-text">Couldn&apos;t load this team: {teamError.message}</p>
        </div>
      </main>
    );
  }
  if (!team) notFound();
  const teamId = team.id;

  // RBAC Phase 1 (rbac_phase1_narrow_coach_to_assigned_teams): a club_admin
  // (or platform admin) can manage any team; every other club_staff role is
  // scoped to teams they're specifically assigned to via user_assigned_teams
  // -- matches exactly what the RLS on players/guardians/fee_charges/
  // memberships/training_sessions/attendance now enforces, so this page
  // never shows an edit control the database would then reject.
  const access = await getClubAccess(clubId);
  const assignedTeamIds = access.isClubAdmin ? [] : await getAssignedTeamIds();
  const canManage = access.isClubAdmin || assignedTeamIds.includes(teamId);
  // Fees specifically are also settable by a plain 'staff' club_staff
  // member, not just club_admin or the assigned coach -- matches
  // widen_fee_management_to_staff_role.
  const canManageFees = canManage || access.role === 'staff';

  const { data: players, error: playersError } = await supabase
    .from('players')
    .select(
      'id, name, jersey, position, age, user_id, users(name, email),' +
      ' player_guardians(id, relationship, is_primary_contact, guardians(id, name, contact_info, account_status)),' +
      ' fee_charges(id, fee_type, amount, currency, status, due_date, payments(id, amount, method, paid_at)),' +
      ' memberships(id, period_start, period_end, status)'
    )
    .eq('team_id', teamId)
    .order('name');

  const rosterPlayers = (players ?? []).map((p: any) => ({
    id: p.id,
    name: p.name,
    jersey: p.jersey,
    position: p.position,
    age: p.age,
    linkedAccount: p.user_id ? { name: p.users?.name ?? null, email: p.users?.email ?? null } : null,
    guardians: (p.player_guardians ?? []).map((pg: any) => ({
      linkId: pg.id,
      guardianId: pg.guardians?.id,
      name: pg.guardians?.name ?? 'Unknown',
      relationship: pg.relationship,
      isPrimaryContact: pg.is_primary_contact,
      contactInfo: pg.guardians?.contact_info ?? null,
      accountStatus: pg.guardians?.account_status ?? 'no_account',
    })),
    fees: (p.fee_charges ?? []).map((fc: any) => ({
      id: fc.id,
      feeType: fc.fee_type,
      amount: Number(fc.amount),
      currency: fc.currency,
      status: fc.status,
      dueDate: fc.due_date,
      payments: (fc.payments ?? []).map((pay: any) => ({ ...pay, amount: Number(pay.amount) })),
    })),
    memberships: (p.memberships ?? []).map((m: any) => ({
      id: m.id,
      periodStart: m.period_start,
      periodEnd: m.period_end,
      status: m.status,
    })),
  }));

  const { data: sessions, error: sessionsError } = await supabase
    .from('training_sessions')
    .select('id, starts_at, ends_at, status, notes, theme, attendance(count)')
    .eq('team_id', teamId)
    .order('starts_at', { ascending: false });

  const trainingSessions = (sessions ?? []).map((s: any) => ({
    id: s.id,
    starts_at: s.starts_at,
    ends_at: s.ends_at,
    status: s.status,
    notes: s.notes,
    theme: s.theme,
    attendanceTaken: s.attendance?.[0]?.count ?? 0,
  }));

  const { data: entryRows } = await supabase
    .from('tournament_entries')
    .select('id, status, team_name, category_id, tournament_categories(name), tournament_id, tournaments(name, slug, event_date), tournament_roster(id)')
    .eq('team_id', teamId)
    .order('created_at', { ascending: false });

  const tournamentEntries = (entryRows ?? []).map((e: any) => ({
    id: e.id,
    status: e.status,
    teamName: e.team_name,
    categoryName: e.tournament_categories?.name ?? null,
    tournamentName: e.tournaments?.name ?? 'Tournament',
    tournamentSlug: e.tournaments?.slug ?? null,
    eventDate: e.tournaments?.event_date ?? null,
    rosterCount: (e.tournament_roster ?? []).length,
  }));

  return (
    <main className="page">
      <div className="container">
        <Link href={`/c/${clubSlug}`} className="back-link">← {club.name}</Link>

        <div className="page-header">
          <div>
            <h1>{team.name}</h1>
            <p className="subtitle">{rosterPlayers.length} player{rosterPlayers.length === 1 ? '' : 's'}</p>
          </div>
          <span className="chip">
            {access.isPlatformAdmin
              ? 'Platform admin'
              : access.isClubAdmin
                ? 'Club admin'
                : canManage
                  ? `${access.role?.replace('_', ' ')} — assigned`
                  : access.role
                    ? `${access.role.replace('_', ' ')} — not assigned here`
                    : 'No access here'}
          </span>
        </div>

        {playersError && <p className="error-text">Couldn&apos;t load the roster: {playersError.message}</p>}
        {sessionsError && <p className="error-text">Couldn&apos;t load training sessions: {sessionsError.message}</p>}

        <TeamRosterTabs
          clubId={clubId}
          teamId={teamId}
          clubSlug={clubSlug}
          teamSlug={teamSlug}
          players={rosterPlayers}
          sessions={trainingSessions}
          entries={tournamentEntries}
          canManage={canManage}
          canManageFees={canManageFees}
        />

        {!canManage && (
          <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 16 }}>
            {access.isStaff
              ? 'You can manage teams you’re assigned to — ask a club admin to assign you to this one.'
              : 'Only club staff or a platform admin can manage this roster.'}
          </p>
        )}
      </div>
    </main>
  );
}
