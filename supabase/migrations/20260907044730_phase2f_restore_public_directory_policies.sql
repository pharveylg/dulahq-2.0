-- Fix: phase 2e's policy rebuild dropped the anon-facing directory policies that
-- 2d created. Without these the public directory is dark and the whole guest-first
-- entry flow cannot work. Re-created here, after the rebuild, so ordering is settled.

drop policy if exists "public read published tournaments" on public.tournaments;
create policy "public read published tournaments"
  on public.tournaments for select to anon, authenticated
  using (publicly_listed = true);

drop policy if exists "public read listed clubs" on public.clubs;
create policy "public read listed clubs"
  on public.clubs for select to anon, authenticated
  using (publicly_listed = true);

-- The directory needs the categories of a published tournament too.
drop policy if exists tc_public_read on public.tournament_categories;
create policy tc_public_read on public.tournament_categories for select to anon, authenticated
  using (exists (select 1 from public.tournaments t
                 where t.id = tournament_categories.tournament_id
                   and t.publicly_listed = true));

grant select on public.tournaments, public.clubs, public.tournament_categories,
                public.matches, public.organizations, public.sports to anon;;