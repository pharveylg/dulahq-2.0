-- Phase 1.0: Foundation schema
--
-- COPIED FROM the `dula-hq` repo's 0001_foundation.sql so this repo is
-- self-contained and its migrations (including Club Manager's) can be
-- tested standalone without checking out a second repo. Keep this in
-- sync with dula-hq until the two repos converge -- if you change
-- tenants/organizations/sports/audit_logs in dula-hq, mirror the change
-- here too, or the two will drift.
--
-- Every tenant-scoped table follows the same base column convention.
-- This file only creates tables + the shared trigger for updated_at.
-- RLS policies are added in 0002_rls_policies.sql (kept separate so
-- schema changes and policy changes can be reviewed independently).

create extension if not exists "pgcrypto"; -- for gen_random_uuid()

-- ---------------------------------------------------------------------
-- Shared helper: auto-update `updated_at` on any row change.
-- Attach this trigger to every tenant-scoped table going forward.
-- ---------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ---------------------------------------------------------------------
-- tenants: the top of the hierarchy. Not itself tenant_id-scoped.
-- ---------------------------------------------------------------------
create table tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  subdomain text unique not null,
  status text not null default 'active' check (status in ('active', 'suspended', 'trial')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create trigger tenants_set_updated_at
  before update on tenants
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- tenant_users: join table mapping auth.users -> tenants with a role.
-- ---------------------------------------------------------------------
create table tenant_users (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique (tenant_id, user_id)
);

create trigger tenant_users_set_updated_at
  before update on tenant_users
  for each row execute function set_updated_at();

create index idx_tenant_users_user_id on tenant_users(user_id);
create index idx_tenant_users_tenant_id on tenant_users(tenant_id);

-- ---------------------------------------------------------------------
-- organizations: leagues/clubs within a tenant (Tournament Manager side --
-- distinct from Club Manager's `clubs` table added in 0004+)
-- ---------------------------------------------------------------------
create table organizations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create trigger organizations_set_updated_at
  before update on organizations
  for each row execute function set_updated_at();

create index idx_organizations_tenant_id on organizations(tenant_id);

-- ---------------------------------------------------------------------
-- sports: reference table. Not tenant-scoped -- shared lookup table
-- across the whole platform. Matches exactly what's live in the shared
-- Supabase project via dula-hq -- do NOT add Volleyball/Futsal here yet,
-- even though they're in Dula HQ 2.0's long-term sport-priority.md list.
-- This table only reflects what's actually built; add new sports as
-- their own migration when their Tournament/Club Manager modules are
-- actually being implemented, not speculatively ahead of that.
-- ---------------------------------------------------------------------
create table sports (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger sports_set_updated_at
  before update on sports
  for each row execute function set_updated_at();

insert into sports (slug, name) values
  ('tennis', 'Tennis'),
  ('pickleball', 'Pickleball'),
  ('basketball', 'Basketball'),
  ('football', 'Football');

-- ---------------------------------------------------------------------
-- audit_logs: append-only record of significant actions per tenant.
-- ---------------------------------------------------------------------
create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  actor_id uuid references auth.users(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index idx_audit_logs_tenant_id on audit_logs(tenant_id);
create index idx_audit_logs_created_at on audit_logs(created_at);
