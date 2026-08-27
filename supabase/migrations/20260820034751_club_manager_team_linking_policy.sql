-- APPLIED to the shared Dula HQ Supabase project as migration version
-- 20260820034751. Mirror of what was actually run -- surfaced while
-- building the Club Manager app itself: club_admin had no way to link
-- an existing team to their club under the original RLS.
--
-- Allows a club_admin to link an UNCLAIMED existing team (club_id is
-- currently null) to their own club. Deliberately does NOT allow
-- re-linking a team that already belongs to another club -- that would
-- let one club_admin hijack another club's team. Unlinking (setting
-- club_id back to null) or transferring a claimed team is intentionally
-- left out of scope here; add a separate, more careful policy if that's
-- ever needed.
create policy "club_admin can link unclaimed teams to their club"
  on teams for update
  using (club_id is null)
  with check (is_club_admin(club_id));
