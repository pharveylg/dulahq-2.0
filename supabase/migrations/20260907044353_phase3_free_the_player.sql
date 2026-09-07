-- Phase 3: a player becomes a person owned by a club, not a child record of a team.
-- Team membership and tournament entry become join tables, and the destructive
-- cascades that used to take a player's history with a deleted team are downgraded.

-- ---------- the player belongs to the club ----------
alter table public.players
  add column if not exists club_id uuid references public.clubs(id) on delete restrict,
  add column if not exists photo_url text,
  add column if not exists notes text;

comment on column public.players.age is
  'DEPRECATED - stale text copy of dob. Display only. Never decide with it; compute from dob at the date of the action.';

create index if not exists players_club_id_idx on public.players (club_id);

-- team_id stops being the player's identity
alter table public.players alter column team_id drop not null;
alter table public.players drop constraint if exists players_team_id_fkey;
alter table public.players
  add constraint players_team_id_fkey
  foreign key (team_id) references public.teams(id) on delete set null;

-- ---------- one player, many squads over time ----------
create table if not exists public.team_memberships (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations(id) on delete cascade,
  player_id  uuid not null references public.players(id) on delete cascade,
  team_id    uuid not null references public.teams(id) on delete cascade,
  jersey     text,
  position   text,
  from_date  date not null default current_date,
  to_date    date,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);
create index if not exists team_memberships_player_idx on public.team_memberships (player_id);
create index if not exists team_memberships_team_idx   on public.team_memberships (team_id);
create index if not exists team_memberships_org_idx    on public.team_memberships (org_id);
create unique index if not exists team_memberships_active_uidx
  on public.team_memberships (player_id, team_id) where to_date is null;

-- ---------- tournament categories become real ----------
create table if not exists public.tournament_categories (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations(id) on delete cascade,
  tournament_id text not null references public.tournaments(id) on delete cascade,
  name          text not null,
  age_group     text,
  min_birth_year integer,
  max_birth_year integer,
  format        text,
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now()
);
create index if not exists tournament_categories_tid_idx on public.tournament_categories (tournament_id);
create index if not exists tournament_categories_org_idx on public.tournament_categories (org_id);

-- a club team no longer has to belong to a tournament category
alter table public.teams alter column category_id drop not null;

-- ---------- a club team enters a tournament without belonging to it ----------
create table if not exists public.tournament_entries (
  id             uuid primary key default gen_random_uuid(),
  tournament_id  text not null references public.tournaments(id) on delete cascade,
  category_id    uuid references public.tournament_categories(id) on delete set null,
  host_org_id    uuid not null references public.organizations(id) on delete cascade,
  entrant_org_id uuid references public.organizations(id) on delete set null,
  club_id        uuid references public.clubs(id) on delete set null,
  team_id        uuid references public.teams(id) on delete set null,
  team_name      text not null,
  status         text not null default 'pending'
                 check (status in ('pending','accepted','declined','withdrawn')),
  consent_by     uuid references auth.users(id) on delete set null,
  consent_at     timestamptz,
  created_at     timestamptz not null default now(),
  created_by     uuid references auth.users(id) on delete set null
);
create index if not exists tournament_entries_tid_idx   on public.tournament_entries (tournament_id);
create index if not exists tournament_entries_host_idx  on public.tournament_entries (host_org_id);
create index if not exists tournament_entries_ent_idx   on public.tournament_entries (entrant_org_id);

comment on table public.tournament_entries is
  'The entry row is the consent record for the cross-org port: who agreed, when, and for which squad.';

-- ---------- venues ----------
create table if not exists public.venues (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations(id) on delete cascade,
  name       text not null,
  address    text,
  notes      text,
  created_at timestamptz not null default now()
);
create index if not exists venues_org_idx on public.venues (org_id);

alter table public.training_sessions drop constraint if exists training_sessions_venue_id_fkey;
alter table public.training_sessions
  add constraint training_sessions_venue_id_fkey
  foreign key (venue_id) references public.venues(id) on delete set null;

-- ---------- stop deleting a child's history with a squad ----------
do $mig$
declare
  r record;
  targets constant text[][] := array[
    ['player_evaluations','player_id','players'],
    ['development_goals','player_id','players'],
    ['player_development_notes','player_id','players'],
    ['attendance','player_id','players'],
    ['memberships','player_id','players'],
    ['fee_charges','player_id','players'],
    ['trip_passengers','player_id','players'],
    ['player_guardians','player_id','players']
  ];
  n int;
  cname text;
