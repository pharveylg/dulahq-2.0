-- Close the anon exposure on public.backups.
-- backups has no org_id yet, so tenant scoping is deferred to the org_id rollout.
-- For now: signed-in users only; the anon key (which ships in both browsers) gets nothing.

alter table public.backups enable row level security;

drop policy if exists backups_authenticated_all on public.backups;

create policy backups_authenticated_all
  on public.backups
  for all
  to authenticated
  using (true)
  with check (true);

revoke all on public.backups from anon;;