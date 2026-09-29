-- Caught by the existing phase9a4 guard test, not by inspection: every
-- org_id-carrying table needs the org_not_suspended RESTRICTIVE policy or
-- org_tables_missing_suspension_fence() flags it. org_storage_events
-- (phase16e) was missing it -- a suspended org could otherwise still have
-- uploads metered.
create policy org_not_suspended on public.org_storage_events as restrictive for all to authenticated
using (public.org_access_allowed(org_id));
