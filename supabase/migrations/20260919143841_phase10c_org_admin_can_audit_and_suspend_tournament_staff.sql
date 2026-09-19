-- Found driving the organizer console as an org admin: the Staff tab's audit
-- trail was empty and its Suspend button would have errored. An org admin can
-- already read the raw audit_log for their org and already writes
-- tournament_staff directly (tournament_staff_write -> can_admin_tournament
-- includes is_org_admin), so these two RPCs refusing them added no protection,
-- only a console that disagreed with the table policies. Same is_org_admin
-- path every other tournament policy already keeps.
create or replace function public.tournament_audit_log(p_tournament_id uuid)
returns table (id bigint, ts timestamptz, actor_email text, action text, entity_type text, entity_id text, before jsonb, after jsonb)
language sql stable security definer set search_path = public as $$
  select a.id, a.ts, a.actor_email, a.action, a.entity_type, a.entity_id, a.before, a.after
  from public.audit_log a
  where a.scope_type = 'tournament'
    and a.scope_id = p_tournament_id
    and (
      public.has_tournament_permission('view_audit_log', p_tournament_id)
      or exists (select 1 from public.tournaments t where t.id = p_tournament_id and public.is_org_admin(t.org_id))
    )
  order by a.ts desc
  limit 50;
$$;

create or replace function public.set_tournament_staff_account_status(p_tournament_id uuid, p_target_user_id uuid, p_status text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_tournament public.tournaments%rowtype;
  v_current text;
begin
  if p_status not in ('active', 'suspended') then
    raise exception 'status must be active or suspended' using errcode = 'check_violation';
  end if;
  if p_target_user_id = auth.uid() then
    raise exception 'cannot change your own account status' using errcode = 'insufficient_privilege';
  end if;

  select * into v_tournament from public.tournaments where id = p_tournament_id;
  if not found then
    raise exception 'tournament not found' using errcode = 'no_data_found';
  end if;

  if not (public.has_tournament_permission('manage_account_status', p_tournament_id)
          or public.is_org_admin(v_tournament.org_id)) then
    raise exception 'not authorised to change account status at this tournament'
      using errcode = 'insufficient_privilege';
  end if;

  select status into v_current from public.tournament_staff
   where tournament_id = p_tournament_id and user_id = p_target_user_id;
  if v_current is null then
    raise exception 'that person is not staff at this tournament' using errcode = 'no_data_found';
  end if;
  if v_current = 'archived' then
    raise exception 'that person has been removed from the tournament -- re-add them to restore access'
      using errcode = 'check_violation';
  end if;
  if v_current = p_status then
    raise exception 'already %', p_status using errcode = 'check_violation';
  end if;

  update public.tournament_staff set status = p_status
   where tournament_id = p_tournament_id and user_id = p_target_user_id;

  perform public.write_audit(v_tournament.org_id,
    case when p_status = 'suspended' then 'tournament_staff.suspended' else 'tournament_staff.reactivated' end,
    'tournament', p_tournament_id, 'tournament_staff', p_target_user_id::text,
    jsonb_build_object('status', v_current), jsonb_build_object('status', p_status));
end $$;
