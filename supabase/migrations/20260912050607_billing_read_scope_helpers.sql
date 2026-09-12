-- Gap analysis 2026-09-11, Platform §1.4: billing_domain_foundation's own
-- comment admitted "Product-specific staff narrowing is added with the
-- corresponding Club/Tournament billing UI and policies" -- but none of the
-- 13 migrations after it ever did that for the READ side (the write side
-- was correctly narrowed in billing_creator_scope/billing_reviewer_scope).
-- As shipped, any is_org_member(org_id) -- a coach, a guardian, a player --
-- could read every invoice, payment submission, and payment allocation
-- belonging to their whole org, including other families' amounts and
-- payment references. These two helpers, plus the policy rewrites in the
-- migrations that follow, narrow reads to: platform admin (always), the
-- named payer (always, their own record), and staff/tournament-staff
-- actually holding a finance permission in that specific club/tournament --
-- mirroring can_review_billing_invoice's own branching exactly, so read and
-- write authorization for billing finally agree with each other.

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
    return public.has_tournament_permission('view_tournament_finances', v_account.tournament_id)
        or public.has_tournament_permission('manage_tournament_finances', v_account.tournament_id);
  end if;
  if v_account.context_type = 'platform' then
    return public.is_org_admin(v_account.org_id);
  end if;
  return false;
end $$;

revoke all on function public.can_read_billing_account(uuid) from public, anon;
grant execute on function public.can_read_billing_account(uuid) to authenticated, service_role;

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
    return public.has_tournament_permission('view_tournament_finances', p_context_id)
        or public.has_tournament_permission('manage_tournament_finances', p_context_id);
  end if;
  -- platform/shared usage facts carry no per-family data -- org admin
  -- visibility is the right default, same as billing_subscriptions_read.
  return public.is_org_admin(p_org_id);
end $$;

revoke all on function public.can_read_billing_context(text, uuid, uuid) from public, anon;
grant execute on function public.can_read_billing_context(text, uuid, uuid) to authenticated, service_role;
