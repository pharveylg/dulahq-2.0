-- Restrict invoice creation to the financial owner of each context and
-- validate that the billing account belongs to the requested product scope.

create or replace function public.create_billing_invoice(
  p_org_id uuid,
  p_billing_account_id uuid,
  p_context_type text,
  p_payer_type text,
  p_payer_user_id uuid default null,
  p_payer_org_id uuid default null,
  p_payer_label text default null,
  p_source_type text default null,
  p_source_id text default null,
  p_currency text default 'PHP',
  p_due_at timestamptz default null,
  p_notes text default null,
  p_lines jsonb default '[]'::jsonb
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_invoice_id uuid;
  v_invoice_number text;
  v_subtotal numeric(12,2);
  v_line jsonb;
  v_account public.billing_accounts%rowtype;
begin
  if auth.uid() is null then raise exception 'not signed in' using errcode = 'insufficient_privilege'; end if;
  select * into v_account from public.billing_accounts where id = p_billing_account_id;
  if not found then raise exception 'billing account not found' using errcode = 'no_data_found'; end if;
  if v_account.org_id <> p_org_id or v_account.context_type <> p_context_type then
    raise exception 'billing account does not match the requested context' using errcode = 'check_violation';
  end if;

  if p_context_type = 'platform' then
    if not public.is_platform_admin() then raise exception 'only a platform admin can create a platform invoice' using errcode = 'insufficient_privilege'; end if;
  elsif p_context_type = 'club' then
    if v_account.club_id is null or not public.has_staff_permission('manage_finances', v_account.club_id, null) then
      raise exception 'club finance permission required' using errcode = 'insufficient_privilege';
    end if;
  elsif p_context_type = 'tournament' then
    if not public.is_org_admin(p_org_id) then raise exception 'tournament organization admin required' using errcode = 'insufficient_privilege'; end if;
  else
    raise exception 'invalid billing context' using errcode = 'check_violation';
  end if;

  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'at least one invoice line is required' using errcode = 'check_violation';
  end if;

  v_invoice_number := 'DULA-' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISS') || '-' || upper(substr(gen_random_uuid()::text, 1, 8));
  insert into public.billing_invoices (
    org_id, billing_account_id, invoice_number, context_type,
    payer_type, payer_user_id, payer_org_id, payer_label,
    source_type, source_id, currency, due_at, notes, created_by
  ) values (
    p_org_id, p_billing_account_id, v_invoice_number, p_context_type,
    p_payer_type, p_payer_user_id, p_payer_org_id, p_payer_label,
    p_source_type, p_source_id, p_currency, p_due_at, p_notes, auth.uid()
  ) returning id into v_invoice_id;

  for v_line in select * from jsonb_array_elements(p_lines) loop
    insert into public.billing_invoice_lines (
      invoice_id, description, source_type, source_id, quantity, unit_amount, line_total
    ) values (
      v_invoice_id,
      coalesce(v_line->>'description', 'Charge'),
      v_line->>'source_type', v_line->>'source_id',
      greatest(coalesce((v_line->>'quantity')::numeric, 1), 0),
      greatest(coalesce((v_line->>'unit_amount')::numeric, 0), 0),
      greatest(coalesce((v_line->>'quantity')::numeric, 1), 0)
        * greatest(coalesce((v_line->>'unit_amount')::numeric, 0), 0)
    );
  end loop;

  select coalesce(sum(line_total), 0)::numeric(12,2) into v_subtotal
    from public.billing_invoice_lines where invoice_id = v_invoice_id;
  update public.billing_invoices
     set subtotal = v_subtotal, total = v_subtotal, status = 'issued', issued_at = now(), updated_at = now()
   where id = v_invoice_id;

  perform public.write_audit(
    p_org_id, 'billing.invoice.created', p_context_type,
    case when p_context_type = 'club' then v_account.club_id
         when p_context_type = 'tournament' then v_account.tournament_id
         else null end,
    'billing_invoice', v_invoice_id::text, null,
    jsonb_build_object('invoice_number', v_invoice_number, 'context_type', p_context_type, 'total', v_subtotal)
  );
  return v_invoice_id;
end $$;

revoke all on function public.create_billing_invoice(uuid,uuid,text,text,uuid,uuid,text,text,text,text,timestamptz,text,jsonb) from public, anon;
grant execute on function public.create_billing_invoice(uuid,uuid,text,text,uuid,uuid,text,text,text,text,timestamptz,text,jsonb) to authenticated;
