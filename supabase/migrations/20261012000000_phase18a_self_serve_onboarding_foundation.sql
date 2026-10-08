-- Phase 0 of docs/proposals/self-serve-org-onboarding.md: schema only, no new write
-- path, no UI. Reconciles one undocumented live gap and adds the config tables later
-- phases need. Nothing here changes what anon or an ordinary signed-in user can
-- already do.

-- 1. org_members has never had a CREATE TABLE in this repo's migration history,
-- though it has been read and written throughout the app since early in this
-- project (the same class of gap as the ten pre-phase2 migrations in CLAUDE.md §0a
-- and the 14 out-of-band billing migrations in §0m). This is a no-op on the live
-- project -- CREATE TABLE IF NOT EXISTS does nothing when the table already exists,
-- so it only matters for a fresh environment. The policies are dropped and
-- recreated rather than left to IF NOT EXISTS, since CREATE POLICY has no such
-- clause -- same end state live, and the only way to make this file runnable on a
-- database that doesn't have org_members yet.
create table if not exists public.org_members (
  org_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  user_id uuid references auth.users(id) on delete set null,
  role text not null check (role in ('admin', 'team', 'referee', 'official', 'audience')),
  created_at timestamptz not null default now(),
  primary key (org_id, email)
);
create index if not exists org_members_email_idx on public.org_members (email);
alter table public.org_members enable row level security;

drop policy if exists org_members_read on public.org_members;
create policy org_members_read on public.org_members for select to authenticated
  using (public.is_org_member(org_id));
drop policy if exists org_members_write on public.org_members;
create policy org_members_write on public.org_members for all to authenticated
  using (public.is_org_admin(org_id)) with check (public.is_org_admin(org_id));
drop policy if exists org_not_suspended on public.org_members;
create policy org_not_suspended on public.org_members as restrictive for all to authenticated
  using (public.org_access_allowed(org_id));

-- 2. Organization contact details and address. Deliberately NOT columns on
-- `organizations` -- that table grants anon full table-level privileges (only
-- orgs_public_read's row policy narrows it, and Postgres RLS cannot hide one
-- column from a row a policy already admits), so a contact/address column there
-- would be publicly readable the moment it held data, before any public page or
-- opt-in existed to justify it. Same shape as player_public_profiles (phase17a):
-- a separate table, no anon grant at all, with its own explicit publish flag that
-- nothing reads publicly yet -- building the actual public reveal is a later,
-- conscious phase, not a side effect of adding these columns.
create table if not exists public.organization_contact_details (
  org_id uuid primary key references public.organizations(id) on delete cascade,
  contact_name text,
  contact_email text,
  contact_phone text,
  website text,
  address_line1 text,
  address_line2 text,
  city text,
  region text,
  postal_code text,
  country text,
  show_publicly boolean not null default false,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.organization_contact_details enable row level security;
revoke all on public.organization_contact_details from anon, public;
grant select, insert, update on public.organization_contact_details to authenticated;

create policy organization_contact_details_read on public.organization_contact_details for select to authenticated
  using (public.is_org_member(org_id));
create policy organization_contact_details_write on public.organization_contact_details for all to authenticated
  using (public.is_org_admin(org_id)) with check (public.is_org_admin(org_id));
create policy org_not_suspended on public.organization_contact_details as restrictive for all to authenticated
  using (public.org_access_allowed(org_id));

-- 3. Organization "about" and "location" extend the SAME already-fully-public
-- surface name/accent/logo_url already sit on (orgs_public_read admits anon for
-- any active org, with no listing gate at all, unlike clubs) -- these two add no
-- new exposure beyond what's already true today.
alter table public.organizations add column if not exists about text;
alter table public.organizations add column if not exists location text;

-- 4. Trial policy: one platform-wide trial length, not hidden in app code.
-- Singleton row, same pattern this project uses nowhere else yet but Postgres
-- supports cleanly: a boolean primary key that can only ever be `true`.
create table if not exists public.trial_policy (
  id boolean primary key default true check (id),
  trial_days integer not null default 14,
  updated_at timestamptz not null default now()
);
insert into public.trial_policy (id, trial_days) values (true, 14) on conflict (id) do nothing;
alter table public.trial_policy enable row level security;
revoke all on public.trial_policy from anon, public;
grant select on public.trial_policy to authenticated;
create policy trial_policy_read on public.trial_policy for select to authenticated using (true);
create policy trial_policy_write on public.trial_policy for update to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());

-- 5. Trial hard caps, keyed by product -- versioned by having a real updated_at
-- rather than a code constant, per the review's own "must be versioned... not
-- hidden constants spread through UI code". Phase 2 reads this; nothing writes
-- to the capped resources based on it yet.
create table if not exists public.trial_caps (
  product text not null check (product in ('club', 'tournament')),
  limit_key text not null,
  limit_value integer not null,
  updated_at timestamptz not null default now(),
  primary key (product, limit_key)
);
insert into public.trial_caps (product, limit_key, limit_value) values
  ('club', 'clubs_per_org', 1),
  ('club', 'teams_per_club', 1),
  ('tournament', 'tournaments_per_org', 1),
  ('tournament', 'entries_per_tournament', 5)
on conflict (product, limit_key) do nothing;
alter table public.trial_caps enable row level security;
revoke all on public.trial_caps from anon, public;
grant select on public.trial_caps to authenticated;
create policy trial_caps_read on public.trial_caps for select to authenticated using (true);
create policy trial_caps_write on public.trial_caps for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());
