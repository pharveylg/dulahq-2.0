# Dula HQ implementation handoff

This workspace contains the local implementation of the Platform, Club, and manual billing foundation. It has not been pushed to GitHub and no Supabase migration has been applied from this workspace.

## What is included

- Platform Admin billing tab at `/platformconsole?tab=billing`;
- platform invoices and payment submissions;
- Club billing-domain invoice visibility;
- Guardian Billing tab with manual payment submission;
- shared Platform/Club/Tournament billing schema;
- usage meters and idempotent usage events;
- historical usage-period snapshots;
- versioned plans and meter allowances;
- manual QR/payment instructions;
- payment verification and reviewer scope;
- Tournament billing integration contract;
- unit tests for invoice calculations;
- migration verification SQL.

## Before applying migrations

Review these migrations in order:

```text
20260910090000_billing_domain_foundation.sql
20260910093000_billing_manual_workflows.sql
20260910094000_billing_account_provisioning.sql
20260910100000_billing_context_provisioning.sql
20260910103000_billing_payment_instructions.sql
20260910110000_billing_reviewer_scope.sql
20260910113000_billing_creator_scope.sql
20260910120000_billing_usage_recording.sql
20260910123000_billing_usage_periods.sql
20260910130000_billing_plans_and_rates.sql
20260910133000_billing_subscription_provisioning.sql
20260910140000_billing_default_plan_meters.sql
20260910143000_billing_platform_backfill.sql
```

These are the files that must be applied to Supabase after the project is pushed. They create and modify live database objects. Do not delete or reorder them.

## Migration application

Use the repository's normal Supabase migration process, or apply the files through the Supabase SQL editor in timestamp order. Apply them first in a non-production/validation project if available.

After application, run:

```text
scripts/verify-billing-domain.sql
```

Confirm:

- all billing tables exist;
- all billing tables have RLS enabled;
- existing clubs have billing accounts;
- existing tournaments have billing accounts;
- default plans and plan meters exist;
- subscription provisioning functions exist;
- manual billing RPCs are executable only by authenticated callers.

## Runtime configuration

For validation mode:

```env
BILLING_MODE=simulation
PAYMENT_MODE=manual_qr
AUTOMATED_PAYMENTS_ENABLED=false
AUTOMATED_SUSPENSION_ENABLED=false
EMAIL_DELIVERY_MODE=deferred
```

No payment provider credentials are required.

## Migration caveat

The application build can pass before the billing migrations are applied because the new billing queries use the shared billing table names through controlled adapters. The billing screens will not work against Supabase until the migrations are applied.

Apply the migrations before:

- provisioning new organizations;
- opening Platform Admin Billing;
- submitting Guardian payments;
- creating billing-domain invoices;
- recording usage events;
- creating validation subscriptions.

## Local checks before pushing

```bash
npm ci
npm run test:unit
npm run build
```

Expected current result:

```text
20 unit tests passed
production build passed
```

## Push sequence

From the replaced local copy:

```bash
git status
git log --oneline -10
git remote -v
git push origin main
```

If the local branch differs from the repository default branch, push the current branch and open a pull request instead.

## Supabase access after push

The Supabase service-role key must not be committed or pasted into source files. Configure it locally or in a secure deployment environment only.

The first live approval required after pushing is the migration approval. Do not treat a successful Next.js build as proof that the database migrations have been applied.

## Payment provider status

No automated payment provider is connected. Manual QR/payment instructions are the intended validation flow.

The future provider should be added behind the existing boundary:

```text
ManualQrPaymentProvider
→ AutomatedPaymentProvider
```
