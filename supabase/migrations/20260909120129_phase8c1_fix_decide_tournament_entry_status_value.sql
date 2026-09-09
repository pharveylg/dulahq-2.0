-- tournament_entries.status's real vocabulary is pending/accepted/declined/
-- withdrawn (its own CHECK constraint, phase3_free_the_player) -- not
-- 'rejected'. Caught by the check constraint itself on first real test
-- rather than guessed correctly the first time.
create or replace function public.decide_tournament_entry(p_entry_id uuid, p_status text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_entry public.tournament_entries%rowtype;
begin
  if p_status not in ('accepted', 'declined') then
    raise exception 'status must be accepted or declined' using errcode = 'check_violation';
  end if;

  select * into v_entry from public.tournament_entries where id = p_entry_id;
  if not found then
    raise exception 'entry % not found', p_entry_id using errcode = 'no_data_found';
  end if;

  if not (
    public.has_tournament_permission('decide_tournament_entry', v_entry.tournament_id)
    or public.is_org_admin(v_entry.host_org_id)
  ) then
    raise exception 'not authorised to decide this entry' using errcode = 'insufficient_privilege';
  end if;

  update public.tournament_entries set status = p_status where id = p_entry_id;

  perform public.write_audit(v_entry.host_org_id,
    case when p_status = 'accepted' then 'tournament_entry.accepted' else 'tournament_entry.declined' end,
    'tournament', v_entry.tournament_id, 'tournament_entry', p_entry_id::text,
    jsonb_build_object('status', v_entry.status), jsonb_build_object('status', p_status));
end $$;
