-- clubs and tournaments each carried TWO anon/authenticated "listed" SELECT policies under
-- different names. phase13a rewrote one of each to add "and not listing_blocked", but the
-- older twin stayed, and permissive policies OR together, so a blocked row was still
-- readable straight from the table. Caught by the anon direct-read test. The rewritten
-- policies express exactly the same rule plus the block.
drop policy if exists "public read listed clubs" on public.clubs;
drop policy if exists "public read published tournaments" on public.tournaments;
