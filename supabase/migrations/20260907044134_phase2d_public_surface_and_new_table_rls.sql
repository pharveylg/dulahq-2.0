-- Phase 2d: the public directory surface, and RLS for the new tenant primitives.
-- The directory is the one sanctioned cross-tenant read. It is served by base-table
-- policies gated on a published flag plus column-limited views, never by a view
-- that bypasses RLS.

-- ---------- clubs get a published flag ----------
alter table public.clubs
  add column if not exists publicly_listed boolean not null default false,
  add column if not exists sport_id uuid references public.sports(id),
  add column if not exists about text,
  add column if not exists location text;

alter table public.tournaments
  add column if not exists sport_id uuid references public.sports(id);

alter table public.teams
  add column if not exists sport_id uuid references public.sports(id),
  add column if not exists squad_type text not null default 'grassroots'
    check (squad_type in ('grassroots','adult'));

update public.clubs      set sport_id = (select id from public.sports where key='football') where sport_id is null;
update public.tournaments set sport_id = (select id from public.sports where key='football') where sport_id is null;
update public.teams      set sport_id = (select id from public.sports where key='football') where sport_id is null;

-- ---------- the leak: replace the bypassing view ----------
drop view if exists public.tournament_names;

create policy "public read published tournaments"
  on public.tournaments for select to anon, authenticated
  using (publicly_listed = true);

create policy "public read listed clubs"
  on public.clubs for select to anon, authenticated
  using (publicly_listed = true);

create view public.public_tournaments
with (security_invoker = true) as
  select t.id, t.name, t.slug, t.poster_url, t.event_date, t.venue,
         t.sport_id, o.slug as org_slug, o.name as org_name, o.accent as org_accent,
         o.logo_url as org_logo_url
  from public.tournaments t
  join public.organizations o on o.id = t.org_id
  where t.publicly_listed = true and o.status = 'active';

create view public.public_clubs
with (security_invoker = true) as
  select c.id, c.name, c.slug, c.about, c.location, c.sport_id,
         o.slug as org_slug, o.name as org_name, o.accent as org_accent
  from public.clubs c
  join public.organizations o on o.id = c.org_id
  where c.publicly_listed = true and o.status = 'active';

grant select on public.public_tournaments, public.public_clubs to anon, authenticated;

-- ---------- access requests learn what they are for ----------
alter table public.access_requests
  add column if not exists scope_type   text check (scope_type in ('org','club','tournament')),
  add column if not exists scope_id     uuid,
  add column if not exists requested_by uuid references auth.users(id) on delete set null,
  add column if not exists decided_at   timestamptz,
  add column if not exists decided_by   uuid references auth.users(id) on delete set null;

-- ---------- storage naming stops implying a provider we don't use ----------
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema='public' and table_name='media' and column_name='r2_key')
  and not exists (select 1 from information_schema.columns
             where table_schema='public' and table_name='media' and column_name='storage_key')
  then
    alter table public.media rename column r2_key to storage_key;
  end if;
end $$;

-- ---------- RLS on the new primitives ----------
alter table public.sports            enable row level security;
alter table public.org_entitlements  enable row level security;
alter table public.role_assignments  enable row level security;
alter table public.audit_log         enable row level security;

create policy "sports readable by all" on public.sports
  for select to anon, authenticated using (true);
create policy "platform admin writes sports" on public.sports
  for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());

create policy "org members read their entitlements" on public.org_entitlements
  for select to authenticated using (public.is_org_member(org_id));
create policy "platform admin writes entitlements" on public.org_entitlements
  for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());

create policy "read own and org role assignments" on public.role_assignments
  for select to authenticated
  using (user_id = auth.uid() or public.is_org_admin(org_id) or public.is_platform_admin());
create policy "org admins grant roles in their org" on public.role_assignments
  for all to authenticated
  using (public.is_org_admin(org_id)) with check (public.is_org_admin(org_id));

-- Append-only: a select policy and an insert policy, and deliberately no
-- update or delete policy for anyone, platform admin included.
create policy "read audit within org" on public.audit_log
  for select to authenticated
  using (public.is_platform_admin() or public.is_org_admin(org_id));
create policy "insert audit within org" on public.audit_log
  for insert to authenticated
  with check (org_id is null or public.is_org_member(org_id));;