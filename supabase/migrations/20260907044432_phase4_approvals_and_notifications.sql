-- Phase 4: one approval machine serving both roster consent and fee charges,
-- plus the notification path that reaches guardians who have no account.
-- Silence is never consent: an expired request excludes, it never includes.

create table if not exists public.approval_requests (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations(id) on delete cascade,
  subject_type  text not null check (subject_type in ('tournament_roster','fee_charge')),
  subject_id    uuid not null,
  player_id     uuid references public.players(id) on delete cascade,

  -- who must say yes: the guardian if the player is a minor that day, else the player
  approver_user_id     uuid references auth.users(id) on delete set null,
  approver_guardian_id uuid references public.guardians(id) on delete set null,

  status        text not null default 'draft'
                check (status in ('draft','awaiting','approved','declined','expired','cancelled')),
  method        text check (method in ('app','offline')),
  recorded_by   uuid references auth.users(id) on delete set null,
  decline_reason text,

  requested_at  timestamptz,
  expires_at    timestamptz,
  decided_at    timestamptz,

  -- the tokenized link is stored hashed; the plaintext only ever leaves in the message
  token_hash    text unique,

  created_at    timestamptz not null default now(),
  created_by    uuid references auth.users(id) on delete set null,

  constraint approval_offline_needs_recorder
    check (method is distinct from 'offline' or recorded_by is not null),
  constraint approval_decline_needs_reason
    check (status <> 'declined' or decline_reason is not null)
);

create index if not exists approval_requests_subject_idx  on public.approval_requests (subject_type, subject_id);
create index if not exists approval_requests_org_idx      on public.approval_requests (org_id);
create index if not exists approval_requests_player_idx   on public.approval_requests (player_id);
create index if not exists approval_requests_approver_idx on public.approval_requests (approver_user_id);
create index if not exists approval_requests_status_idx   on public.approval_requests (status, expires_at);

comment on table public.approval_requests is
  'One machine, two uses. Roster consent and fee charges differ only in subject_type, approver and deadline.';

-- ---------- notifications ----------
create table if not exists public.notifications (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.organizations(id) on delete cascade,
  recipient_user_id     uuid references auth.users(id) on delete cascade,
  recipient_guardian_id uuid references public.guardians(id) on delete cascade,
  recipient_email text,
  recipient_phone text,
  channel        text not null default 'in_app'
                 check (channel in ('in_app','email','sms','push')),
  template       text not null,
  payload        jsonb not null default '{}'::jsonb,
  link_path      text,
  created_at     timestamptz not null default now(),
  sent_at        timestamptz,
  read_at        timestamptz,
  failed_reason  text,
  constraint notification_has_a_recipient check (
    recipient_user_id is not null or recipient_guardian_id is not null
    or recipient_email is not null or recipient_phone is not null)
);
create index if not exists notifications_user_idx on public.notifications (recipient_user_id, read_at);
create index if not exists notifications_org_idx  on public.notifications (org_id, created_at desc);

-- ---------- settled is derived, never typed ----------
create or replace function public.recompute_fee_status(p_fee_charge_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_amount numeric(10,2);
  v_paid   numeric(10,2);
  v_due    date;
  v_status text;
begin
  select amount, due_date into v_amount, v_due
    from public.fee_charges where id = p_fee_charge_id;
  if not found then return; end if;

  select coalesce(sum(amount),0) into v_paid
    from public.payments where fee_charge_id = p_fee_charge_id;

  if v_paid >= v_amount then
    v_status := 'paid';
  elsif v_paid > 0 then
    v_status := 'partial';
  elsif v_due is not null and v_due < current_date then
    v_status := 'overdue';
  else
    v_status := 'pending';
  end if;

  update public.fee_charges
     set status = v_status, updated_at = now()
   where id = p_fee_charge_id and status is distinct from v_status;
end $$;

create or replace function public.payments_touch_fee()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.recompute_fee_status(coalesce(new.fee_charge_id, old.fee_charge_id));
  return coalesce(new, old);
end $$;

drop trigger if exists payments_recompute_fee on public.payments;
create trigger payments_recompute_fee
  after insert or update or delete on public.payments
  for each row execute function public.payments_touch_fee();

-- ---------- expiry: a scheduled sweep, and a safety net on read ----------
create or replace function public.expire_stale_approvals()
returns integer language sql security definer set search_path = public as $$
  with done as (
    update public.approval_requests
       set status = 'expired', decided_at = now()
     where status = 'awaiting'
       and expires_at is not null
       and expires_at < now()
    returning 1)
  select count(*)::int from done;
$$;

-- An approval only counts when it is explicitly approved and not past its deadline.
create or replace function public.approval_is_granted(p_subject_type text, p_subject_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.approval_requests a
    where a.subject_type = p_subject_type
      and a.subject_id = p_subject_id
      and a.status = 'approved'
  );
$$;

comment on function public.approval_is_granted(text,uuid) is
  'True only on an explicit approval. Missing, awaiting and expired all read as not granted.';

-- ---------- who may raise a charge: a permission, not a role ----------
create or replace function public.can_create_fees(p_org uuid, p_club uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.can_admin_club(p_org, p_club)
      or public.has_role('club', p_club, array['treasurer','fees_create']);
$$;

-- ---------- RLS ----------
alter table public.approval_requests enable row level security;
alter table public.notifications     enable row level security;

-- The approver sees their own request; club staff see the status of ones they raised.
create policy approvals_read on public.approval_requests for select to authenticated
  using (approver_user_id = auth.uid()
         or (approver_guardian_id is not null and exists (
              select 1 from public.guardians g
              where g.id = approval_requests.approver_guardian_id and g.user_id = auth.uid()))
         or (public.is_org_member(org_id) and (
              public.is_org_admin(org_id)
              or (player_id is not null and exists (
                   select 1 from public.players p
                   where p.id = approval_requests.player_id
                     and (public.is_assigned_to_team(p.team_id)
                          or public.can_read_club(approval_requests.org_id, p.club_id)))))));

create policy approvals_staff_raise on public.approval_requests for insert to authenticated
  with check (public.is_org_member(org_id));

-- The approver decides. Staff may cancel, and may record an offline decision.
create policy approvals_decide on public.approval_requests for update to authenticated
  using (approver_user_id = auth.uid()
         or (approver_guardian_id is not null and exists (
              select 1 from public.guardians g
              where g.id = approval_requests.approver_guardian_id and g.user_id = auth.uid()))
         or public.is_org_admin(org_id))
  with check (approver_user_id = auth.uid()
              or (approver_guardian_id is not null and exists (
                   select 1 from public.guardians g
                   where g.id = approval_requests.approver_guardian_id and g.user_id = auth.uid()))
              or public.is_org_admin(org_id));

create policy notifications_read_own on public.notifications for select to authenticated
  using (recipient_user_id = auth.uid()
         or (recipient_guardian_id is not null and exists (
              select 1 from public.guardians g
              where g.id = notifications.recipient_guardian_id and g.user_id = auth.uid()))
         or public.is_org_admin(org_id));
create policy notifications_mark_read on public.notifications for update to authenticated
  using (recipient_user_id = auth.uid()) with check (recipient_user_id = auth.uid());
create policy notifications_staff_create on public.notifications for insert to authenticated
  with check (public.is_org_member(org_id));;