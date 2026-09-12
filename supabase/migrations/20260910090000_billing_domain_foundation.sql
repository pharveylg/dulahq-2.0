-- Billing domain foundation (B0)
--
-- This migration deliberately models billing without integrating a payment
-- provider. Platform, Club, and Tournament charges share these primitives but
-- remain explicitly separated by billing_context_type.
--
-- Initial payment mode: manual_qr / simulation. A submitted payment is not a
-- verified payment. Provider integrations and automatic suspension are later
-- phases.

create table if not exists public.billing_accounts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  context_type text not null check (context_type in ('platform','club','tournament')),
  club_id uuid references public.clubs(id) on delete cascade,
  tournament_id uuid references public.tournaments(id) on delete cascade,
  display_name text not null,
  currency text not null default 'PHP' check (currency ~ '^[A-Z]{3}$'),
  qr_storage_key text,
  payment_instructions text,
  status text not null default 'active' check (status in ('active','suspended','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint billing_accounts_context_shape check (
    (context_type = 'platform' and club_id is null and tournament_id is null)
    or (context_type = 'club' and club_id is not null and tournament_id is null)
    or (context_type = 'tournament' and club_id is null and tournament_id is not null)
  )
);

create unique index if not exists billing_accounts_platform_org_uidx
  on public.billing_accounts(org_id) where context_type = 'platform';
create unique index if not exists billing_accounts_club_uidx
  on public.billing_accounts(club_id) where context_type = 'club';
create unique index if not exists billing_accounts_tournament_uidx
  on public.billing_accounts(tournament_id) where context_type = 'tournament';
create index if not exists billing_accounts_org_idx on public.billing_accounts(org_id);

