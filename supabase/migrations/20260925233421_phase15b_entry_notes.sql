-- Team coordinator: notes and flags on a tournament entry.
--
-- review_tournament_entry (held by team_coordinator and organizer) was seeded in phase8
-- and consumed by nothing. A note is internal commentary; a flag is a note the organizer
-- needs to look at, and stays open until resolved. Reviewing is not deciding: acceptance
-- still needs decide_tournament_entry (organizer only).
--
-- Entrants never see these. Reads are for review holders and org admins; every write goes
-- through the two functions below (no INSERT/UPDATE/DELETE policy exists), so an author
-- cannot edit or delete what they wrote.

create table if not exists public.tournament_entry_notes (
  id            uuid primary key default gen_random_uuid(),
  entry_id      uuid not null references public.tournament_entries(id) on delete cascade,
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  org_id        uuid not null references public.organizations(id) on delete cascade,
  kind          text not null check (kind in ('note', 'flag')),
  body          text not null check (length(btrim(body)) > 0),
  resolved_at   timestamptz,
  resolved_by   uuid references public.users(id) on delete set null,
  created_by    uuid references public.users(id) on delete set null,
  created_at    timestamptz not null default now()
);
create index if not exists tournament_entry_notes_entry_idx on public.tournament_entry_notes (entry_id, created_at desc);
alter table public.tournament_entry_notes enable row level security;
revoke all on public.tournament_entry_notes from anon;
revoke insert, update, delete, truncate on public.tournament_entry_notes from authenticated;

create policy tournament_entry_notes_read on public.tournament_entry_notes for select to authenticated
using (public.is_org_admin(org_id) or public.has_tournament_permission('review_tournament_entry', tournament_id));

-- The org-suspension fence every org_id table carries (phase9a).
create policy org_not_suspended on public.tournament_entry_notes as restrictive for all to authenticated
using (public.org_access_allowed(org_id)) with check (public.org_access_allowed(org_id));

create or replace function public.add_entry_note(p_entry_id uuid, p_kind text, p_body text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare v_entry public.tournament_entries%rowtype; v_id uuid;
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
  insert into public.tournament_entry_notes (entry_id, tournament_id, org_id, kind, body, created_by)
  values (p_entry_id, v_entry.tournament_id, v_entry.host_org_id, p_kind, btrim(p_body), auth.uid())
  returning id into v_id;
  perform public.write_audit_system(v_entry.host_org_id,
    case when p_kind = 'flag' then 'tournament.entry.flagged' else 'tournament.entry.noted' end,
    'tournament', v_entry.tournament_id, 'tournament_entry_note', v_id::text, null,
    jsonb_build_object('entry_id', p_entry_id, 'team_name', v_entry.team_name));
  return v_id;
end $$;

-- A flag is closed by the organizer (or org admin) who acts on it, or by whoever raised it.
create or replace function public.resolve_entry_note(p_note_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare n public.tournament_entry_notes%rowtype;
begin
  select * into n from public.tournament_entry_notes where id = p_note_id;
  if not found then raise exception 'note not found' using errcode = 'no_data_found'; end if;
  if not (public.is_org_admin(n.org_id)
          or public.has_tournament_permission('decide_tournament_entry', n.tournament_id)
          or (n.created_by = auth.uid() and public.has_tournament_permission('review_tournament_entry', n.tournament_id))) then
    raise exception 'you cannot resolve this' using errcode = 'insufficient_privilege';
  end if;
  update public.tournament_entry_notes set resolved_at = now(), resolved_by = auth.uid()
   where id = p_note_id and resolved_at is null;
  if found then
    perform public.write_audit_system(n.org_id, 'tournament.entry.note_resolved', 'tournament', n.tournament_id,
      'tournament_entry_note', p_note_id::text, null, jsonb_build_object('entry_id', n.entry_id, 'kind', n.kind));
  end if;
end $$;

-- The coordinator needs to reach the team they are reviewing.
drop policy if exists tec_read on public.tournament_entry_contacts;
create policy tec_read on public.tournament_entry_contacts for select using (
  public.can_read_tournament(org_id, (select te.tournament_id from public.tournament_entries te where te.id = tournament_entry_contacts.entry_id))
  or public.has_tournament_permission('review_tournament_entry', (select te.tournament_id from public.tournament_entries te where te.id = tournament_entry_contacts.entry_id))
  or (account_status = any (array['invited', 'active']) and lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')))
  or user_id = auth.uid()
);

revoke all on function public.add_entry_note(uuid, text, text) from public, anon;
revoke all on function public.resolve_entry_note(uuid) from public, anon;
grant execute on function public.add_entry_note(uuid, text, text) to authenticated, service_role;
grant execute on function public.resolve_entry_note(uuid) to authenticated, service_role;
