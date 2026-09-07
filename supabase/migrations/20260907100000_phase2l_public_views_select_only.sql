-- public_clubs and public_tournaments both join clubs/tournaments to
-- organizations, so Postgres already refuses direct UPDATE/DELETE/INSERT
-- against them regardless of grants (confirmed: all three rejected at the
-- planner level as `anon`, "Views that do not select from a single table
-- or view are not automatically updatable"). Not currently exploitable,
-- but anon/authenticated held INSERT/UPDATE/DELETE/TRUNCATE grants on both
-- views anyway -- found while building the public directory pages (§6.C).
-- Tightened to least-privilege so a future INSTEAD OF trigger (or a
-- Postgres behavior change) doesn't turn a dormant over-grant into a real
-- hole.
revoke insert, update, delete, truncate, references, trigger
  on public.public_clubs, public.public_tournaments
  from anon, authenticated;
