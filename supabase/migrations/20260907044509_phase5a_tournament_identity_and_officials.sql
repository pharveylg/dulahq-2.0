-- Phase 5a: give the tournament side a person.
-- Every participant gets a row. Linking that row to a club-owned player is an
-- upgrade, never a requirement, so a visiting squad from a club that isn't on
-- Dula HQ still works and still carries no development record.

-- ---------- the roster ----------
create table if not exists public.tournament_roster (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations(id) on delete cascade,
  tournament_id text not null references public.tournaments(id) on delete cascade,
  entry_id      uuid not null references public.tournament_entries(id) on delete cascade,

  -- the host org's own copy of the minimum needed to check eligibility
  full_name     text not null,
  dob           date,
  jersey        text,
  position      text,

  -- the pointer home. Nullable on purpose: unlinked means a visiting player.
  player_id       uuid references public.players(id) on delete set null,
  source_org_id   uuid references public.organizations(id) on delete set null,

  consent_on_file boolean not null default false,
  status          text not null default 'submitted'
                  check (status in ('submitted','approved','rejected','withdrawn')),
  reject_reason   text,
  created_at      timestamptz not null default now(),
  created_by      uuid references auth.users(id) on delete set null
);
create index if not exists tournament_roster_entry_idx  on public.tournament_roster (entry_id);
create index if not exists tournament_roster_tid_idx    on public.tournament_roster (tournament_id);
create index if not exists tournament_roster_player_idx on public.tournament_roster (player_id);
create index if not exists tournament_roster_org_idx    on public.tournament_roster (org_id);

comment on column public.tournament_roster.player_id is
  'A pointer, not a join. Used to address the results write-back; never read across the org fence.';

-- ---------- who is registered for this tournament, and as what ----------
create table if not exists public.tournament_members (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations(id) on delete cascade,
  tournament_id text not null references public.tournaments(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  role          text not null
                check (role in ('organiser','team_manager','referee','officials','volunteer')),
  entry_id      uuid references public.tournament_entries(id) on delete cascade,
  created_at    timestamptz not null default now(),
  created_by    uuid references auth.users(id) on delete set null,
  unique (tournament_id, user_id, role)
);
create index if not exists tournament_members_user_idx on public.tournament_members (user_id);
create index if not exists tournament_members_tid_idx  on public.tournament_members (tournament_id);

comment on table public.tournament_members is
  'Answers "is this person registered for this tournament, and as what" - the branch the entry flow turns on.';

-- ---------- the officiating pool belongs to the org and is retained ----------
create table if not exists public.org_officials (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations(id) on delete cascade,
  user_id      uuid references auth.users(id) on delete set null,
  full_name    text not null,
  grade        text,
  designation  text,
  phone        text,
  email        text,
  availability text,
  active       boolean not null default true,
  notes        text,
  created_at   timestamptz not null default now(),
  created_by   uuid references auth.users(id) on delete set null
);
create index if not exists org_officials_org_idx  on public.org_officials (org_id, active);
create index if not exists org_officials_user_idx on public.org_officials (user_id);

comment on table public.org_officials is
  'The retained asset. An account (user_id) is an upgrade, not a requirement - most local referees never sign up but still need grading and a match history.';

create table if not exists public.tournament_officials (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations(id) on delete cascade,
  tournament_id text not null references public.tournaments(id) on delete cascade,
  official_id   uuid not null references public.org_officials(id) on delete restrict,
  role          text not null default 'referee'
                check (role in ('referee','assistant_referee','fourth_official','commissioner','table_official')),
  created_at    timestamptz not null default now(),
  created_by    uuid references auth.users(id) on delete set null,
  unique (tournament_id, official_id, role)
);
create index if not exists tournament_officials_tid_idx on public.tournament_officials (tournament_id);

comment on table public.tournament_officials is
  'Per-tournament assignment drawn from the pool. Archiving a tournament keeps these rows and leaves org_officials untouched.';

-- ---------- a goal stops belonging to a string ----------
alter table public.match_events
  add column if not exists player_id     uuid references public.tournament_roster(id) on delete set null,
  add column if not exists player_off_id uuid references public.tournament_roster(id) on delete set null,
  add column if not exists official_id   uuid references public.org_officials(id) on delete set null;

comment on column public.match_events.player_name is
  'DEPRECATED - free text. Use player_id. Kept only until the tournament module is rebuilt.';

alter table public.matches
  add column if not exists tournament_id text references public.tournaments(id) on delete cascade,
  add column if not exists official_id   uuid references public.org_officials(id) on delete set null;

alter table public.matches alter column category_id drop not null;
alter table public.matches drop constraint if exists matches_category_id_fkey;
alter table public.matches
  add constraint matches_category_id_fkey
  foreign key (category_id) references public.tournament_categories(id) on delete set null;

-- ---------- the club's own copy of what its players earned ----------
create table if not exists public.player_tournament_results (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.organizations(id) on delete cascade,
  player_id      uuid not null references public.players(id) on delete cascade,
  tournament_id  text not null,
  tournament_name text not null,
  host_org_id    uuid references public.organizations(id) on delete set null,
  match_id       uuid,
  match_date     date,
  minutes        integer,
  goals          integer not null default 0,
  assists        integer not null default 0,
  yellow_cards   integer not null default 0,
  red_cards      integer not null default 0,
  recorded_at    timestamptz not null default now(),
  unique (player_id, match_id)
);
create index if not exists ptr_player_idx on public.player_tournament_results (player_id);
create index if not exists ptr_org_idx    on public.player_tournament_results (org_id);

comment on table public.player_tournament_results is
  'Org A''s own copy, written by the results port. Survives the host org deleting everything.';

-- ---------- org_id derivation for the new tables ----------
drop trigger if exists fill_org_id on public.tournament_roster;
create trigger fill_org_id before insert on public.tournament_roster
  for each row execute function public.fill_org_id_from_parent('tournaments','tournament_id');

drop trigger if exists fill_org_id on public.tournament_members;
create trigger fill_org_id before insert on public.tournament_members
  for each row execute function public.fill_org_id_from_parent('tournaments','tournament_id');

drop trigger if exists fill_org_id on public.tournament_officials;
create trigger fill_org_id before insert on public.tournament_officials
  for each row execute function public.fill_org_id_from_parent('tournaments','tournament_id');;