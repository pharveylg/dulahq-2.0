-- Gap analysis 2026-09-11, Tournaments 3.4 / P1-11. billing_reviewer_scope and
-- billing_creator_scope both said, in their own comments, that tournament
-- billing "remains organizer-admin-only until Tournament Manager adopts the
-- shared tournament permission catalog". The catalog has existed since
-- phase8b and already has the right keys: manage_tournament_finances is held
-- by organizer and treasurer. tournament-billing-integration.md proposed six
-- brand-new keys instead; adding them would have created the second
-- permission vocabulary the roadmap itself warns about, so this reuses the
-- live one. is_org_admin stays as a second path (the org's own admin, and
-- the only path for a tournament with no tournament_staff bootstrapped yet).
create or replace function public.can_review_billing_invoice(p_invoice_id uuid)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  v_invoice public.billing_invoices%rowtype;
  v_account public.billing_accounts%rowtype;
begin
  select * into v_invoice from public.billing_invoices where id = p_invoice_id;
  if not found then return false; end if;
  if public.is_platform_admin() then return true; end if;
  select * into v_account from public.billing_accounts where id = v_invoice.billing_account_id;
  if v_invoice.context_type = 'club' and v_account.club_id is not null then
    return public.has_staff_permission('manage_finances', v_account.club_id, null);
  end if;
  if v_invoice.context_type = 'tournament' and v_account.tournament_id is not null then
    return public.is_org_admin(v_invoice.org_id)
        or public.has_tournament_permission('manage_tournament_finances', v_account.tournament_id);
  end if;
  return false;
end $$;

revoke all on function public.can_review_billing_invoice(uuid) from public, anon, authenticated;
grant execute on function public.can_review_billing_invoice(uuid) to authenticated;
