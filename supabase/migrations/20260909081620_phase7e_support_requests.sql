-- P1-10 (docs/club-entitlement-gap-analysis.md §12): "no ticket/support-
-- request table, no status field, no escalation path... more than simply
-- an email address." Genuinely a shared platform capability, not
-- Club-specific -- keyed on org_id alone (no club_id anywhere in this
-- schema), so a Tournament-only org needs zero changes to use the exact
-- same path once that entitlement exists. impersonation_sessions is a
-- related but distinct mechanism (a logged inspection session) and is
-- deliberately not stretched into a support ticket here.
create table if not exists public.support_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in ('account_access', 'billing', 'bug', 'data', 'feature_request', 'other')),
  subject text not null,
  body text not null,
  status text not null default 'open' check (status in ('open', 'in_progress', 'waiting_on_org', 'resolved', 'closed')),
  affected_entity_type text,
  affected_entity_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.support_request_messages (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.support_requests(id) on delete cascade,
  author_user_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

alter table public.support_requests enable row level security;
alter table public.support_request_messages enable row level security;

insert into public.permissions (key, category, scope, label, description)
values ('submit_support_request', 'staff', 'club', 'Submit support request',
        'Escalate an issue to the Dula HQ platform team on behalf of the organization')
on conflict (key) do nothing;

insert into public.role_permission_defaults (role, permission_key)
values ('club_manager', 'submit_support_request'),
       ('club_it_admin', 'submit_support_request')
on conflict do nothing;

-- Read/write is "created it", "platform admin", or "holds
-- submit_support_request at some club in this org" -- the last clause is
-- the only nontrivial one: support_requests has no club_id of its own
-- (deliberately, since a club-less Tournament org must be able to use this
-- identically), so eligibility is evaluated by checking every club the
-- caller actually staffs in that org, reusing has_staff_permission per
-- candidate club rather than inventing an org-level variant of it.
create policy support_requests_read on public.support_requests for select to authenticated
using (
  created_by = auth.uid()
  or public.is_platform_admin()
  or exists (
    select 1 from public.club_staff cs join public.clubs c on c.id = cs.club_id
    where c.org_id = support_requests.org_id and cs.user_id = auth.uid() and cs.status = 'active'
      and public.has_staff_permission('submit_support_request', cs.club_id)
  )
);

create policy support_requests_insert on public.support_requests for insert to authenticated
with check (
  created_by = auth.uid()
  and (
    public.is_org_admin(org_id)
    or exists (
      select 1 from public.club_staff cs join public.clubs c on c.id = cs.club_id
      where c.org_id = support_requests.org_id and cs.user_id = auth.uid() and cs.status = 'active'
        and public.has_staff_permission('submit_support_request', cs.club_id)
    )
  )
);

-- Status/updated_at are platform-owned once filed -- the org side follows
-- up via messages, not by editing the ticket itself.
create policy support_requests_platform_write on public.support_requests for update to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

create policy support_request_messages_read on public.support_request_messages for select to authenticated
using (exists (select 1 from public.support_requests sr where sr.id = request_id));

create policy support_request_messages_insert on public.support_request_messages for insert to authenticated
with check (
  author_user_id = auth.uid()
  and exists (select 1 from public.support_requests sr where sr.id = request_id)
);
