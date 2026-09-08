-- Same class of bug as phase6f: sendPush() (src/lib/notify.ts) runs in the
-- notifying staff member's own request context, not the subscription
-- owner's -- push_subscriptions' self-only RLS ("user_id = auth.uid()")
-- would silently block cleanup of a dead (410/404) endpoint reported by
-- the push service for someone else's device. Endpoint values only ever
-- reach this function via push_subscription_targets()'s own output inside
-- sendPush(), never from client input, so no extra authorization check is
-- needed beyond "some authenticated app request triggered this".
create or replace function public.delete_stale_push_subscription(p_endpoint text)
returns void
language sql security definer set search_path = public as $$
  delete from public.push_subscriptions where endpoint = p_endpoint;
$$;

revoke all on function public.delete_stale_push_subscription(text) from public;
revoke all on function public.delete_stale_push_subscription(text) from anon;
grant execute on function public.delete_stale_push_subscription(text) to authenticated;
