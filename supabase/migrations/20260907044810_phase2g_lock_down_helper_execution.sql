-- No anon-facing policy calls a function (they all test a published flag or a
-- plain column), so anon has no reason to hold EXECUTE on any SECURITY DEFINER
-- helper. Revoking closes the /rest/v1/rpc surface without touching RLS.

create or replace function public.age_on(p_dob date, p_on date default current_date)
returns integer language sql immutable set search_path = public as $$
  select case when p_dob is null then null
              else extract(year from age(p_on, p_dob))::int end;
$$;

do $mig$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef
  loop
    execute format('revoke all on function %s from anon', f.sig);
  end loop;
end $mig$;;