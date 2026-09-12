-- Platform Admin can configure manual QR/payment instructions before an
-- automated provider exists. The same fields are reused by Club/Tournament
-- finance settings in later phases.

create or replace function public.update_billing_account_instructions(
  p_account_id uuid,
  p_payment_instructions text,
  p_qr_storage_key text default null
) returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_account public.billing_accounts%rowtype;
begin
  select * into v_account from public.billing_accounts where id = p_account_id for update;
  if not found then raise exception 'billing account not found' using errcode = 'no_data_found'; end if;
  if not public.is_platform_admin() then
    raise exception 'platform admin only during the validation phase'
      using errcode = 'insufficient_privilege';
  end if;

  update public.billing_accounts
     set payment_instructions = nullif(trim(p_payment_instructions), ''),
         qr_storage_key = nullif(trim(p_qr_storage_key), ''),
         updated_at = now()
   where id = p_account_id;

  perform public.write_audit(
    v_account.org_id, 'billing.payment_instructions.updated', v_account.context_type,
    coalesce(v_account.club_id, v_account.tournament_id), 'billing_account', p_account_id::text,
    jsonb_build_object('payment_instructions', v_account.payment_instructions, 'qr_storage_key', v_account.qr_storage_key),
    jsonb_build_object('payment_instructions', nullif(trim(p_payment_instructions), ''), 'qr_storage_key', nullif(trim(p_qr_storage_key), ''))
  );
end $$;

revoke all on function public.update_billing_account_instructions(uuid,text,text) from public, anon;
grant execute on function public.update_billing_account_instructions(uuid,text,text) to authenticated;
