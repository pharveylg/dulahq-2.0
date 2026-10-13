# Tournament billing integration contract

Status: the contract below is live, and this repo's own native organizer
console (`/tm/...`) is the consumer — not the frozen Tournament Manager
engine (the separate `dula-hq` repo), which has no billing UI and isn't
expected to grow one. Payment provider still deferred (manual QR only).

This document defines the shared Supabase billing contract so any future
Tournament-facing surface — this repo's console, or in principle the frozen
engine — can consume it without importing Club Manager internals.

## Billing context

Every tournament invoice uses:

```text
context_type = 'tournament'
```

The payer may be:

```text
team
entrant
club
organization
```

The recipient is the tournament organizer represented by the tournament's organization.

## Tournament billing account

Each tournament receives a billing account automatically when the tournament is created after the billing migrations are applied.

```sql
select id, display_name, currency, payment_instructions, qr_storage_key
from billing_accounts
where context_type = 'tournament'
  and tournament_id = :tournament_id;
```

The organizer may configure `payment_instructions` and `qr_storage_key` through a future tournament finance settings screen. No payment provider is required.

## Creating an entry invoice

Use the shared RPC rather than inserting invoice rows directly:

```ts
const { data: invoiceId, error } = await supabase.rpc('create_billing_invoice', {
  p_org_id: tournamentOrgId,
  p_billing_account_id: tournamentBillingAccountId,
  p_context_type: 'tournament',
  p_payer_type: 'team',
  p_payer_user_id: teamContactUserId ?? null,
  p_payer_org_id: entrantOrgId ?? null,
  p_payer_label: teamName,
  p_source_type: 'tournament_entry',
  p_source_id: entryId,
  p_currency: 'PHP',
  p_due_at: deadline,
  p_notes: null,
  p_lines: [
    {
      description: `${categoryName} registration fee`,
      quantity: 1,
      unit_amount: entryFee,
      source_type: 'tournament_entry',
      source_id: entryId,
    },
  ],
});
```

The RPC calculates the subtotal and total, issues a unique invoice number, and writes a billing audit event.

## Submitting manual payment

The payer submits an externally completed payment:

```ts
const { data: submissionId, error } = await supabase.rpc('submit_billing_payment', {
  p_invoice_id: invoiceId,
  p_amount: amount,
  p_method: 'qr_transfer',
  p_reference_number: referenceNumber,
  p_proof_storage_key: proofStorageKey ?? null,
  p_payer_note: note ?? null,
});
```

A submission changes the invoice to:

```text
submitted_for_verification
```

It does not mark the invoice as paid.

## Reviewing payment

Authorized tournament finance staff or Platform Admin can verify or reject the submission:

```ts
await supabase.rpc('review_billing_payment', {
  p_payment_id: paymentSubmissionId,
  p_status: 'verified',
  p_reviewer_note: 'Confirmed against bank transfer reference',
});
```

Valid review statuses:

```text
verified
rejected
cancelled
```

Verification creates a payment allocation and updates the invoice to:

```text
paid
```

or:

```text
partially_paid
```

## Entry workflow policy

Financial status and entry status remain separate.

Recommended initial behavior:

```text
Invoice issued
→ entry remains pending payment
→ payment submitted
→ entry remains pending verification
→ payment verified
→ organizer may accept/confirm entry
```

Do not make payment verification automatically change an entry to accepted until the Tournament product explicitly adopts that policy.

## Tournament-facing screens

Built in this repo's own organizer console and entrant portal (not the
Tournament Manager engine — see CLAUDE.md §0q and §15a):

1. **Tournament finance settings** — payment instructions and QR
   configuration are editable by the organizer/treasurer or an org admin
   (`update_billing_account_instructions`). **Not built:** a currency
   selector (every invoice reads `currency` off the row, defaulting to
   `PHP` — there's no screen to set it per tournament) or a dedicated
   finance-staff-permissions screen (staff instead get the existing
   `manage_tournament_finances`/`view_tournament_finances` permission keys
   through the Staff tab, which doesn't need its own screen).
2. **Entry billing view** — built as the entrant portal (`/entry/<id>`):
   invoice number, charges, due date, payment status, payment instructions,
   and proof/reference submission are all there.
3. **Organizer finance queue** — built (the console's Finance tab):
   submitted payments waiting for verification, verify/reject with a
   reviewer note, and summary tiles (billed/collected/outstanding/to
   verify). **Not built:** a dedicated payment-history view or an
   outstanding-entries list beyond what the tiles and invoice list already
   show.
4. **Tournament finance reports** — **not built.** The Finance tab's tiles
   are a live summary, not a report; there's no breakdown by category or
   entrant, and no refund/credit workflow at all — `issue_tournament_credit`
   and `approve_tournament_refund` were two of the six permission keys this
   document originally proposed and explicitly decided not to add (see
   "Authorization boundary" below), so there's no permission to gate a
   refund screen on yet either.

## Authorization boundary

Tournament billing must not reuse Club billing permissions by name. It uses the **tournament permission catalog that already exists** (phase8b) — this document originally proposed six new keys (`view_tournament_finance`, `manage_entry_invoices`, `verify_tournament_payment`, `issue_tournament_credit`, `approve_tournament_refund`, `export_tournament_financial_reports`), but none were ever added, and adding them would have created a second tournament permission vocabulary alongside the two already live and already granted to real roles:

```text
manage_tournament_finances   -- organizer, treasurer
view_tournament_finances     -- organizer, treasurer
```

As of `phase9c`, creating an entry invoice (`create_billing_invoice`) and verifying a payment (`can_review_billing_invoice`) both accept `manage_tournament_finances` on that tournament, with `is_org_admin` kept as a second path. Reads (`can_read_billing_account`) accept either key. A single key covering create + verify is deliberately coarse: split it into finer keys (e.g. separating "verify payment" from "create invoice" for segregation of duties, or gating refunds/credits) only when a screen actually needs the distinction — and then extend the existing catalog rather than starting a parallel one.

Platform Admin has cross-context diagnostic and financial visibility, but every mutation remains audited.

## Payment provider boundary

The Tournament Manager must call the shared manual workflow now. It must not create provider-specific code in the tournament engine.

Future provider integration should replace the payment adapter only:

```text
ManualQrPaymentProvider
→ AutomatedPaymentProvider
```

Invoices, lines, payer records, payment submissions, allocations, and audit history remain unchanged.
