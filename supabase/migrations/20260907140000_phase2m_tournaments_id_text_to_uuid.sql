-- tournaments.id was text, inherited from 1.0's single-tournament era
-- (CLAUDE.md §6.G). Every dependent table is confirmed empty (tournaments,
-- matches, tournament_categories, tournament_entries, tournament_members,
-- tournament_officials, tournament_roster, player_tournament_results) --
-- this is the cheapest this migration will ever be.
--
-- Verified safe before running: the Tournament Manager app's own id
-- generator (newTournamentId_() in index.html) already produces
-- crypto.randomUUID() values on every insert (the non-UUID fallback only
-- fires in browsers without crypto.randomUUID, which is effectively none
-- today) -- so this doesn't require any change to that app, which stays
-- unrewritten per §8. No function or app code was found casting or
-- string-parsing a tournament id. Two things WERE found to depend on the
-- column's type and had to be dropped/recreated around this migration:
-- the public_tournaments view, and tournament_categories' tc_public_read
-- policy (the only policy across all 8 tables that compares directly
-- against tournaments.id rather than going through org_id).

drop view public.public_tournaments;
drop policy tc_public_read on public.tournament_categories;

alter table public.matches drop constraint matches_tournament_id_fkey;
alter table public.tournament_categories drop constraint tournament_categories_tournament_id_fkey;
alter table public.tournament_entries drop constraint tournament_entries_tournament_id_fkey;
alter table public.tournament_members drop constraint tournament_members_tournament_id_fkey;
alter table public.tournament_officials drop constraint tournament_officials_tournament_id_fkey;
alter table public.tournament_roster drop constraint tournament_roster_tournament_id_fkey;

alter table public.tournaments alter column id type uuid using id::uuid;
alter table public.tournaments alter column id set default gen_random_uuid();

alter table public.matches alter column tournament_id type uuid using tournament_id::uuid;
alter table public.tournament_categories alter column tournament_id type uuid using tournament_id::uuid;
alter table public.tournament_entries alter column tournament_id type uuid using tournament_id::uuid;
alter table public.tournament_members alter column tournament_id type uuid using tournament_id::uuid;
alter table public.tournament_officials alter column tournament_id type uuid using tournament_id::uuid;
alter table public.tournament_roster alter column tournament_id type uuid using tournament_id::uuid;
-- no formal FK on player_tournament_results.tournament_id (never had one),
-- but it's the same logical reference and must stay the same type.
alter table public.player_tournament_results alter column tournament_id type uuid using tournament_id::uuid;

alter table public.matches add constraint matches_tournament_id_fkey foreign key (tournament_id) references public.tournaments(id);
alter table public.tournament_categories add constraint tournament_categories_tournament_id_fkey foreign key (tournament_id) references public.tournaments(id);
alter table public.tournament_entries add constraint tournament_entries_tournament_id_fkey foreign key (tournament_id) references public.tournaments(id);
alter table public.tournament_members add constraint tournament_members_tournament_id_fkey foreign key (tournament_id) references public.tournaments(id);
alter table public.tournament_officials add constraint tournament_officials_tournament_id_fkey foreign key (tournament_id) references public.tournaments(id);
alter table public.tournament_roster add constraint tournament_roster_tournament_id_fkey foreign key (tournament_id) references public.tournaments(id);

create policy tc_public_read on public.tournament_categories for select
  using (exists (select 1 from public.tournaments t where t.id = tournament_categories.tournament_id and t.publicly_listed = true));

create view public.public_tournaments
with (security_invoker = true) as
 select t.id,
    t.name,
    t.slug,
    t.poster_url,
    t.event_date,
    t.venue,
    t.sport_id,
    o.slug as org_slug,
    o.name as org_name,
    o.accent as org_accent,
    o.logo_url as org_logo_url
   from (tournaments t
     join organizations o on ((o.id = t.org_id)))
  where ((t.publicly_listed = true) and (o.status = 'active'::text));

revoke all on public.public_tournaments from anon, authenticated;
grant select on public.public_tournaments to anon, authenticated;
