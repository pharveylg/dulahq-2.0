-- Companion to phase6s: lets the RLS suite assert the invariant instead of
-- trusting a one-time revoke to hold. Deliberately NOT security definer --
-- pg_proc is world-readable, it needs no elevation, and staying invoker
-- keeps it out of the very set it counts.
create or replace function public.anon_executable_secdef_count()
returns integer
language sql stable set search_path = public as $$
  select count(*)::int
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prokind = 'f'
    and p.prosecdef
    and has_function_privilege('anon', p.oid, 'execute');
$$;

revoke all on function public.anon_executable_secdef_count() from public;
revoke all on function public.anon_executable_secdef_count() from anon;
grant execute on function public.anon_executable_secdef_count() to authenticated;
grant execute on function public.anon_executable_secdef_count() to service_role;
