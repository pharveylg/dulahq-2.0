-- P1-7 (docs/club-entitlement-gap-analysis.md §1): "No staff profile beyond
-- name/email/role; no photo, phone, bio, or qualifications." The
-- account/membership/profile split the analysis asked for: `users` stays
-- account-only (name, email, auth); `club_staff` stays membership (role,
-- status, team assignment); this table is the third, genuinely new thing --
-- role-specific personal info nothing else models.
--
-- Keyed 1:1 on club_staff.id, not user_id: a person's bio/phone/photo is
-- naturally per-membership, not per-account -- the same person coaching at
-- two different clubs plausibly wants a different phone number or photo on
-- file at each. Cascades with club_staff, so an archived row's profile
-- simply goes along for the ride rather than needing separate cleanup.
create table if not exists public.staff_profiles (
  club_staff_id uuid primary key references public.club_staff(id) on delete cascade,
  club_id uuid not null references public.clubs(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  phone text,
  bio text,
  photo_key text,
  -- [{ "name": "...", "issuer": "...", "expiresOn": "YYYY-MM-DD" | null }, ...]
  -- -- a jsonb array rather than a child table: a handful of entries per
  -- person, never queried independently of the profile they belong to, and
  -- nothing here needs the row-level RLS a real child table would carry.
  certifications jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.staff_profiles enable row level security;

-- Self-service is the primary path (editing your own phone/bio/photo isn't
-- a privileged administrative act), with can_admin_club as the fallback
-- for a club_manager fixing a typo or recording a certification on
-- someone's behalf -- same two-tier shape as everywhere else in this file,
-- no new permission catalog entry needed for either branch.
create policy staff_profiles_read on public.staff_profiles for select to authenticated
using (
  public.can_read_club(org_id, club_id)
  or exists (select 1 from public.club_staff cs where cs.id = club_staff_id and cs.user_id = auth.uid())
);

create policy staff_profiles_write on public.staff_profiles for all to authenticated
using (
  public.can_admin_club(org_id, club_id)
  or exists (select 1 from public.club_staff cs where cs.id = club_staff_id and cs.user_id = auth.uid())
)
with check (
  public.can_admin_club(org_id, club_id)
  or exists (select 1 from public.club_staff cs where cs.id = club_staff_id and cs.user_id = auth.uid())
);
