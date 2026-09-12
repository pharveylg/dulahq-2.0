-- 20260910100000_billing_context_provisioning.sql was applied by hand outside
-- the tracked migration history; its backfill INSERTs ran (confirmed live:
-- billing_accounts already has one row per existing club/tournament) but its
-- trigger definition did not -- provision_product_billing_account() and both
-- triggers were absent. This applies exactly that missing piece so every
-- NEWLY created club/tournament also gets a billing account automatically,
-- matching tournament-billing-integration.md's documented contract.

create or replace function public.provision_product_billing_account()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if tg_table_name = 'clubs' then
    insert into public.billing_accounts(org_id, context_type, club_id, display_name)
    values (new.org_id, 'club', new.id, new.name || ' — club billing')
    on conflict (club_id) where context_type = 'club' do nothing;
  elsif tg_table_name = 'tournaments' then
    insert into public.billing_accounts(org_id, context_type, tournament_id, display_name)
    values (new.org_id, 'tournament', new.id, new.name || ' — tournament billing')
    on conflict (tournament_id) where context_type = 'tournament' do nothing;
  end if;
  return new;
end $$;

revoke all on function public.provision_product_billing_account() from public, anon, authenticated;
grant execute on function public.provision_product_billing_account() to service_role;

drop trigger if exists clubs_provision_billing_account on public.clubs;
create trigger clubs_provision_billing_account
after insert on public.clubs
for each row execute function public.provision_product_billing_account();

drop trigger if exists tournaments_provision_billing_account on public.tournaments;
create trigger tournaments_provision_billing_account
after insert on public.tournaments
for each row execute function public.provision_product_billing_account();
