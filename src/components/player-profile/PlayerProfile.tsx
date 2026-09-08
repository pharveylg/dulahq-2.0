import { createClient } from '@/lib/supabase/server';
import { formatMoney } from '@/lib/currency';
import SlotTabs from '@/components/motion/SlotTabs';
import Overview from './Overview';
import Family from './Family';

// Reusing the coach route's existing Development-tab components rather than
// duplicating them (Player Profile spec: "reuse existing components... do
// not create duplicate functionality"). They're pure prop-driven ('use
// client') components with no dependency on their own route's params, so
// importing them from here works exactly like importing from anywhere else
// in the app -- a future cleanup could relocate them under
// src/components/player-profile/, but nothing about how they work requires it.
import ProfileForm from '@/app/c/[clubSlug]/teams/[teamSlug]/players/[playerId]/ProfileForm';
import Goals from '@/app/c/[clubSlug]/teams/[teamSlug]/players/[playerId]/Goals';
import Evaluations from '@/app/c/[clubSlug]/teams/[teamSlug]/players/[playerId]/Evaluations';
import Notes from '@/app/c/[clubSlug]/teams/[teamSlug]/players/[playerId]/Notes';
import Timeline from '@/app/c/[clubSlug]/teams/[teamSlug]/players/[playerId]/Timeline';
import PlayerFees from '@/app/c/[clubSlug]/teams/[teamSlug]/PlayerFees';
import PlayerMembership from '@/app/c/[clubSlug]/teams/[teamSlug]/PlayerMembership';

export type PlayerProfileViewer = 'coach' | 'player' | 'guardian';

type ExtraTab = { id: string; label: string; badge?: number; content: React.ReactNode };

/**
 * The canonical Player Profile (Overview / Development / Fees / Membership /
 * Family), shared by the coach, player-self, and guardian views -- one data
 * layer and one set of section components instead of three independent
 * renderings. See CLAUDE.md §0c for the phased plan this is Phase 1 of.
 *
 * viewer='coach' computes real permission flags via Phase 0's
 * has_staff_permission() RPC and shows management controls accordingly.
 * viewer='player'/'guardian' render read-only -- RLS (not a configurable
 * bundle) is what scopes a player to their own record; a guardian's
 * visibility is already governed by has_guardian_permission() at the
 * database level (see the phase6b/6c migrations), so the UI here doesn't
 * need to duplicate that logic, just avoid showing edit controls neither
 * role's mutations would be authorized for anyway.
 */
