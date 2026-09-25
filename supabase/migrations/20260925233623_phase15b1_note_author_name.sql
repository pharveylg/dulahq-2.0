-- Other staff cannot read public.users, so the author's name is recorded with the note
-- rather than looked up when it is shown.
alter table public.tournament_entry_notes add column if not exists author_name text;

create or replace function public.add_entry_note(p_entry_id uuid, p_kind text, p_body text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare v_entry public.tournament_entries%rowtype; v_id uuid; v_name text;
begin
  if p_kind not in ('note', 'flag') then
    raise exception 'kind must be note or flag' using errcode = 'check_violation';
  end if;
  if p_body is null or length(btrim(p_body)) = 0 then
    raise exception 'write something first' using errcode = 'check_violation';
  end if;
  select * into v_entry from public.tournament_entries where id = p_entry_id;
  if not found then raise exception 'entry not found' using errcode = 'no_data_found'; end if;
  if not (public.is_org_admin(v_entry.host_org_id) or public.has_tournament_permission('review_tournament_entry', v_entry.tournament_id)) then
    raise exception 'you cannot review entries in this tournament' using errcode = 'insufficient_privilege';
  end if;
  select coalesce(nullif(btrim(name), ''), email) into v_name from public.users where id = auth.uid();
  insert into public.tournament_entry_notes (entry_id, tournament_id, org_id, kind, body, created_by, author_name)
  values (p_entry_id, v_entry.tournament_id, v_entry.host_org_id, p_kind, btrim(p_body), auth.uid(), v_name)
  returning id into v_id;
  perform public.write_audit_system(v_entry.host_org_id,
    case when p_kind = 'flag' then 'tournament.entry.flagged' else 'tournament.entry.noted' end,
    'tournament', v_entry.tournament_id, 'tournament_entry_note', v_id::text, null,
    jsonb_build_object('entry_id', p_entry_id, 'team_name', v_entry.team_name));
  return v_id;
end $$;

revoke all on function public.add_entry_note(uuid, text, text) from public, anon;
grant execute on function public.add_entry_note(uuid, text, text) to authenticated, service_role;
