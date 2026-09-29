-- anon_executable_secdef_count() is NOT security definer, so it runs as its caller --
-- granting EXECUTE on anon_executable_secdef_allowlist() to service_role only meant any
-- ordinary authenticated caller (the RLS test's own club admin, or any real app code)
-- got refused with 42501 just for calling the counter. The allowlist itself is not
-- sensitive (it only names which one function is a deliberate anon exception); grant it
-- to authenticated too so the counter actually works for the callers who need it.
revoke all on function public.anon_executable_secdef_allowlist() from public, anon;
grant execute on function public.anon_executable_secdef_allowlist() to authenticated, service_role;
