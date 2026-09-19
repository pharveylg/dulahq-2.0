-- A RESTRICTIVE policy is ANDed with every permissive policy on the table, so
-- it fences direct-table access without rewriting 60+ existing policies.
-- (SECURITY DEFINER RPCs bypass RLS as the table owner; those are covered by
-- the helper guards in phase9a1-3, which every RPC authorizes through.)
do $$
declare t text;
begin
  for t in
    select cl.relname::text
    from pg_attribute a
    join pg_class cl on cl.oid = a.attrelid
    join pg_namespace n on n.oid = cl.relnamespace
    where n.nspname = 'public' and cl.relkind = 'r'
      and a.attname = 'org_id' and not a.attisdropped
      and not public.org_fence_exempt(cl.relname::text)
  loop
    execute format('drop policy if exists org_not_suspended on public.%I', t);
    execute format(
      'create policy org_not_suspended on public.%I as restrictive for all to authenticated using (public.org_access_allowed(org_id)) with check (public.org_access_allowed(org_id))',
      t);
  end loop;
end $$;

-- The RLS suite calls this and fails if a new org_id table slips in unfenced.
create or replace function public.org_tables_missing_suspension_fence()
returns setof text
language sql stable set search_path = public as $$
  select cl.relname::text
  from pg_attribute a
  join pg_class cl on cl.oid = a.attrelid
  join pg_namespace n on n.oid = cl.relnamespace
  where n.nspname = 'public' and cl.relkind = 'r'
    and a.attname = 'org_id' and not a.attisdropped
    and not public.org_fence_exempt(cl.relname::text)
    and not exists (select 1 from pg_policy p where p.polrelid = cl.oid and p.polname = 'org_not_suspended')
  order by 1;
$$;

revoke all on function public.org_tables_missing_suspension_fence() from public, anon, authenticated;
grant execute on function public.org_tables_missing_suspension_fence() to service_role;
