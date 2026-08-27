-- Phase 1.1: Row Level Security
--
-- COPIED FROM the `dula-hq` repo's 0002_rls_policies.sql. See the note
-- at the top of 0001_foundation.sql about keeping these in sync.

create or replace function is_tenant_member(check_tenant_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from tenant_users
    where tenant_id = check_tenant_id
      and user_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------
-- tenants
-- ---------------------------------------------------------------------
alter table tenants enable row level security;

create policy "tenant members can view their tenant"
  on tenants for select
  using (is_tenant_member(id));

-- ---------------------------------------------------------------------
-- tenant_users
-- ---------------------------------------------------------------------
alter table tenant_users enable row level security;

create policy "tenant members can view tenant membership"
  on tenant_users for select
  using (is_tenant_member(tenant_id));

-- ---------------------------------------------------------------------
-- organizations
-- ---------------------------------------------------------------------
alter table organizations enable row level security;

create policy "tenant members can view organizations"
  on organizations for select
  using (is_tenant_member(tenant_id));

create policy "tenant members can insert organizations"
  on organizations for insert
  with check (is_tenant_member(tenant_id));

create policy "tenant members can update organizations"
  on organizations for update
  using (is_tenant_member(tenant_id))
  with check (is_tenant_member(tenant_id));

-- ---------------------------------------------------------------------
-- sports: shared reference data, readable by everyone.
-- ---------------------------------------------------------------------
alter table sports enable row level security;

create policy "anyone can view sports"
  on sports for select
  using (true);

-- ---------------------------------------------------------------------
-- audit_logs
-- ---------------------------------------------------------------------
alter table audit_logs enable row level security;

create policy "tenant members can view audit logs"
  on audit_logs for select
  using (is_tenant_member(tenant_id));

create policy "tenant members can insert audit logs"
  on audit_logs for insert
  with check (is_tenant_member(tenant_id));