create table if not exists public.billing_invoices (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  billing_account_id uuid not null references public.billing_accounts(id) on delete restrict,
  invoice_number text not null unique,
  context_type text not null check (context_type in ('platform','club','tournament')),
  payer_type text not null check (payer_type in ('organization','family','guardian','player','club','team','entrant')),
  payer_user_id uuid references auth.users(id) on delete set null,
  payer_org_id uuid references public.organizations(id) on delete set null,
  payer_label text,
  source_type text,
  source_id text,
  currency text not null default 'PHP' check (currency ~ '^[A-Z]{3}$'),
  subtotal numeric(12,2) not null default 0 check (subtotal >= 0),
  discount_total numeric(12,2) not null default 0 check (discount_total >= 0),
  credit_total numeric(12,2) not null default 0 check (credit_total >= 0),
  total numeric(12,2) not null default 0 check (total >= 0),
  amount_paid numeric(12,2) not null default 0 check (amount_paid >= 0),
  status text not null default 'draft'
    check (status in ('draft','issued','awaiting_payment','submitted_for_verification','partially_paid','paid','rejected','overdue','waived','refunded','cancelled')),
  due_at timestamptz,
  issued_at timestamptz,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists billing_invoices_org_status_idx
  on public.billing_invoices(org_id, status, created_at desc);
create index if not exists billing_invoices_payer_user_idx
  on public.billing_invoices(payer_user_id, created_at desc);
create index if not exists billing_invoices_payer_org_idx
  on public.billing_invoices(payer_org_id, created_at desc);
create index if not exists billing_invoices_source_idx
  on public.billing_invoices(source_type, source_id);

create table if not exists public.billing_invoice_lines (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.billing_invoices(id) on delete cascade,
  description text not null,
  source_type text,
  source_id text,
  quantity numeric(12,3) not null default 1 check (quantity >= 0),
  unit_amount numeric(12,2) not null default 0 check (unit_amount >= 0),
  line_total numeric(12,2) not null default 0 check (line_total >= 0),
  created_at timestamptz not null default now()
);

create index if not exists billing_invoice_lines_invoice_idx
  on public.billing_invoice_lines(invoice_id);

create table if not exists public.billing_payment_submissions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  invoice_id uuid not null references public.billing_invoices(id) on delete restrict,
  payer_user_id uuid references auth.users(id) on delete set null,
  amount numeric(12,2) not null check (amount > 0),
  currency text not null default 'PHP' check (currency ~ '^[A-Z]{3}$'),
  method text not null default 'qr_transfer'
    check (method in ('qr_transfer','bank_transfer','cash','other')),
  reference_number text,
  proof_storage_key text,
  payer_note text,
  status text not null default 'submitted'
    check (status in ('submitted','under_review','verified','rejected','cancelled')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewer_note text,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create index if not exists billing_payment_submissions_invoice_idx
  on public.billing_payment_submissions(invoice_id, submitted_at desc);
create index if not exists billing_payment_submissions_org_status_idx
  on public.billing_payment_submissions(org_id, status, submitted_at desc);

create table if not exists public.billing_payment_allocations (
  id uuid primary key default gen_random_uuid(),
  payment_submission_id uuid not null references public.billing_payment_submissions(id) on delete cascade,
  invoice_id uuid not null references public.billing_invoices(id) on delete restrict,
  amount numeric(12,2) not null check (amount > 0),
  created_at timestamptz not null default now()
);

create table if not exists public.billing_usage_meters (
  key text primary key,
  product text not null check (product in ('platform','club','tournament','shared')),
  label text not null,
  unit text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.billing_usage_meters(key, product, label, unit) values
  ('active_clubs_monthly', 'club', 'Active clubs', 'club'),
  ('active_teams_monthly', 'shared', 'Active teams', 'team'),
  ('active_players_monthly', 'club', 'Active players', 'player'),
  ('active_staff_seats_monthly', 'shared', 'Active staff seats', 'seat'),
  ('active_tournaments_monthly', 'tournament', 'Active tournaments', 'tournament'),
  ('tournament_entries_monthly', 'tournament', 'Tournament entries', 'entry'),
  ('storage_gb_monthly', 'shared', 'Storage', 'GB')
on conflict (key) do nothing;

create table if not exists public.billing_usage_events (
  id bigint generated always as identity primary key,
  org_id uuid not null references public.organizations(id) on delete cascade,
  meter_key text not null references public.billing_usage_meters(key) on delete restrict,
  context_type text not null check (context_type in ('platform','club','tournament','shared')),
  context_id uuid,
  quantity numeric(12,3) not null check (quantity >= 0),
  source_type text,
  source_id text,
  occurred_at timestamptz not null default now(),
  idempotency_key text not null unique,
  created_at timestamptz not null default now()
);

create index if not exists billing_usage_events_org_meter_time_idx
  on public.billing_usage_events(org_id, meter_key, occurred_at desc);

create table if not exists public.billing_usage_periods (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  meter_key text not null references public.billing_usage_meters(key) on delete restrict,
  period_start date not null,
  period_end date not null,
  quantity numeric(12,3) not null default 0 check (quantity >= 0),
  status text not null default 'open' check (status in ('open','projected','locked','corrected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(org_id, meter_key, period_start, period_end),
  check (period_end >= period_start)
);

-- Initial authorization: Platform Admin can administer all billing contexts;
-- organization-level members can see their own org's records; the named payer
-- can see their own invoice/submission. Product-specific staff narrowing is
-- added with the corresponding Club/Tournament billing UI and policies.
alter table public.billing_accounts enable row level security;
alter table public.billing_invoices enable row level security;
alter table public.billing_invoice_lines enable row level security;
alter table public.billing_payment_submissions enable row level security;
alter table public.billing_payment_allocations enable row level security;
alter table public.billing_usage_meters enable row level security;
alter table public.billing_usage_events enable row level security;
alter table public.billing_usage_periods enable row level security;

create policy billing_accounts_read on public.billing_accounts
  for select to authenticated
  using (public.is_platform_admin() or public.is_org_member(org_id));

create policy billing_invoices_read on public.billing_invoices
  for select to authenticated
  using (
    public.is_platform_admin()
    or payer_user_id = auth.uid()
    or (payer_org_id is not null and public.is_org_member(payer_org_id))
    or public.is_org_member(org_id)
  );

create policy billing_invoice_lines_read on public.billing_invoice_lines
  for select to authenticated
  using (exists (
    select 1 from public.billing_invoices i
    where i.id = invoice_id
      and (
        public.is_platform_admin()
        or i.payer_user_id = auth.uid()
        or (i.payer_org_id is not null and public.is_org_member(i.payer_org_id))
        or public.is_org_member(i.org_id)
      )
  ));

create policy billing_payment_submissions_read on public.billing_payment_submissions
  for select to authenticated
  using (
    public.is_platform_admin()
    or payer_user_id = auth.uid()
    or public.is_org_member(org_id)
  );

create policy billing_payment_allocations_read on public.billing_payment_allocations
  for select to authenticated
  using (exists (
    select 1 from public.billing_invoices i
    where i.id = invoice_id
      and (public.is_platform_admin() or public.is_org_member(i.org_id) or i.payer_user_id = auth.uid())
  ));

create policy billing_usage_meters_read on public.billing_usage_meters
  for select to authenticated
  using (true);

create policy billing_usage_events_read on public.billing_usage_events
  for select to authenticated
  using (public.is_platform_admin() or public.is_org_member(org_id));

create policy billing_usage_periods_read on public.billing_usage_periods
  for select to authenticated
  using (public.is_platform_admin() or public.is_org_member(org_id));

-- Writes are intentionally restricted to SECURITY DEFINER actions in the next
-- implementation phase. No direct client INSERT/UPDATE/DELETE policies are
-- granted by this foundation migration.

revoke all on public.billing_accounts from anon, authenticated;
revoke all on public.billing_invoices from anon, authenticated;
revoke all on public.billing_invoice_lines from anon, authenticated;
revoke all on public.billing_payment_submissions from anon, authenticated;
revoke all on public.billing_payment_allocations from anon, authenticated;
revoke all on public.billing_usage_meters from anon, authenticated;
revoke all on public.billing_usage_events from anon, authenticated;
revoke all on public.billing_usage_periods from anon, authenticated;

grant select on public.billing_accounts to authenticated;
grant select on public.billing_invoices to authenticated;
grant select on public.billing_invoice_lines to authenticated;
grant select on public.billing_payment_submissions to authenticated;
grant select on public.billing_payment_allocations to authenticated;
grant select on public.billing_usage_meters to authenticated;
grant select on public.billing_usage_events to authenticated;
grant select on public.billing_usage_periods to authenticated;
EOF

git add supabase/migrations/20260910090000_billing_domain_foundation.sql docs/billing-domain-design.md docs/platform-implementation-roadmap.md && git commit -m "Add billing domain foundation migration" && git status --short && git log -2 --oneline
npm run build >/tmp/dulahq-build.log 2>&1; code=$?; tail -30 /tmp/dulahq-build.log; exit $code
  
