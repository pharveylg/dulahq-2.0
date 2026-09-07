import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from './database.types';

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component -- middleware handles
            // session refresh in that case, safe to ignore here.
          }
        },
      },
    }
  );
}

/**
 * public.users.id IS auth.users.id (phase1_identity_on_auth_uid) -- a
 * trigger on auth.users creates the profile row on signup with the same
 * id and keeps email in sync, so matching by id is both simpler and more
 * robust than the old email match (immune to email casing/changes). This
 * helper is the app-code equivalent of current_dula_user_id(), for
 * places that need the current user's row (not just relying on RLS to
 * filter automatically, which it already does for query results).
 *
 * Returns null if there's no session, or if the trigger hasn't run yet
 * for some reason (shouldn't happen in normal operation, but code that
 * calls this should still treat a signed-in user with no profile row as
 * possible rather than assuming one always exists).
 */
export async function getCurrentDulaUser() {
  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) return null;

  const { data: dulaUser } = await supabase
    .from('users')
    .select('id, name, email, role')
    .eq('id', authUser.id)
    .maybeSingle();

  return dulaUser;
}

/**
 * Whether the signed-in session is a platform admin -- separate from and
 * not necessarily equal to public.users.role === 'admin' (see the note in
 * getCurrentDulaUser above).
 *
 * Calls the is_platform_admin() RPC rather than reimplementing its check
 * (role_assignments with scope_type='platform', OR the legacy
 * platform_admins table by email) in TypeScript: a hand-rolled version
 * that only checked platform_admins would silently disagree with RLS the
 * moment anyone is granted platform admin the new way (role_assignments,
 * per §4) instead of the legacy table -- RLS would let them in, the UI
 * wouldn't know it.
 */
export async function isPlatformAdmin() {
  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) return false;

  const { data } = await supabase.rpc('is_platform_admin');
  return !!data;
}

/**
 * Organizations the signed-in session can create a club for: every org if
 * they're a platform admin, or the orgs where org_members has them as
 * role='admin' otherwise. Used to gate + populate the "New club" org
 * picker -- mirrors the DB-side is_org_admin()/is_platform_admin() OR
 * that clubs' insert RLS policy actually enforces, so the UI doesn't show
 * an org the insert would then reject.
 */
export async function getClubCreatableOrgs() {
  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) return [];

  if (await isPlatformAdmin()) {
    const { data } = await supabase
      .from('organizations')
      .select('id, name')
      .order('name');
    return data ?? [];
  }

  // Org admin grants now live in two places: the legacy org_members table
  // (role='admin', matched by user_id or email) and role_assignments
  // (scope_type='org', role in ('org_admin','admin')) -- exactly what
  // is_org_admin(org) checks per-org on the DB side. There's no per-org
  // "list the orgs I admin" RPC, so this unions both sources directly
  // rather than calling is_org_admin() once per organization.
  const [{ data: viaRoleAssignments }, { data: viaOrgMembers }] = await Promise.all([
    supabase
      .from('role_assignments')
      .select('scope_id')
      .eq('scope_type', 'org')
      .in('role', ['org_admin', 'admin']),
    supabase
      .from('org_members')
      .select('org_id')
      .eq('role', 'admin')
      .or(`user_id.eq.${authUser.id},email.ilike.${authUser.email ?? ''}`),
  ]);

  const orgIds = Array.from(
    new Set([
      ...(viaRoleAssignments ?? []).map((r) => r.scope_id).filter((id): id is string => !!id),
      ...(viaOrgMembers ?? []).map((r) => r.org_id),
    ])
  );
  if (orgIds.length === 0) return [];

  const { data: orgs } = await supabase.from('organizations').select('id, name').in('id', orgIds).order('name');
  return orgs ?? [];
}

export type ClubRole = 'club_admin' | 'staff' | 'coach' | 'team_manager';

export type ClubAccess = {
  /** Signed in but has no club_staff row here and isn't a platform admin. */
  isSignedIn: boolean;
  isPlatformAdmin: boolean;
  role: ClubRole | null;
  /** club_admin or platform admin -- unrestricted within this club, per RBAC Phase 1. */
  isClubAdmin: boolean;
  /** Any club_staff role, or platform admin -- can see the club exists and manage assigned teams. */
  isStaff: boolean;
};

/**
 * Resolves this session's effective access at ONE club, mirroring exactly
 * what the RLS layer now enforces (rbac_phase1_narrow_coach_to_assigned_teams):
 * platform admin and club_admin are club-wide; every other club_staff role
 * (coach/team_manager/staff) is scoped to getAssignedTeamIds() below, not
 * the whole club. Used so pages don't show an edit control that RLS would
 * then silently reject -- the UI decision and the database decision read
 * from the same two facts (is_club_admin, is_assigned_to_team), not two
 * separately-maintained rules that can drift apart.
 */
