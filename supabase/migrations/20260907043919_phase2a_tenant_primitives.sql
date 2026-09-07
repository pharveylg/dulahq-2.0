-- Phase 2a: the primitives the tenant boundary is built from.
-- sports, entitlements, scoped roles, and a real audit log.

-- ---------- sports ----------
create table if not exists public.sports (
  id          uuid primary key default gen_random_uuid(),
  key         text not null unique,
  name        text not null,
  status      text not null default 'coming_soon'
              check (status in ('production','coming_soon')),
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

insert into public.sports (key, name, status, sort_order) values
  ('football',   'Football',   'production',  1),
  ('tennis',     'Tennis',     'coming_soon', 2),
  ('pickleball', 'Pickleball', 'coming_soon', 3),
  ('basketball', 'Basketball', 'coming_soon', 4)
on conflict (key) do nothing;

-- ---------- what the org has bought ----------
create table if not exists public.org_entitlements (
  org_id      uuid not null references public.organizations(id) on delete cascade,
  product     text not null check (product in ('club','tournament')),
  status      text not null default 'active'
              check (status in ('active','trial','suspended','cancelled')),
  valid_until date,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (org_id, product)
);

-- ---------- one role table, replacing three ----------
create table if not exists public.role_assignments (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  scope_type text not null check (scope_type in ('platform','org','club','team','tournament')),
  scope_id   uuid,
  role       text not null,
  org_id     uuid references public.organizations(id) on delete cascade,
  granted_by uuid references auth.users(id) on delete set null,
  granted_at timestamptz not null default now(),
  constraint role_assignments_platform_shape
    check ((scope_type = 'platform') = (scope_id is null)),
  constraint role_assignments_org_required
    check (scope_type = 'platform' or org_id is not null)
);

create unique index if not exists role_assignments_scoped_uidx
  on public.role_assignments (user_id, scope_type, scope_id, role)
  where scope_id is not null;

create unique index if not exists role_assignments_platform_uidx
  on public.role_assignments (user_id, role)
  where scope_type = 'platform';

create index if not exists role_assignments_user_idx on public.role_assignments (user_id);
create index if not exists role_assignments_org_idx  on public.role_assignments (org_id);
create index if not exists role_assignments_scope_idx on public.role_assignments (scope_type, scope_id);

-- ---------- audit log: replace the match-scoped stub ----------
drop table if exists public.audit_log;

create table public.audit_log (
  id            bigint generated always as identity primary key,
  ts            timestamptz not null default now(),
  org_id        uuid references public.organizations(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_email   text,
  scope_type    text,
  scope_id      uuid,
  action        text not null,
  entity_type   text,
  entity_id     text,
  before        jsonb,
  after         jsonb
);

create index audit_log_org_ts_idx    on public.audit_log (org_id, ts desc);
create index audit_log_entity_idx    on public.audit_log (entity_type, entity_id);
create index audit_log_actor_idx     on public.audit_log (actor_user_id);

-- Append-only, enforced at the grant level as well as by policy.
revoke update, delete, truncate on public.audit_log from anon, authenticated;

create or replace function public.write_audit(
  p_org_id      uuid,
  p_action      text,
  p_scope_type  text default null,
  p_scope_id    uuid default null,
  p_entity_type text default null,
  p_entity_id   text default null,
  p_before      jsonb default null,
  p_after       jsonb default null
) returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare v_id bigint;
begin
  insert into public.audit_log (
    org_id, actor_user_id, actor_email, scope_type, scope_id,
    action, entity_type, entity_id, before, after)
  values (
    p_org_id, auth.uid(), auth.jwt() ->> 'email', p_scope_type, p_scope_id,
    p_action, p_entity_type, p_entity_id, p_before, p_after)
  returning id into v_id;
  return v_id;
end $$;

revoke all on function public.write_audit(uuid,text,text,uuid,text,text,jsonb,jsonb) from public, anon;
grant execute on function public.write_audit(uuid,text,text,uuid,text,text,jsonb,jsonb) to authenticated;;