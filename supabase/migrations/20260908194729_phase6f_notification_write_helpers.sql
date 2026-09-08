-- Staff creating a notification for someone else (a guardian, a player)
-- can never satisfy notifications_read_own (recipient-only, or org_admin)
-- -- so `insert(...).select()` (which requires a RETURNING-equivalent
-- SELECT-policy pass) silently rolls the whole insert back for any
-- non-org_admin staff member. Same problem on the sent_at/failed_reason
-- update afterwards: notifications_mark_read is recipient-only. Two
-- SECURITY DEFINER helpers, same escape-hatch pattern as write_audit() --
-- authorize with is_org_member(), then do the write as the function
-- owner so no RETURNING/UPDATE ever needs to satisfy a recipient-only
-- policy.

create or replace function public.create_notification(
  p_org_id uuid,
  p_recipient_user_id uuid,
  p_recipient_guardian_id uuid,
  p_channel text,
  p_template text,
  p_payload jsonb,
  p_link_path text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if not public.is_org_member(p_org_id) then
    raise exception 'not a member of this organization';
  end if;

  insert into public.notifications (org_id, recipient_user_id, recipient_guardian_id, channel, template, payload, link_path)
  values (p_org_id, p_recipient_user_id, p_recipient_guardian_id, p_channel, p_template, p_payload, p_link_path)
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.create_notification(uuid,uuid,uuid,text,text,jsonb,text) from public;
revoke all on function public.create_notification(uuid,uuid,uuid,text,text,jsonb,text) from anon;
grant execute on function public.create_notification(uuid,uuid,uuid,text,text,jsonb,text) to authenticated;

create or replace function public.mark_notification_sent(p_notification_id uuid, p_failed_reason text default null)
returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.notifications
     set sent_at = case when p_failed_reason is null then now() else sent_at end,
         failed_reason = p_failed_reason
   where id = p_notification_id
     and public.is_org_member(org_id);
end;
$$;

revoke all on function public.mark_notification_sent(uuid,text) from public;
revoke all on function public.mark_notification_sent(uuid,text) from anon;
grant execute on function public.mark_notification_sent(uuid,text) to authenticated;
