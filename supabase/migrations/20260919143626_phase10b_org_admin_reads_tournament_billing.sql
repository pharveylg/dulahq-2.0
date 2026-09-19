-- Found by driving the organizer console as an org admin: the entry-fee
-- invoice step said "no billing account you can use". create_billing_invoice
-- and can_review_billing_invoice both accept is_org_admin for tournament
-- billing (phase9c), but the read helpers written in the earlier billing
-- narrowing only accepted the tournament finance permissions -- so an org
-- admin who is not also tournament staff could issue an invoice and then not
-- read the account or invoice they had just created. Read and write now agree.
create or replace function public.can_read_billing_account(p_account_id uuid)
returns boolean
language plpgsql stable security definer set search_path = public
as $$
declare
  v_account public.billing_accounts%rowtype;
begin
  select * into v_account from public.billing_accounts where id = p_account_id;
  if not found then return false; end if;
  if public.is_platform_admin() then return true; end if;
  if v_account.context_type = 'club' and v_account.club_id is not null then
    return public.has_staff_permission('view_finances', v_account.club_id, null)
        or public.has_staff_permission('manage_finances', v_account.club_id, null);
  end if;
  if v_account.context_type = 'tournament' and v_account.tournament_id is not null then
    return public.is_org_admin(v_account.org_id)
        or public.has_tournament_permission('view_tournament_finances', v_account.tournament_id)
        or public.has_tournament_permission('manage_tournament_finances', v_account.tournament_id);
  end if;
  if v_account.context_type = 'platform' then
    return public.is_org_admin(v_account.org_id);
  end if;
  return false;
end $$;

create or replace function public.can_read_billing_context(p_context_type text, p_context_id uuid, p_org_id uuid)
returns boolean
language plpgsql stable security definer set search_path = public
as $$
begin
  if public.is_platform_admin() then return true; end if;
  if p_context_type = 'club' and p_context_id is not null then
    return public.has_staff_permission('view_finances', p_context_id, null)
        or public.has_staff_permission('manage_finances', p_context_id, null);
  end if;
  if p_context_type = 'tournament' and p_context_id is not null then
    return public.is_org_admin(p_org_id)
        or public.has_tournament_permission('view_tournament_finances', p_context_id)
        or public.has_tournament_permission('manage_tournament_finances', p_context_id);
  end if;
  return public.is_org_admin(p_org_id);
end $$;
