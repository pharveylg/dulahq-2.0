-- Tier 0 (CLAUDE.md §0g). phase2g revoked EXECUTE on every SECURITY DEFINER
-- helper from anon; §0a records that it "regressed since, cause not
-- identified". It is still regressed -- 25 of 46 were anon-executable when
-- this was written -- and the cause is simply that EXECUTE defaults to
-- PUBLIC on function creation, so anything created (or dropped and
-- recreated) after phase2g silently reopens. A one-time revoke would
-- therefore regress a third time; the matching regression test in
-- tests/rls is the actual fix.
--
-- What was exposed, worst first:
--   * expire_stale_approvals() and recompute_fee_status(uuid) are MUTATING
--     and were callable unauthenticated over REST. Bounded (each writes only
--     the value it would have computed anyway) but an anonymous caller
--     should not be able to trigger writes at all.
--   * requires_guardian_consent(), roster_consent_granted(),
--     approval_is_granted() answer questions about minors to anyone holding
--     a player UUID. Not enumerable -- RLS blocks listing players -- but §8
--     singles out minors' data for exactly this kind of care.
--   * The rest are predicates that return false for anon, plus four trigger
--     functions that should never be called directly.
--
-- Revoking from PUBLIC is the operative step: anon inherits PUBLIC, so
-- "revoke from anon" alone does nothing while PUBLIC still holds EXECUTE.
-- That in turn means authenticated/service_role need their grants restored
-- explicitly, which is what the loop does. Verified beforehand that no
-- anon-facing policy calls any of these (0 matches), so this costs nothing
-- at the public surface -- the same finding phase2g recorded.
do $$
declare
  fn record;
begin
  for fn in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f' and p.prosecdef
  loop
    execute format('revoke all on function %s from public', fn.sig);
    execute format('revoke all on function %s from anon', fn.sig);
    execute format('grant execute on function %s to authenticated', fn.sig);
    execute format('grant execute on function %s to service_role', fn.sig);
  end loop;
end $$;
