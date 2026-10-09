-- Phase 4 of docs/proposals/self-serve-org-onboarding.md: trial expiry and a
-- read-only/export grace period. Two decisions confirmed with the user first
-- (2026-10-09): 30-day grace period, and deletion after it stays a MANUAL step --
-- no scheduled job deletes anything. This migration never deletes an organization.
--
-- Known, deliberate limit, same honesty this project's history keeps elsewhere:
-- "read-only" here means new top-level creation stops (clubs/teams/tournaments/
-- entries already check org_has_product() since Phase 2, so an expired entitlement
-- already blocks those with zero extra code). It does NOT yet block every write to
-- an EXISTING resource (renaming a club, adding a player, recording a fee) -- doing
-- that properly is a real RLS sweep across many tables, flagged as its own
-- follow-up rather than quietly only half-building it under this phase's name.

alter table public.org_entitlements add column if not exists grace_until timestamptz;
alter table public.trial_policy add column if not exists grace_days integer not null default 30;

-- Reuses the existing 'suspended' status rather than adding a new one -- the same
-- value org_entitlements already uses for Platform Admin's own suspend action, and
-- it already means exactly "not active, not deleted" everywhere org_has_product()
-- is checked.
create or replace function public.expire_product_trials_system()
returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_grace_days integer;
  v_row record;
  v_count integer := 0;
begin
  select coalesce(grace_days, 30) into v_grace_days from public.trial_policy where id = true;

  for v_row in
    select e.org_id, e.product, o.name as org_name, o.slug as org_slug
    from public.org_entitlements e
    join public.organizations o on o.id = e.org_id
    where e.status = 'trial' and e.valid_until is not null and e.valid_until < now()
  loop
    update public.org_entitlements
       set status = 'suspended', grace_until = now() + (v_grace_days || ' days')::interval, updated_at = now()
     where org_id = v_row.org_id and product = v_row.product;

    perform public.write_audit_system(v_row.org_id, 'org.trial.expired', null, null,
      'org_entitlement', v_row.product, null,
      jsonb_build_object('product', v_row.product, 'grace_days', v_grace_days));

    -- One notification per real admin login -- a club_staff-style invited-but-
    -- never-signed-in row has no user_id yet and is skipped, same guard
    -- notifyAboutPlayer()/notifyStaff() already use elsewhere in this project.
    insert into public.notifications (org_id, recipient_user_id, channel, template, payload, link_path)
    select v_row.org_id, m.user_id, 'in_app', 'org.trial.expired',
           jsonb_build_object('orgName', v_row.org_name, 'product', v_row.product, 'graceDays', v_grace_days),
           '/organizations/' || v_row.org_slug
    from public.org_members m
    where m.org_id = v_row.org_id and m.role = 'admin' and m.user_id is not null;

    v_count := v_count + 1;
  end loop;

  return v_count;
end $$;
revoke all on function public.expire_product_trials_system() from public, anon, authenticated;
grant execute on function public.expire_product_trials_system() to service_role;

select cron.schedule('expire-product-trials', '47 * * * *', $$select public.expire_product_trials_system();$$);

-- Visibility only -- per the "manual for now" decision, nothing purges an org on
-- its own. This is how Platform Admin finds out an org is actually eligible;
-- deleting one is still the existing platform_delete_organization(), unchanged.
create or replace function public.orgs_past_grace_period()
returns table(org_id uuid, org_name text, org_slug text, product text, grace_until timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Platform admin only' using errcode = '42501';
  end if;
  return query
    select e.org_id, o.name, o.slug, e.product, e.grace_until
    from public.org_entitlements e
    join public.organizations o on o.id = e.org_id
    where e.status = 'suspended' and e.grace_until is not null and e.grace_until < now()
    order by e.grace_until;
end $$;
revoke all on function public.orgs_past_grace_period() from public, anon;
grant execute on function public.orgs_past_grace_period() to authenticated, service_role;