export async function getClubAccess(clubId: string): Promise<ClubAccess> {
  const dulaUser = await getCurrentDulaUser();
  const platformAdmin = await isPlatformAdmin();

  if (!dulaUser) return { isSignedIn: false, isPlatformAdmin: platformAdmin, role: null, isClubAdmin: platformAdmin, isStaff: platformAdmin };

  const supabase = await createClient();
  // isClubAdmin/isStaff come from the RPCs (is_club_admin/is_club_staff),
  // not a club_staff role check, so a role_assignments-only grant (§4's
  // now-preferred way to grant a club role) is reflected here exactly like
  // RLS already sees it. `role` -- the specific label ('coach' etc.) shown
  // in the UI -- still only reflects club_staff, since role_assignments.role
  // has no enforced vocabulary to safely map into ClubRole; that's fine
  // because nothing gates access on `role` itself, only on the two booleans.
  const [{ data: staffRow }, { data: clubAdminRpc }, { data: clubStaffRpc }] = await Promise.all([
    supabase.from('club_staff').select('role').eq('club_id', clubId).eq('user_id', dulaUser.id).maybeSingle(),
    supabase.rpc('is_club_admin', { check_club_id: clubId }),
    supabase.rpc('is_club_staff', { check_club_id: clubId }),
  ]);
  const role = (staffRow?.role as ClubRole | undefined) ?? null;

  return {
    isSignedIn: true,
    isPlatformAdmin: platformAdmin,
    role,
    isClubAdmin: !!clubAdminRpc,
    isStaff: !!clubStaffRpc,
  };
}

/**
 * Team ids this session is specifically assigned to (public.user_assigned_teams)
 * -- the same table is_assigned_to_team() reads on the database side. A
 * club_admin/platform admin's access doesn't depend on this list at all
 * (they're club-wide); it only matters for scoping a coach/team_manager/staff
 * member's view down to the teams RLS will actually let them touch.
 */
export async function getAssignedTeamIds(): Promise<string[]> {
  const dulaUser = await getCurrentDulaUser();
  if (!dulaUser) return [];

  // current_user_team_ids() unions user_assigned_teams with
  // role_assignments (scope_type='team') -- calling it directly instead
  // of querying user_assigned_teams alone means a team grant made the new
  // way (role_assignments) shows up here too, not just at the RLS layer.
  const supabase = await createClient();
  const { data } = await supabase.rpc('current_user_team_ids');
  return data ?? [];
}

/**
 * Completes a guardian's self-claim (RBAC Phase 3) for the CURRENT
 * session, if one is pending: creates their public.users row if it
 * doesn't exist yet, then links guardians.user_id and flips
 * account_status to 'active'. Safe to call on every authenticated page
 * load -- it's a no-op once getCurrentDulaUser() already finds a row,
 * so call it only when that's null (see root layout). Doing the claim
 * this way, rather than from a specific post-confirmation redirect page,
 * sidesteps not knowing where Supabase's confirmation-email link lands --
 * this project's Auth redirect URL was set up for the original DulaHQ
 * app, not this one, and changing it would affect both.
 */
export async function claimPendingGuardianInvite() {
  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser?.email) return;

  // No email filter needed here -- "guardian can see own pending invite"
  // RLS already restricts this to exactly the caller's own row (matches
  // lower(contact_info->>'email') against their own JWT email), so
  // whatever comes back is guaranteed to be theirs. Filtering again here
  // with .ilike() would be both redundant and wrong -- ILIKE treats `_`
  // as a single-character wildcard, so it would over-match real emails
  // like "john_doe@example.com".
  const { data: invite } = await supabase
    .from('guardians')
    .select('id')
    .eq('account_status', 'invited')
    .maybeSingle();
  if (!invite) return;

  let { data: dulaUser } = await supabase.from('users').select('id').eq('id', authUser.id).maybeSingle();
  if (!dulaUser) {
    // Shouldn't normally happen -- the phase1 trigger creates this row on
    // signup -- but if it somehow hasn't run yet, public.users.id defaults
    // to gen_random_uuid(), NOT auth.uid(). Passing id explicitly here
    // avoids silently creating a profile row that current_dula_user_id()
    // (and every id-based RLS check) would never match.
    const { data: created } = await supabase
      .from('users')
      .insert({ id: authUser.id, email: authUser.email, name: authUser.email.split('@')[0], role: 'audience' })
      .select('id')
      .single();
    dulaUser = created;
  }
  if (!dulaUser) return;

  await supabase.from('guardians').update({ user_id: dulaUser.id, account_status: 'active' }).eq('id', invite.id);
}
