-- Payment instructions were Platform-Admin-only "during the validation phase".
-- For a TOURNAMENT account that stops making sense once the host is the one
-- receiving the money: the instructions are their own bank/GCash details, and
-- making Platform Admin type them in for every tournament doesn't scale.
-- Widened for tournament accounts only, to the same people who may issue and
-- verify that tournament's invoices (org admin, or manage_tournament_finances).
-- CLUB accounts stay Platform-Admin-only until the club side gets the same
-- decision made deliberately.
create or replace function public.update_billing_account_instructions(
  p_account_id uuid,
  p_payment_instructions text,
  p_qr_storage_key text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_account public.billing_accounts%rowtype;
begin
  select * into v_account from public.billing_accounts where id = p_account_id for update;
  if not found then raise exception 'billing account not found' using errcode = 'no_data_found'; end if;
  if not (
    public.is_platform_admin()
    or (v_account.context_type = 'tournament' and v_account.tournament_id is not null
        and (public.is_org_admin(v_account.org_id)
             or public.has_tournament_permission('manage_tournament_finances', v_account.tournament_id)))
  ) then
    raise exception 'not authorized to edit this account''s payment instructions'
      using errcode = 'insufficient_privilege';
  end if;

  update public.billing_accounts
     set payment_instructions = nullif(trim(p_payment_instructions), ''),
         qr_storage_key = nullif(trim(p_qr_storage_key), ''),
         updated_at = now()
   where id = p_account_id;

  perform public.write_audit_system(
    v_account.org_id, 'billing.payment_instructions.updated', v_account.context_type,
    coalesce(v_account.club_id, v_account.tournament_id), 'billing_account', p_account_id::text,
    jsonb_build_object('payment_instructions', v_account.payment_instructions, 'qr_storage_key', v_account.qr_storage_key),
    jsonb_build_object('payment_instructions', nullif(trim(p_payment_instructions), ''), 'qr_storage_key', nullif(trim(p_qr_storage_key), ''))
  );
end $$;