begin
  for n in 1 .. array_length(targets,1) loop
    select conname into cname
      from pg_constraint
      where conrelid = format('public.%I', targets[n][1])::regclass
        and contype = 'f'
        and conkey = array[(select attnum from pg_attribute
                            where attrelid = format('public.%I', targets[n][1])::regclass
                              and attname = targets[n][2])];
    if cname is not null then
      execute format('alter table public.%I drop constraint %I', targets[n][1], cname);
      execute format(
        'alter table public.%I add constraint %I foreign key (%I) references public.%I(id) on delete restrict',
        targets[n][1], cname, targets[n][2], targets[n][3]);
    end if;
  end loop;
end $mig$;

-- ---------- age is computed, never stored ----------
create or replace function public.age_on(p_dob date, p_on date default current_date)
returns integer language sql immutable as $$
  select case when p_dob is null then null
              else extract(year from age(p_on, p_dob))::int end;
$$;

create or replace function public.requires_guardian_consent(p_player_id uuid, p_on date default current_date)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.age_on(p.dob, p_on) < 18, true)
  from public.players p where p.id = p_player_id;
$$;

comment on function public.requires_guardian_consent(uuid,date) is
  'Computed from dob at the date of the action, never from teams.squad_type and never from players.age. Defaults to true when dob is unknown - unknown age is treated as a minor.';

-- ---------- fill org_id on the new tables from their parents ----------
drop trigger if exists fill_org_id on public.team_memberships;
create trigger fill_org_id before insert on public.team_memberships
  for each row execute function public.fill_org_id_from_parent('teams','team_id');

drop trigger if exists fill_org_id on public.tournament_categories;
create trigger fill_org_id before insert on public.tournament_categories
  for each row execute function public.fill_org_id_from_parent('tournaments','tournament_id');

-- ---------- RLS ----------
alter table public.team_memberships      enable row level security;
alter table public.tournament_categories enable row level security;
alter table public.tournament_entries    enable row level security;
alter table public.venues                enable row level security;

create policy tm_read on public.team_memberships for select to authenticated
  using (public.is_org_member(org_id) and (
           public.is_assigned_to_team(team_id)
           or public.is_guardian_of(player_id) or public.is_player_self(player_id)
           or exists (select 1 from public.teams t where t.id = team_memberships.team_id
                      and public.can_read_club(team_memberships.org_id, t.club_id))));
create policy tm_write on public.team_memberships for all to authenticated
  using (public.is_org_member(org_id) and exists (
           select 1 from public.teams t where t.id = team_memberships.team_id
             and public.can_admin_club(team_memberships.org_id, t.club_id)))
  with check (public.is_org_member(org_id));

create policy tc_public_read on public.tournament_categories for select to anon, authenticated
  using (exists (select 1 from public.tournaments t
                 where t.id = tournament_categories.tournament_id and t.publicly_listed = true));
create policy tc_member_read on public.tournament_categories for select to authenticated
  using (public.is_org_member(org_id));
create policy tc_write on public.tournament_categories for all to authenticated
  using (public.is_org_admin(org_id)) with check (public.is_org_admin(org_id));

-- Both sides of a cross-org entry can see it. Neither can see the other's other rows.
create policy te_read on public.tournament_entries for select to authenticated
  using (public.is_org_member(host_org_id) or public.is_org_member(entrant_org_id));
create policy te_host_write on public.tournament_entries for all to authenticated
  using (public.is_org_admin(host_org_id)) with check (public.is_org_admin(host_org_id));
create policy te_entrant_consent on public.tournament_entries for update to authenticated
  using (public.is_org_admin(entrant_org_id)) with check (public.is_org_admin(entrant_org_id));
create policy te_entrant_apply on public.tournament_entries for insert to authenticated
  with check (public.is_org_admin(entrant_org_id) or public.is_org_admin(host_org_id));

create policy venues_read on public.venues for select to authenticated
  using (public.is_org_member(org_id));
create policy venues_write on public.venues for all to authenticated
  using (public.is_org_admin(org_id)) with check (public.is_org_admin(org_id));;