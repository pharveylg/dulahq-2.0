# Dula HQ billing domain design

Status: design baseline — no payment provider and no production migration yet.

## Billing contexts

Dula HQ has three distinct financial contexts sharing one implementation:

| Context | Payer | Recipient | Owner |
|---|---|---|---|
| Platform | Organization | Dula HQ | Platform Admin |
| Club | Family, guardian, player | Club | Club Manager / Treasurer |
| Tournament | Team, club, entrant, organization | Tournament organizer | Tournament finance staff |

An invoice must never be inferred from the context of the current route alone. Each billable record carries an explicit `billing_context_type`, payer, recipient, and source reference.

## Initial payment mode

The first implementation uses manual QR payment:

```text
invoice issued → QR/instructions → external payment → proof/reference submitted → authorized reviewer verifies → payment allocated → receipt/status updated
```

The initial mode is intentionally not automated:

```text
BILLING_MODE=simulation|manual
PAYMENT_MODE=manual_qr
AUTOMATED_PAYMENTS_ENABLED=false
AUTOMATED_SUSPENSION_ENABLED=false
```

Payment proof submission does not equal verified payment. Only an authorized reviewer can mark a payment verified.

## Shared concepts

The eventual schema needs these concepts, with implementation names subject to migration review:

- billing accounts;
- payer/recipient profiles;
- invoices and invoice lines;
- charges and allocations;
- payment submissions;
- credits and refunds;
- manual adjustments;
- usage meters and period summaries;
- audit events.

Every line should retain `source_type` and `source_id`, such as `subscription`, `player_membership`, `training_program`, `tournament_entry`, `trip`, or `event`.

## Access boundaries

- Platform Admin can view all contexts, with auditable support access and separate financial permissions.
- Club finance staff can view and verify only their club's invoices and payments.
- Tournament finance staff can view and verify only their tournament/entry invoices and payments.
- Guardians can view only their family/player invoices and submissions.
- Teams/entrants can view only their own tournament invoices and submissions.
- No payer can verify their own payment.

## Billing and operational status

Financial status and operational status are separate. A product may configure whether an unpaid amount warns, blocks, or has no operational effect. During validation, payment status does not automatically suspend entitlements.

## Implementation order

1. Shared billing primitives and audit contract.
2. Club family/player billing.
3. Tournament team/entrant billing.
4. Platform organization billing and usage.
5. Cross-context Platform Admin reporting and reconciliation.
6. Automated provider adapter, only after customer validation.

## Approval required before migration

Before adding tables or policies, approve:

- initial status vocabulary;
- payer/recipient relationships;
- first usage meters;
- who can verify each context;
- QR configuration model;
- invoice terminology;
- whether club/tournament operational policies may block workflows.
