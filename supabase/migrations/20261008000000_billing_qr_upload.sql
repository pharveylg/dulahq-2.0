-- Payment QR images for billing accounts. Private bucket: images are only ever served
-- through short-lived signed URLs minted by server code. Writes are service-role only;
-- the checked RPC below decides whether a caller may point an account at a new image.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('billing-qr', 'billing-qr', false, 5242880, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

-- Who may change the QR on an account:
--   platform context  -> platform admin
--   club context      -> platform admin, or an org admin of the club's organization
--   tournament context -> platform admin, org admin, or holders of manage_tournament_finances
-- Keys are per-upload (<account id>/qr-<uuid>); a key for another account is refused.
create or replace function public.set_billing_account_qr(p_account_id uuid, p_qr_key text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_account public.billing_accounts%rowtype;
  v_key text := nullif(btrim(p_qr_key), '');
begin
  select * into v_account from public.billing_accounts where id = p_account_id for update;
  if not found then raise exception 'billing account not found' using errcode = 'no_data_found'; end if;

  if not (
    public.is_platform_admin()
    or (v_account.context_type in ('club', 'tournament') and public.is_org_admin(v_account.org_id))
    or (v_account.context_type = 'tournament' and v_account.tournament_id is not null
        and public.has_tournament_permission('manage_tournament_finances', v_account.tournament_id))
  ) then
    raise exception 'not authorized to change this account''s payment QR' using errcode = 'insufficient_privilege';
  end if;

  if v_key is not null and v_key not like p_account_id::text || '/qr-%' then
    raise exception 'that image does not belong to this account' using errcode = 'check_violation';
  end if;

  update public.billing_accounts set qr_storage_key = v_key, updated_at = now() where id = p_account_id;

  perform public.write_audit_system(
    v_account.org_id, 'billing.qr.updated', v_account.context_type,
    coalesce(v_account.club_id, v_account.tournament_id), 'billing_account', p_account_id::text,
    jsonb_build_object('qr_storage_key', v_account.qr_storage_key),
    jsonb_build_object('qr_storage_key', v_key)
  );
end
$$;
revoke all on function public.set_billing_account_qr(uuid, text) from public, anon;
grant execute on function public.set_billing_account_qr(uuid, text) to authenticated, service_role;
