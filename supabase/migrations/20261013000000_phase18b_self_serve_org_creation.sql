-- Phase 1 of docs/proposals/self-serve-org-onboarding.md: self-serve organization
-- creation, trial-only. No product entitlement is granted here -- that's Phase 2.
--
-- is_org_admin() only has a bootstrap path for a platform admin (its own final
-- `or is_platform_admin()` clause). A self-serve creator has no such status, so a
-- brand-new org with zero org_members rows has nobody who can pass org_members_write
-- to insert themselves as its first admin -- the same chicken-and-egg problem this
-- project solved for club_manager (phase6k) and tournament organizer (phase8).
-- One atomic SECURITY DEFINER function creates the org, its first admin, and the
-- 24-hour shell deadline together, so a failure partway rolls back the whole thing
-- (a single plpgsql function body is one transaction) -- the review's own "atomic
-- and safe to retry" requirement for a customer-facing create operation.

create table if not exists public.org_onboarding_shells (
  org_id uuid primary key references public.organizations(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
alter table public.org_onboarding_shells enable row level security;
revoke all on public.org_onboarding_shells from anon, public;
grant select on public.org_onboarding_shells to authenticated;
create policy org_onboarding_shells_read on public.org_onboarding_shells for select to authenticated
  using (public.is_org_member(org_id));
create policy org_not_suspended on public.org_onboarding_shells as restrictive for all to authenticated
  using (public.org_access_allowed(org_id));
-- No insert/update/delete policy for any client role -- only the functions below
-- (owner-privileged) and the service role touch this table.

create or replace function public.create_self_serve_organization(p_name text, p_slug text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_org_id uuid;
  v_email text;
  v_name text := btrim(coalesce(p_name, ''));
  v_slug text := lower(btrim(coalesce(p_slug, '')));
  v_expires timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  v_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  if v_email = '' then
    raise exception 'A verified email is required to create an organization' using errcode = '42501';
  end if;
  if length(v_name) < 2 then
    raise exception 'Organization name must be at least 2 characters' using errcode = '22023';
  end if;
  if v_slug !~ '^[a-z0-9-]{2,}$' then
    raise exception 'Slug must be lowercase letters, numbers and hyphens, at least 2 characters'
      using errcode = '22023';
  end if;

  insert into public.organizations (slug, name, status) values (v_slug, v_name, 'active')
  returning id into v_org_id;

  insert into public.org_members (org_id, email, user_id, role)
  values (v_org_id, v_email, auth.uid(), 'admin');

  v_expires := now() + interval '24 hours';
  insert into public.org_onboarding_shells (org_id, expires_at) values (v_org_id, v_expires);

  perform public.write_audit_system(v_org_id, 'org.self_serve.created', null, null,
    'organization', v_org_id::text, null, jsonb_build_object('name', v_name, 'slug', v_slug));

  return jsonb_build_object('orgId', v_org_id, 'slug', v_slug, 'shellExpiresAt', v_expires);
exception
  when unique_violation then
    raise exception 'That org slug is already registered -- pick another' using errcode = '23505';
end $$;
revoke all on function public.create_self_serve_organization(text, text) from public, anon;
grant execute on function public.create_self_serve_organization(text, text) to authenticated, service_role;

-- The unchecked cron-callable twin, same split this project always uses
-- (write_audit/write_audit_system, §0p; the usage-metering functions, §0za) --
-- pg_cron carries no JWT, so a function requiring auth.uid() can never be called
-- by the scheduled job. Deletes only a shell with ZERO product entitlements, so a
-- shell that became a real trial (Phase 2) or paid org is never touched here even
-- if its own shell row hasn't been cleared yet -- belt and suspenders against any
-- ordering bug between this job and Phase 2's trial-start path.
create or replace function public.expire_onboarding_shells_system()
returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_ids uuid[];
  v_org record;
begin
  select coalesce(array_agg(s.org_id), '{}') into v_ids
  from public.org_onboarding_shells s
  where s.expires_at < now()
    and not exists (select 1 from public.org_entitlements e where e.org_id = s.org_id);

  if array_length(v_ids, 1) is not null then
    for v_org in select id, slug, name from public.organizations where id = any(v_ids) loop
      perform public.write_audit_system(null, 'org.onboarding_shell.expired', null, null,
        'organization', v_org.id::text, jsonb_build_object('name', v_org.name, 'slug', v_org.slug), null);
    end loop;
    delete from public.organizations where id = any(v_ids);
  end if;

  return coalesce(array_length(v_ids, 1), 0);
end $$;
revoke all on function public.expire_onboarding_shells_system() from public, anon, authenticated;
grant execute on function public.expire_onboarding_shells_system() to service_role;

select cron.schedule('expire-onboarding-shells', '37 * * * *', $$select public.expire_onboarding_shells_system();$$);