export default async function PlayerProfile({
  playerId,
  viewer,
  extraTabs = [],
  layoutId,
}: {
  playerId: string;
  viewer: PlayerProfileViewer;
  extraTabs?: ExtraTab[];
  layoutId: string;
}) {
  const supabase = await createClient();

  const { data: player, error: playerError } = await supabase
    .from('players')
    .select(
      'id, name, jersey, position, secondary_position, preferred_foot, dob, development_status, team_id, club_id, org_id, user_id, teams(id, name, slug, club_id, clubs(id, name, slug))'
    )
    .eq('id', playerId)
    .maybeSingle();

  if (playerError || !player) {
    return <p className="error-text">Couldn&apos;t load this player{playerError ? `: ${playerError.message}` : '.'}</p>;
  }

  const team = (player as any).teams as { id: string; name: string; slug: string; club_id: string; clubs: { id: string; name: string; slug: string } | null } | null;
  const club = team?.clubs ?? null;
  const clubId = club?.id ?? player.club_id ?? null;
  const teamId = player.team_id;

  // ---- permission flags (coach viewer only) ----
  let perms = {
    viewTeam: false, manageDevelopment: false, addEvaluation: false,
    addPlayerFeedback: false, addPrivateCoachNote: false, editFootballProfile: false,
    manageFinances: false, manageMembership: false, manageStaff: false,
  };
  if (viewer === 'coach' && clubId) {
    const keys = [
      'view_team', 'manage_development', 'add_evaluation', 'add_player_feedback',
      'add_private_coach_note', 'edit_player_football_profile', 'manage_finances', 'manage_membership', 'manage_staff',
    ] as const;
    const results = await Promise.all(
      keys.map((key) => supabase.rpc('has_staff_permission', { p_permission_key: key, p_club_id: clubId, p_team_id: teamId ?? undefined }))
    );
    perms = {
      viewTeam: !!results[0].data, manageDevelopment: !!results[1].data, addEvaluation: !!results[2].data,
      addPlayerFeedback: !!results[3].data, addPrivateCoachNote: !!results[4].data,
      editFootballProfile: !!results[5].data, manageFinances: !!results[6].data, manageMembership: !!results[7].data,
      manageStaff: !!results[8].data,
    };
  }
  // Preserves today's exact behavior (canManage || role==='staff' for fees;
  // canManage alone for membership/family) rather than tightening it as a
  // side effect here -- fee_charges/memberships/guardians RLS isn't part of
  // this cutover yet, so the UI staying at parity with what those policies
  // actually allow is the correct choice; see CLAUDE.md §0c for when that's
  // scoped in.
  const canManageFees = perms.viewTeam || perms.manageFinances;
  const canManageMembership = perms.viewTeam || perms.manageMembership;
  const canManageFamily = perms.viewTeam;
  const canManageNotes = perms.addPlayerFeedback || perms.addPrivateCoachNote;
  // guardian_permission_grants RLS is genuinely club_admin/platform_admin
  // only (see phase6a's migration comment -- not extended to an assigned
  // coach the way canManageFamily is), and manage_staff is only in
  // club_admin's role bundle, so it's an accurate stand-in. Gating the
  // fetch+UI on the SAME check the write policy enforces, rather than the
  // broader canManageFamily, avoids showing controls that would 403.
  const canManageGuardianPermissions = perms.manageStaff;

  // ---- data ----
  const [
    { data: skillRows },
    { data: evaluations },
    { data: goals },
    { data: notes },
    { data: feeRows },
    { data: membershipRows },
    { data: guardianLinks },
  ] = await Promise.all([
    supabase.from('development_skills').select('id, category, name, sort_order').order('category').order('sort_order'),
    supabase
      .from('player_evaluations')
      .select('id, evaluation_date, period, technical_score, tactical_score, physical_score, mental_score, strengths, development_areas, coach_comments, visibility, created_at')
      .eq('player_id', playerId)
      .order('evaluation_date', { ascending: false }),
    supabase
      .from('development_goals')
      .select('id, title, description, starting_level, target_level, current_level, start_date, target_date, status, success_criteria, visibility, created_at, development_skills(name)')
      .eq('player_id', playerId)
      .order('created_at', { ascending: false }),
    supabase.from('player_development_notes').select('id, note, visibility, created_at').eq('player_id', playerId).order('created_at', { ascending: false }),
    supabase.from('fee_charges').select('id, fee_type, amount, currency, status, due_date, payments(id, amount, method, paid_at)').eq('player_id', playerId).order('due_date'),
    supabase.from('memberships').select('id, period_start, period_end, status').eq('player_id', playerId),
    supabase
      .from('player_guardians')
      .select('id, relationship, is_primary_contact, guardians(id, name, account_status, contact_info)')
      .eq('player_id', playerId),
  ]);

  const evaluationIds = (evaluations ?? []).map((e) => e.id);
  const { data: ratingRows } = evaluationIds.length
    ? await supabase.from('player_skill_ratings').select('evaluation_id, rating, development_skills(id, name, category)').in('evaluation_id', evaluationIds)
    : { data: [] as any[] };
  const ratingsByEvaluation = new Map<string, any[]>();
  for (const r of ratingRows ?? []) {
    const list = ratingsByEvaluation.get(r.evaluation_id) ?? [];
    list.push({ rating: r.rating, skill: (r as any).development_skills });
    ratingsByEvaluation.set(r.evaluation_id, list);
  }

  const { data: attendanceRows } = teamId
    ? await supabase.from('attendance').select('status, training_sessions!inner(team_id, starts_at)').eq('player_id', playerId).eq('training_sessions.team_id', teamId)
    : { data: [] as any[] };
  const eligible = (attendanceRows ?? []).filter((a) => !['injured', 'suspended'].includes(a.status));
  const attended = eligible.filter((a) => a.status === 'present' || a.status === 'late').length;
  const attendancePct = eligible.length ? Math.round((attended / eligible.length) * 100) : null;

  const { data: upcomingSessions } = teamId
    ? await supabase
        .from('training_sessions')
        .select('id, starts_at, ends_at, status')
        .eq('team_id', teamId)
        .eq('status', 'scheduled')
        .gte('starts_at', new Date().toISOString())
        .order('starts_at')
        .limit(5)
    : { data: [] as any[] };

  let linkedAccount: { name: string | null; email: string | null } | null = null;
  if (player.user_id) {
    const { data: u } = await supabase.from('users').select('name, email').eq('id', player.user_id).maybeSingle();
    linkedAccount = u ? { name: u.name, email: u.email } : null;
  }

  const activeGoals = (goals ?? [])
    .filter((g) => !['achieved', 'archived'].includes(g.status))
    .map((g) => ({ id: g.id, title: g.title, status: g.status, skillName: (g as any).development_skills?.name ?? null }));

  const recentActivity = [
    ...(evaluations ?? []).map((e) => ({ date: e.created_at, kind: 'evaluation' as const, label: `Evaluation${e.period ? ` — ${e.period}` : ''}` })),
    ...(goals ?? []).map((g) => ({ date: g.created_at, kind: 'goal' as const, label: `Goal — ${g.title}` })),
    ...(notes ?? []).map((n) => ({ date: n.created_at, kind: 'note' as const, label: `Note — "${n.note.slice(0, 60)}${n.note.length > 60 ? '…' : ''}"` })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const fees = (feeRows ?? []).map((f) => ({
    id: f.id, feeType: f.fee_type, amount: Number(f.amount), currency: f.currency,
    status: f.status as 'pending' | 'paid' | 'overdue' | 'refunded', dueDate: f.due_date,
    payments: ((f as any).payments ?? []) as { id: string; amount: number; method: string | null; paid_at: string }[],
  }));
  const memberships = (membershipRows ?? []).map((m) => ({ id: m.id, periodStart: m.period_start, periodEnd: m.period_end, status: m.status }));
  const guardians = (guardianLinks ?? []).map((l: any) => ({
    linkId: l.id, guardianId: l.guardians?.id, name: l.guardians?.name ?? 'Unknown',
    relationship: l.relationship, isPrimaryContact: l.is_primary_contact,
    contactInfo: l.guardians?.contact_info ?? null, accountStatus: l.guardians?.account_status ?? 'no_account',
  }));

  // Per-guardian permission overrides (Phase 0's guardian_permission_grants)
  // -- only fetched for club_admin/platform_admin (canManageGuardianPermissions,
  // matching the RLS write policy exactly, not the broader canManageFamily),
  // and only when there's a guardian to show it for.
  let guardianPermissions: Record<string, { key: string; label: string; granted: boolean; isOverride: boolean }[]> = {};
  if (canManageGuardianPermissions && guardians.length > 0) {
    const linkIds = guardians.map((g) => g.linkId);
    const [{ data: catalog }, { data: defaults }, { data: grants }] = await Promise.all([
      supabase.from('permissions').select('key, label').eq('category', 'guardian').order('label'),
      supabase.from('guardian_permission_defaults').select('permission_key'),
      supabase.from('guardian_permission_grants').select('player_guardian_id, permission_key, granted').in('player_guardian_id', linkIds),
    ]);
    const defaultSet = new Set((defaults ?? []).map((d) => d.permission_key));
    const grantsByLink = new Map<string, Map<string, boolean>>();
    for (const g of grants ?? []) {
      const map = grantsByLink.get(g.player_guardian_id) ?? new Map();
      map.set(g.permission_key, g.granted);
      grantsByLink.set(g.player_guardian_id, map);
    }
    for (const linkId of linkIds) {
      const overrides = grantsByLink.get(linkId);
      guardianPermissions[linkId] = (catalog ?? []).map((p) => {
        const override = overrides?.get(p.key);
        return { key: p.key, label: p.label, granted: override ?? defaultSet.has(p.key), isOverride: override !== undefined };
      });
    }
  }

  return (
    <SlotTabs
      layoutId={layoutId}
      tabs={[
        { id: 'overview', label: 'Overview' },
        { id: 'development', label: 'Development', badge: activeGoals.length },
        { id: 'fees', label: 'Fees', badge: fees.filter((f) => f.status !== 'paid').length },
        { id: 'membership', label: 'Membership' },
        { id: 'family', label: 'Family', badge: guardians.length },
        ...extraTabs.map(({ id, label, badge }) => ({ id, label, badge })),
      ]}
      slots={{
        overview: (
          <Overview
            player={{
              name: player.name, jersey: player.jersey, position: player.position,
              secondaryPosition: player.secondary_position, preferredFoot: player.preferred_foot, dob: player.dob,
            }}
            teamName={team?.name ?? null}
            clubName={club?.name ?? null}
            developmentStatus={player.development_status}
            attendancePct={attendancePct}
            sessionsAttended={attended}
            sessionsMissed={eligible.length - attended}
            activeGoals={activeGoals}
            latestEvaluationDate={evaluations?.[0]?.evaluation_date ?? null}
            upcomingSessions={upcomingSessions ?? []}
            recentActivity={recentActivity}
          />
        ),
        development: (
          <div>
            {viewer === 'coach' && clubId && teamId && (
              <ProfileForm
                player={{
                  id: player.id, secondary_position: player.secondary_position,
                  preferred_foot: player.preferred_foot, dob: player.dob, development_status: player.development_status,
                }}
                canManage={perms.editFootballProfile}
              />
            )}
            <div style={{ marginTop: viewer === 'coach' ? 16 : 0 }}>
              <SlotTabs
                layoutId={`${layoutId}-development`}
                tabs={[
                  { id: 'goals', label: 'Goals', badge: activeGoals.length },
                  { id: 'evaluations', label: 'Evaluations', badge: (evaluations ?? []).length },
                  { id: 'notes', label: 'Notes', badge: (notes ?? []).length },
                  { id: 'timeline', label: 'Timeline' },
                ]}
                slots={{
                  goals: clubId && teamId ? (
                    <Goals playerId={playerId} teamId={teamId} clubId={clubId} goals={(goals ?? []) as any} skills={skillRows ?? []} canManage={perms.manageDevelopment} />
                  ) : (
                    <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No team assigned.</p>
                  ),
                  evaluations: clubId && teamId ? (
                    <Evaluations
                      playerId={playerId} teamId={teamId} clubId={clubId}
                      evaluations={(evaluations ?? []).map((e) => ({ ...e, ratings: ratingsByEvaluation.get(e.id) ?? [] }))}
                      skills={skillRows ?? []} canManage={perms.addEvaluation}
                    />
                  ) : (
                    <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No team assigned.</p>
                  ),
                  notes: clubId && teamId ? (
                    <Notes playerId={playerId} teamId={teamId} clubId={clubId} notes={notes ?? []} canManage={canManageNotes} />
                  ) : (
                    <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No team assigned.</p>
                  ),
                  timeline: <Timeline evaluations={evaluations ?? []} goals={goals ?? []} notes={notes ?? []} />,
                }}
              />
            </div>
          </div>
        ),
        fees: clubId && teamId ? (
          <PlayerFees clubId={clubId} teamId={teamId} playerId={playerId} charges={fees} canManage={canManageFees} />
        ) : (
          <div className="card">
            {fees.length === 0 && <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No fees on record.</p>}
            {fees.map((f) => (
              <div key={f.id} className="list-row">
                <span className="list-row-title">{f.feeType} — {formatMoney(f.amount, f.currency)}</span>
                <span className="chip">{f.status}</span>
              </div>
            ))}
          </div>
        ),
        membership: clubId && teamId ? (
          <PlayerMembership clubId={clubId} teamId={teamId} playerId={playerId} memberships={memberships} canManage={canManageMembership} />
        ) : (
          <div className="card">
            {memberships.length === 0 && <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No membership periods recorded.</p>}
            {memberships.map((m) => (
              <div key={m.id} className="list-row">
                <span className="list-row-title">{m.periodStart}{m.periodEnd ? ` – ${m.periodEnd}` : ' – ongoing'}</span>
                <span className="chip">{m.status}</span>
              </div>
            ))}
          </div>
        ),
        family: clubId && teamId ? (
          <Family
            clubId={clubId} teamId={teamId} playerId={playerId} orgId={player.org_id}
            guardians={guardians} linkedAccount={linkedAccount} canManage={canManageFamily}
            guardianPermissions={guardianPermissions}
          />
        ) : (
          <div className="card">
            {guardians.length === 0 && <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No guardians linked yet.</p>}
            {guardians.map((g) => (
              <div key={g.linkId} className="list-row">
                <span style={{ fontSize: 13 }}>{g.name} <span style={{ color: 'var(--text-muted)' }}>· {g.relationship.replace('_', ' ')}</span></span>
              </div>
            ))}
          </div>
        ),
        ...Object.fromEntries(extraTabs.map((t) => [t.id, t.content])),
      }}
    />
  );
}
