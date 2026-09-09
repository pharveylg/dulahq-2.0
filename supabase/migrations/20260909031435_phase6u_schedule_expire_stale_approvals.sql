-- Tier 0 (CLAUDE.md §0g). §5 has said since the approvals were built:
-- "Schedule expire_stale_approvals(); until it runs, approval_is_granted()
-- still refuses anything not explicitly approved." Nothing ever scheduled
-- it, which was harmless while no roster workflow existed -- Phase C made it
-- live, so guardian requests now accumulate past their 14-day expires_at and
-- sit as 'awaiting' forever, misreporting the roster state as "Awaiting
-- guardians" long after the deadline passed.
--
-- The safety property was never affected: approval_is_granted() only ever
-- returns true on an explicit 'approved', so an unswept stale row could
-- never let a minor through. This is a reporting-accuracy fix.
create extension if not exists pg_cron with schema pg_catalog;

-- Hourly is plenty for a 14-day deadline and keeps the job cheap.
select cron.schedule(
  'expire-stale-approvals',
  '7 * * * *',
  $$select public.expire_stale_approvals();$$
);
