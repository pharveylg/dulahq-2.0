-- Phase 6e: Web Push subscription storage, for the notification system's
-- push channel (Phase 5a of the coach/player/guardian rework, see
-- CLAUDE.md §0c). A subscription belongs to whoever is signed in on that
-- device (auth.uid()) -- not to a guardian or player specifically, since
-- the same account might be one or the other depending on context, and a
-- browser subscription is inherently per-device anyway.

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  endpoint text not null,
  p256dh text not null,
  auth_key text not null,
  created_at timestamptz not null default now(),
  unique (endpoint)
);
comment on table public.push_subscriptions is 'One row per browser/device push subscription. endpoint is globally unique (re-subscribing the same device upserts rather than duplicating).';

alter table public.push_subscriptions enable row level security;

create policy "push_subscriptions: self only"
  on public.push_subscriptions for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

revoke all on public.push_subscriptions from anon;

-- The actual push send happens from Node (web-push, VAPID-signed HTTPS to
-- the browser's push service) -- Postgres can't do that itself, so the
-- raw subscription secrets (p256dh/auth) have to cross back out to the
-- calling server action at some point. Deliberately NOT a blanket
-- "fetch anyone's keys" function: the caller must themselves be a member
-- of p_org_id (same trust boundary notifications' own INSERT policy
-- already uses), and the target user must have some actual relationship
-- to that org -- guardian, player, staff, or org admin. Without this, a
-- malicious org member could harvest an unrelated stranger's push
-- endpoint/keys and spam them directly via the Web Push protocol,
-- bypassing this app's own notify() logic entirely.
create or replace function public.push_subscription_targets(p_org_id uuid, p_user_id uuid)
returns table(endpoint text, p256dh text, auth_key text)
language sql
stable
security definer
set search_path = public
as $$
  select ps.endpoint, ps.p256dh, ps.auth_key
  from public.push_subscriptions ps
  where ps.user_id = p_user_id
    and public.is_org_member(p_org_id)
    and (
      exists (select 1 from public.guardians g where g.user_id = p_user_id and g.org_id = p_org_id)
      or exists (select 1 from public.players p where p.user_id = p_user_id and p.org_id = p_org_id)
      or exists (select 1 from public.club_staff cs where cs.user_id = p_user_id and cs.org_id = p_org_id)
      or exists (select 1 from public.org_members om where om.user_id = p_user_id and om.org_id = p_org_id)
    );
$$;
comment on function public.push_subscription_targets is 'Returns push subscription secrets for p_user_id, only to a caller who is themselves an org_id member, and only when the target has a real relationship (guardian/player/staff/org admin) to that same org.';

revoke all on function public.push_subscription_targets(uuid, uuid) from public, anon;
grant execute on function public.push_subscription_targets(uuid, uuid) to authenticated;

-- One subscription per device, upserted from the client each time it
-- (re)subscribes -- a SECURITY DEFINER wrapper because a device's very
-- first subscribe happens before the endpoint row exists, so the RLS
-- self-only policy above is enough for reads/updates but this keeps the
-- insert-or-update logic in one place rather than duplicated per caller.
create or replace function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth_key text)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth_key)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth_key)
  on conflict (endpoint) do update
    set user_id = excluded.user_id, p256dh = excluded.p256dh, auth_key = excluded.auth_key;
$$;
comment on function public.save_push_subscription is 'Upserts the calling user''s push subscription for this device (keyed on endpoint, which is unique per browser install).';

revoke all on function public.save_push_subscription(text, text, text) from public, anon;
grant execute on function public.save_push_subscription(text, text, text) to authenticated;
