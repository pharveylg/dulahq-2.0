-- Create product billing contexts for existing and newly-created clubs and
-- tournaments. This is a billing account/instructions record only; it does
-- not create an invoice or contact a payment provider.

insert into public.billing_accounts(org_id, context_type, club_id, display_name)
select c.org_id, 'club', c.id, c.name || ' — club billing'
from public.clubs c
where not exists (
  select 1 from public.billing_accounts b
  where b.context_type = 'club' and b.club_id = c.id
);

insert into public.billing_accounts(org_id, context_type, tournament_id, display_name)
select t.org_id, 'tournament', t.id, t.name || ' — tournament billing'
from public.tournaments t
where not exists (
  select 1 from public.billing_accounts b
  where b.context_type = 'tournament' and b.tournament_id = t.id
);

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
