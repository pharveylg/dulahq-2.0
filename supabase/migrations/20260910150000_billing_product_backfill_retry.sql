-- Retry/backfill product billing accounts for existing data.
-- Some legacy Tournament Manager rows may not yet have an org_id. They are
-- intentionally skipped rather than assigned to an arbitrary organization;
-- run the orphan checks below before deciding how to map those records.

insert into public.billing_accounts(org_id, context_type, club_id, display_name)
select c.org_id, 'club', c.id, coalesce(c.name, 'Club') || ' — club billing'
from public.clubs c
where c.org_id is not null
on conflict (club_id) where context_type = 'club' do nothing;

insert into public.billing_accounts(org_id, context_type, tournament_id, display_name)
select t.org_id, 'tournament', t.id, coalesce(t.name, 'Tournament') || ' — tournament billing'
from public.tournaments t
where t.org_id is not null
on conflict (tournament_id) where context_type = 'tournament' do nothing;

-- Review these separately. Do not invent an org_id for an orphaned record.
select 'clubs_without_org_id' as check_name, count(*) as records
from public.clubs
where org_id is null
union all
select 'tournaments_without_org_id', count(*)
from public.tournaments
where org_id is null;
