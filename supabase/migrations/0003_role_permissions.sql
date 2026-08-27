-- Phase 1.2: Role expansion
--
-- COPIED FROM the `dula-hq` repo's 0003_role_permissions.sql. See the
-- note at the top of 0001_foundation.sql about keeping these in sync.

create table role_permissions (
  id uuid primary key default gen_random_uuid(),
  role text not null,
  resource text not null,
  action text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (role, resource, action)
);

create trigger role_permissions_set_updated_at
  before update on role_permissions
  for each row execute function set_updated_at();

alter table role_permissions enable row level security;

create policy "authenticated users can view role permissions"
  on role_permissions for select
  using (auth.role() = 'authenticated');

insert into role_permissions (role, resource, action) values
  ('platform_admin', 'tenants', 'view'),
  ('platform_admin', 'tenants', 'update'),
  ('tenant_owner', 'tenant_settings', 'view'),
  ('tenant_owner', 'tenant_settings', 'update'),
  ('tenant_owner', 'organizations', 'create'),
  ('league_admin', 'organizations', 'update'),
  ('league_admin', 'tournaments', 'create'),
  ('tournament_director', 'tournaments', 'update'),
  ('tournament_director', 'matches', 'create'),
  ('official', 'matches', 'update'),
  ('scorekeeper', 'matches', 'update'),
  ('coach', 'teams', 'update'),
  ('player', 'registrations', 'create'),
  ('spectator', 'matches', 'view');

create or replace function has_permission(
  check_tenant_id uuid,
  check_resource text,
  check_action text
)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1
    from tenant_users tu
    join role_permissions rp on rp.role = tu.role
    where tu.tenant_id = check_tenant_id
      and tu.user_id = auth.uid()
      and rp.resource = check_resource
      and rp.action = check_action
  );
$$;
