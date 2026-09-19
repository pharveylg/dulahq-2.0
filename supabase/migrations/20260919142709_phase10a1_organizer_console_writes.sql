-- Writes, keyed on the tournament permission catalog (not org_admin alone).
-- Each check also pins the row to the tournament's own org so a permission
-- held on one tournament can't be used to write a row claiming another org.
drop policy if exists tc_organizer_write on public.tournament_categories;
create policy tc_organizer_write on public.tournament_categories for all to authenticated
using (public.has_tournament_permission('manage_competition', tournament_id))
with check (
  public.has_tournament_permission('manage_competition', tournament_id)
  and org_id = (select t.org_id from public.tournaments t where t.id = tournament_id)
);

-- Insert only, and only as 'pending': acceptance has to go through
-- decide_tournament_entry, which is the audited path. A direct insert with
-- status='accepted' would bypass that and, for club-backed entries, the
-- automatic invite of the team_manager contact.
drop policy if exists te_organizer_insert on public.tournament_entries;
create policy te_organizer_insert on public.tournament_entries for insert to authenticated
with check (
  public.has_tournament_permission('manage_tournament', tournament_id)
  and status = 'pending'
  and host_org_id = (select t.org_id from public.tournaments t where t.id = tournament_id)
  and (
    category_id is null
    or exists (
      select 1 from public.tournament_categories c
      where c.id = category_id and c.tournament_id = tournament_entries.tournament_id
    )
  )
);

-- tec_write let anyone passing can_read_tournament write contacts with no
-- check on which org the row claimed. Contacts are how an outside person
-- later gains entry-scoped access, so writing them needs manage_tournament
-- (or org admin), and org_id must be the entry's own host org.
drop policy if exists tec_write on public.tournament_entry_contacts;
create policy tec_write on public.tournament_entry_contacts for all to authenticated
using (
  public.is_org_admin(org_id)
  or public.has_tournament_permission('manage_tournament',
       (select te.tournament_id from public.tournament_entries te where te.id = entry_id))
)
with check (
  org_id = (select te.host_org_id from public.tournament_entries te where te.id = entry_id)
  and (
    public.is_org_admin(org_id)
    or public.has_tournament_permission('manage_tournament',
         (select te.tournament_id from public.tournament_entries te where te.id = entry_id))
  )
);
