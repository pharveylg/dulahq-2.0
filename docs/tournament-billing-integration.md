# Tournament billing integration contract

Status: ready for Tournament Manager integration; payment provider deferred.

The active Tournament Manager runtime remains in the separate `dula-hq` repository. This document defines the shared Supabase billing contract that the Tournament Manager can consume without importing Club Manager internals.

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

## Tournament-facing screens to add

The Tournament Manager should eventually add:

1. Tournament finance settings
   - payment instructions;
   - QR configuration;
   - currency;
   - finance staff permissions.

2. Entry billing view
   - invoice number;
   - charges;
   - due date;
   - payment status;
   - payment instructions;
   - proof/reference submission.

3. Organizer finance queue
   - submitted payments;
   - verification/rejection;
   - reviewer notes;
   - payment history;
   - outstanding entries.

4. Tournament finance reports
   - invoiced;
   - submitted;
   - verified;
   - outstanding;
   - refunded/credited;
   - totals by category and entrant.

## Authorization boundary

Tournament billing must not reuse Club billing permissions by name. Use tournament-scoped permissions such as:

```text
view_tournament_finance
manage_entry_invoices
verify_tournament_payment
issue_tournament_credit
approve_tournament_refund
export_tournament_financial_reports
```

Platform Admin has cross-context diagnostic and financial visibility, but every mutation remains audited.

## Payment provider boundary

The Tournament Manager must call the shared manual workflow now. It must not create provider-specific code in the tournament engine.

Future provider integration should replace the payment adapter only:

```text
ManualQrPaymentProvider
→ AutomatedPaymentProvider
```

Invoices, lines, payer records, payment submissions, allocations, and audit history remain unchanged.
