# Dula HQ platform implementation roadmap

**Date:** 10 September 2026  
**Scope:** Platform Admin, Club Manager, Tournament Manager, shared SaaS services  
**Commercial decision:** Build the billing domain now; defer automated payment processing until confirmed customers justify paid infrastructure.

---

## 1. Product structure

Dula HQ should be implemented as one platform with three coordinated areas:

```text
Dula HQ
├── Platform
│   ├── Platform Admin
│   ├── Organizations
│   ├── Entitlements and plans
│   ├── Usage and billing domain
│   ├── Support and diagnostics
│   ├── Audit and platform health
│   └── Public directory controls
│
├── Club Manager
│   ├── Clubs and teams
│   ├── Players and guardians
│   ├── Staff and permissions
│   ├── Training and development
│   ├── Fees and memberships
│   ├── Documents and consent
│   ├── Trips and communications
│   └── Club-to-tournament preparation
│
└── Tournament Manager
    ├── Tournaments and competitions
    ├── Categories and entries
    ├── Registration
    ├── Officials and venues
    ├── Scheduling and matches
    ├── Rosters and eligibility
    ├── Results and standings
    └── Tournament-to-club integration
```

The public homepage is a separate public surface that exposes only published content from the three areas. It is not an administrative workspace.

---

## 2. Guiding principles

### 2.1 Entitlements and permissions are separate

Every protected action must pass two independent checks:

```text
Does the organization own this product/capability?
AND
Is this person authorized for this resource and action?
```

Product entitlement must not automatically grant user access. A person can belong to an organization with Club and Tournament access but still lack permission to manage a particular club, team, tournament, or entry.

### 2.2 Build shared primitives once

The following should be shared across Club and Tournament rather than rebuilt separately:

- identity;
- organization membership;
- role and permission evaluation;
- entitlement checks;
- staff/user lifecycle;
- notifications;
- files and documents;
- media;
- audit;
- support;
- usage metering;
- billing domain;
- public publishing controls.

### 2.3 Build the billing domain before payment processing

The initial product should support:

- plans;
- product entitlements;
- limits;
- usage meters;
- usage snapshots;
- projected charges;
- draft invoices;
- invoice lines;
- manual adjustments;
- payment instructions;
- manual QR payments;
- payment proof and verification.

It should defer:

- card collection;
- automatic recurring charges;
- provider webhooks;
- automatic payment retries;
- automatic suspension for failed payment.

The payment layer must be implemented behind a provider interface so a future provider can be added without redesigning subscriptions, invoices, usage, or entitlements.

### 2.4 Prefer vertical slices

Each release should complete an end-to-end outcome rather than adding disconnected screens.

For example:

```text
Create team
→ add players
→ link guardians
→ schedule training
→ record attendance
→ communicate change
→ preserve history
```

And:

```text
Provision organization
→ grant entitlement
→ measure usage
→ generate draft invoice
→ show QR instructions
→ verify manual payment
→ update billing status
```

---

## 3. Target entitlement model

```text
Organization
├── Product entitlement: Club
│   └── clubs → teams → players/guardians/staff
├── Product entitlement: Tournament
│   └── tournaments → categories → entries/officials/rosters
└── Product entitlement: Combined
    └── shared identity, files, notifications, billing, and integration
```

### Core commercial entities

```text
plans
plan_features
plan_limits
pricing_versions
subscriptions
subscription_items
entitlements
usage_meters
usage_events
usage_period_summaries
invoices
invoice_lines
payments
credits
refunds
billing_adjustments
billing_events
```

### Entitlement lifecycle

```text
Requested
→ Provisioning
→ Trial
→ Active
→ Grace period
→ Restricted
→ Suspended
→ Cancelled / Expired
→ Archived
```

Access status, billing status, and product status must be represented separately. Club Manager can be active while Tournament Manager is suspended, for example.

---

## 4. Phased implementation plan

## Phase 0 — Platform contract and safety baseline

**Goal:** establish the shared rules before adding more product capability.

### Platform

- define Platform Admin as a platform-scoped authority;
- define organization, product, plan, entitlement, subscription, usage, and invoice terminology;
- document scope hierarchy: platform → organization → club/tournament → team/entry;
- establish feature-gate conventions;
- identify the authoritative source for roles and assignments;
- define audit requirements for platform and billing actions;
- define data retention and privacy boundaries;
- add environment flags for simulation/manual/live modes.

### Club

- document Club Manager ownership and role boundaries;
- confirm club, team, player, guardian, staff, and season ownership;
- identify club workflows that need to be reusable by Tournament;
- list all existing Club permissions and their resource scopes.

### Tournament

- document Tournament Manager ownership and role boundaries;
- identify tournament, category, entry, official, roster, match, venue, and result ownership;
- define Tournament permissions using the shared permission model;
- identify legacy Tournament Manager functions that require integration rather than rewrite.

### Exit criteria

- signed-off domain glossary;
- approved entitlement matrix;
- approved Platform Admin authority matrix;
- approved Club/Tournament ownership matrix;
- no new product feature proceeds without entitlement and permission checks.

---

## Phase 1 — Platform identity, provisioning, and entitlement control

**Goal:** Platform Admin can provision and control organizations without entering product-specific screens.

### Platform

Build the Platform Admin organization cockpit:

- create organization;
- rename organization;
- activate/suspend/archive organization;
- assign organization admin;
- grant Club entitlement;
- grant Tournament entitlement;
- grant Combined access;
- show entitlement status and history;
- show organizations, users, clubs, teams, and tournaments;
- control public visibility;
- view support and audit activity.

Add explicit Platform Admin permission groups:

- `manage_organizations`;
- `manage_entitlements`;
- `view_platform_audit`;
- `view_platform_usage`;
- `manage_platform_configuration`;
- `manage_support`;
- `diagnose_access`.

### Club

- organization-to-club onboarding;
- club creation from an entitled organization;
- club profile and branding;
- club manager assignment;
- initial staff invitation placeholder;
- initial team setup.

### Tournament

- organization-to-tournament onboarding;
- tournament creation from an entitled organization;
- tournament administrator assignment;
- sport and competition setup;
- public publishing controls.

### Exit criteria

- Organization A can be Club-only;
- Organization B can be Tournament-only;
- Organization C can be Combined;
- users cannot access a product without the organization entitlement;
- Platform Admin can see entitlement history and current status.

---

## Phase 2 — Billing domain and usage measurement

**Goal:** establish commercial visibility without payment processing.

### Platform

Implement:

- pricing catalog;
- versioned plans and prices;
- included limits;
- subscription records;
- entitlement-to-plan relationship;
- usage meters;
- usage events;
- billing-period snapshots;
- projected invoice calculation;
- draft invoice generation;
- invoice lines;
- credits and manual adjustments;
- usage and billing audit events.

### Initial meters

Start with understandable, low-risk metrics:

#### Club

- active clubs;
- active teams;
- active players;
- active staff seats;
- storage usage.

#### Tournament

- active tournaments;
- categories;
- registered entries;
- active tournament staff;
- storage usage.

#### Shared

- storage;
- notifications;
- organization-level staff identity where applicable.

Do not initially meter every login, screen view, database request, or internal notification attempt.

### Club

Expose:

- current club/team/player counts;
- included plan limits;
- projected usage;
- draft usage-related charges.

### Tournament

Expose:

- active tournament and entry counts;
- included limits;
- projected usage;
- draft tournament-related charges.

### Exit criteria

- Platform Admin can explain each draft invoice line;
- historical usage cannot change when current data changes;
- plan changes use versioned pricing;
- Combined organizations are not double-counted for shared meters;
- no actual payment provider is required.

---

## Phase 3 — Operational completeness of Club Manager

**Goal:** complete the highest-value daily club workflows before deep integration.

### Club

Prioritize:

- staff invitation and account lifecycle;
- roster import and validation;
- seasons;
- unified training/team calendar;
- player and guardian directory;
- complete family-level finance relationship;
- invoices, receipts, credits, discounts, and refunds as internal records;
- announcements, acknowledgement, and read status;
- staff qualifications and expiry reminders;
- document retention and consent history;
- reports by season and team;
- club readiness checklist.

### Platform

- monitor Club onboarding completion;
- show failed invitations, notifications, imports, and background jobs;
- inspect effective access for Club users;
- support organization-level troubleshooting without broadening product access.

### Tournament

- consume shared identity, notifications, files, audit, and support services;
- avoid creating parallel staff or permission models.

### Exit criteria

A Club-only organization can operate a season without relying on spreadsheets as the system of record for people, training, attendance, documents, communication, or internal fees.

---

## Phase 4 — Operational completeness of Tournament Manager

**Goal:** make Tournament Manager a first-class product under the same entitlement and Platform Admin model.

### Tournament

Prioritize:

- tournament creation and lifecycle;
- categories/divisions;
- team registration;
- entry acceptance and deadlines;
- officials and venues;
- scheduling;
- fixtures and match operations;
- results and standings;
- tournament communications;
- roster eligibility and document checks;
- tournament reports and exports;
- tournament public publishing controls.

### Platform

- inspect Tournament entitlement and usage;
- troubleshoot organizer, official, entrant, and roster access;
- inspect registration, scheduling, notification, and result-processing failures;
- show tournament health from the organization cockpit.

### Club

- expose relevant tournament opportunities to entitled clubs;
- allow teams to prepare entries and rosters where permitted;
- preserve club-side tournament participation history.

### Exit criteria

A Tournament-only organization can create and operate a tournament without needing Club Manager. Platform Admin can provision, support, meter, and troubleshoot it using the same platform control plane.

---

## Phase 5 — Manual QR billing and payment verification

**Goal:** enable real commercial testing without integrating a payment provider.

### Platform

Implement the `ManualQrPaymentProvider` adapter:

- payment instructions;
- platform QR configuration;
- invoice reference number;
- QR display;
- payment proof upload;
- payment submission;
- manual review queue;
- approve/reject payment;
- record payment date, amount, method, and reference;
- create receipt or payment confirmation;
- billing audit history.

### Organization

Organization admins can:

- view invoices;
- see current usage and projected charges;
- display payment QR/instructions;
- submit payment reference;
- upload proof;
- track verification status.

### Required payment states

```text
Not due
→ Awaiting payment
→ Submitted for verification
→ Verified
→ Rejected
→ Corrected / resubmitted
```

Do not automatically mark an invoice paid from a user-submitted declaration.

### Exit criteria

- real prospective customers can understand their projected cost;
- they can submit a manual payment;
- Platform Admin can verify and reconcile it;
- no card or bank credentials are stored by Dula HQ;
- automated suspension remains disabled or explicitly manual.

---

## Phase 6 — Club–Tournament integration

**Goal:** deliver the Combined entitlement as one coherent operating experience.

### Shared integration flow

```text
Club team
→ discover tournament
→ submit entry
→ prepare candidates
→ request guardian acknowledgement
→ finalize roster
→ receive fixtures
→ coordinate travel
→ receive results
→ preserve participation history
```

### Club

- tournament discovery;
- team entry preparation;
- roster candidate management;
- guardian acknowledgement;
- travel and logistics;
- club calendar display;
- results and player history;
- tournament communications.

### Tournament

- receive team entry through an integration contract;
- validate registration and eligibility;
- receive approved roster;
- publish fixtures and results;
- expose deadlines and status back to Club Manager.

### Platform

- cross-product audit;
- integration health and retry queue;
- source/destination record tracing;
- support diagnostics across organization, club, team, tournament, and entry;
- Combined usage and billing rules.

### Exit criteria

- no direct cross-product database coupling;
- integration actions are versioned and auditable;
- failures are retryable and visible to Platform Admin;
- Organization C receives one coherent Combined experience;
- shared resources are billed according to documented rules.

---

## Phase 7 — Automated payment provider, only when justified

**Goal:** replace manual payment handling only when confirmed customers justify the added cost.

### Platform

Add a provider implementation behind the existing interface:

```text
PaymentProvider
├── ManualQrPaymentProvider
└── AutomatedPaymentProvider
    ├── payment request
    ├── hosted checkout
    ├── status query
    ├── webhook handling
    ├── refund
    └── reconciliation
```

Implement:

- hosted checkout or payment links;
- payment webhooks;
- idempotency keys;
- failed-payment retries;
- refunds;
- automatic receipts;
- reconciliation reports;
- controlled grace-period behavior.

### Exit criteria

- a confirmed customer cohort is willing to pay;
- expected revenue exceeds infrastructure and payment costs;
- payment-provider fees are included in pricing;
- webhook and reconciliation tests pass;
- automated access changes are approved as a business policy.

---

## 5. Recommended navigation by workspace

The product should remain comprehensive without exposing every backend entity as a top-level menu.

### Platform Admin

- Overview;
- Organizations;
- Entitlements;
- Usage and Billing;
- People and Access;
- Support;
- Audit;
- Health and Diagnostics;
- Platform Settings.

### Club Manager

- Today;
- People;
- Teams;
- Training;
- Development;
- Money;
- Travel and Events;
- Communications;
- Reports;
- Settings.

### Tournament Manager

- Today;
- Tournaments;
- Entries;
- Rosters;
- Schedule;
- Venues and Officials;
- Matches;
- Results;
- Communications;
- Reports;
- Settings.

### Public View

- Clubs;
- Tournaments;
- Public tournament details;
- Public club details;
- Request access / sign in.

---

## 6. Delivery and testing strategy

### Test layers

Every phase should include:

1. unit tests for business rules;
2. RLS and authorization tests;
3. entitlement-gating tests;
4. usage-meter tests;
5. invoice-calculation tests;
6. audit tests;
7. public/private visibility tests;
8. end-to-end role tests;
9. failure and retry tests;
10. manual verification for payment placeholder flows.

### Required cross-tenant tests

At minimum, verify that:

- Organization A cannot read Organization B data;
- Club-only organizations cannot use Tournament features;
- Tournament-only organizations can use Platform support without a club;
- Combined organizations do not receive duplicate shared charges;
- Platform Admin actions are attributed to the Platform Admin;
- organization admins cannot perform Platform Admin actions;
- a suspended entitlement blocks only the intended product scope;
- manual payment submission does not automatically create a verified payment.

### Free-tier operating rules

While validation remains non-commercial:

- use feature flags for simulated/manual/live billing;
- keep file limits conservative;
- use fixture organizations for destructive tests;
- retain clear staging/test prefixes;
- avoid relying on paid-only backups or monitoring;
- schedule or trigger recurring jobs conservatively;
- maintain an external backup/export procedure;
- do not store payment credentials;
- do not promise commercial uptime or payment automation.

---

## 7. Definition of platform readiness

### Platform readiness

Platform Admin can:

- provision all three organization types;
- manage entitlement lifecycle;
- inspect access and explain failures;
- view usage and projected billing;
- generate draft invoices;
- review manual QR payments;
- support all product workflows;
- trace cross-product failures;
- review platform-wide audit and health.

### Club readiness

A Club-only organization can:

- onboard staff, teams, players, and guardians;
- operate a season;
- manage training, attendance, development, documents, communication, trips, and internal fees;
- preserve historical records;
- understand usage and projected cost.

### Tournament readiness

A Tournament-only organization can:

- create and publish tournaments;
- accept entries;
- manage officials, venues, schedules, rosters, matches, results, communications, and reports;
- understand usage and projected cost;
- operate without Club Manager.

### Combined readiness

A Combined organization can:

- use both products through one identity and organization context;
- transfer teams/rosters through defined interfaces;
- synchronize fixtures and results;
- coordinate consent and travel;
- receive unified notifications;
- view one coherent billing and usage experience;
- avoid duplicate shared-resource charges.

---

## Final implementation rule

Dula HQ should be built in this order:

```text
Platform contract and control plane
→ Club operational completeness
→ Tournament operational completeness
→ Billing domain and manual QR payments
→ Club–Tournament integration
→ Automated payment provider
```

The core decision remains:

> **Build the billing domain now. Defer the payment processor.**

This allows Dula HQ to be fully wired for demonstrations and customer validation within free-tier constraints, while avoiding a costly commercial commitment before confirmed organizations are ready to pay.

---

## 8. Revised delivery sequence: Tournament first

Because Club Manager is already materially mature, delivery can prioritize Tournament Manager first. The sequencing should be interpreted as **delivery priority**, not as permission to postpone all shared Platform foundations.

### Important distinction

The following Platform capabilities are prerequisites for Tournament Manager and must be established first as a thin foundation:

- organization identity and tenant isolation;
- Tournament entitlement gate;
- shared roles and permissions;
- audit logging;
- basic organization provisioning;
- public/private publishing rules;
- support/error reporting;
- feature flags and environment configuration;
- billing-domain tables and usage-meter hooks, even if payment is disabled.

The full Platform Admin commercial console, advanced diagnostics, revenue dashboards, and automated payment provider can come later.

## Revised sequence

### Phase T0 — Minimum Platform Kernel

**Goal:** provide only the shared services required to safely build and operate Tournament Manager.

Build or confirm:

- organization and user identity;
- organization-level Tournament entitlement;
- Tournament scope and role checks;
- basic Platform Admin organization provisioning;
- audit events;
- public Tournament publishing;
- error and support capture;
- usage-meter event hooks;
- billing-domain placeholders with `BILLING_MODE=simulation`;
- feature flags for unfinished or paid integrations.

Do not yet build the full Platform Admin business console.

**Exit criteria:** a Platform Admin can provision a Tournament-only organization, an authorized tournament administrator can access only that organization’s tournament functions, and all sensitive actions are auditable.

### Phase T1 — Tournament Manager core

**Goal:** make Tournament Manager a first-class product rather than only a proxied legacy experience.

Prioritize:

- tournament creation and lifecycle;
- categories and divisions;
- team registration and entries;
- tournament administrators and officials;
- venues;
- scheduling and fixtures;
- match operations;
- results and standings;
- tournament announcements;
- public tournament views;
- reports and exports.

Use the shared Platform identity, entitlement, permission, notification, file, and audit services from T0.

### Phase T2 — Tournament operational completeness

**Goal:** make Tournament Manager independently usable by a Tournament-only organization.

Add:

- registration deadlines;
- eligibility and document checks;
- roster workflow;
- official assignment;
- schedule changes and notifications;
- match-day operations;
- result corrections;
- tournament media;
- organization support path;
- draft usage and projected billing for tournaments.

**Exit criteria:** Organization B can operate a tournament without Club Manager, while Platform Admin can provision it, inspect access, view usage, and troubleshoot the major workflows.

### Phase C1 — Club stabilization and hardening

**Goal:** pause major Club feature expansion and make the existing mature product reliable against the shared Platform contract.

Prioritize:

- migrate or align Club checks with the shared entitlement model;
- confirm Club usage meters;
- align Club and Tournament staff/permission terminology;
- finish any remaining staff, season, calendar, finance, and communication gaps;
- validate Club workflows against the Platform Admin diagnostic model;
- confirm Club data can participate in integration without schema duplication.

This is not a rebuild of Club Manager. It is a hardening and contract-alignment phase.

### C2 — Club operational completeness

**Goal:** complete the remaining high-value Club workflows after Tournament requirements are clearer.

Prioritize:

- seasons;
- roster imports;
- family-level billing records;
- unified club calendar;
- staff qualifications;
- organization-wide directory;
- reports by season;
- consent and document retention;
- readiness checklist.

The Tournament-first sequence may reveal shared requirements for officials, eligibility documents, deadlines, and event communications. Reuse those requirements in Club rather than building parallel features.

### P1 — Expanded Platform Admin control plane

**Goal:** provide comprehensive Dula HQ-wide administration after the Tournament and Club product workflows are stable enough to support.

Build:

- organization cockpit;
- product and entitlement lifecycle;
- organization people/access directory;
- effective-permission inspector;
- “explain why” access diagnostics;
- Tournament and Club workflow diagnostics;
- usage explorer;
- support queue;
- cross-product audit search;
- notifications and background-job health;
- data import/export operations;
- public publishing controls.

### P2 — Platform commercial operations

**Goal:** operate the business side of the SaaS platform while keeping payment processing deferred.

Build:

- plans and pricing versions;
- usage summaries;
- projected invoices;
- billing-period snapshots;
- credits and manual adjustments;
- organization billing profiles;
- manual QR payment instructions;
- payment proof submission;
- manual verification and receipts;
- revenue and outstanding-balance reports;
- Combined entitlement billing rules.

### P3 — Combined integration

**Goal:** connect the now-stable Club and Tournament products.

Implement:

- club team discovery of tournaments;
- entry submission;
- roster candidate transfer;
- guardian acknowledgement;
- roster finalization;
- fixture/calendar synchronization;
- travel and logistics coordination;
- results and participation history;
- shared notifications and media;
- cross-product billing and usage attribution.

### P4 — Automated payments

**Goal:** introduce a payment provider only after confirmed customers justify paid infrastructure and transaction costs.

Add:

- hosted checkout or payment links;
- provider webhooks;
- idempotent payment processing;
- refunds;
- payment retries;
- reconciliation;
- automated receipts;
- controlled payment-based access policies.

## What changes in this revised order

### Benefits

- Tournament Manager becomes the next product priority;
- Tournament-only organizations can be validated earlier;
- existing Club Manager work is preserved rather than repeatedly disrupted;
- Tournament requirements can inform shared documents, officials, deadlines, events, and communications;
- Platform Admin is designed from real operational problems rather than hypothetical screens;
- Combined integration is postponed until both product domains are clearer.

### Risks

- Tournament work can accidentally create a second permission model;
- the legacy Tournament Manager data model may create integration pressure;
- delaying the full Platform Admin console can make troubleshooting harder;
- billing rules may be designed without enough real usage data;
- Club and Tournament terminology can drift if the shared contract is not enforced.

### Risk controls

- complete T0 before feature work;
- require every Tournament permission to use the shared authorization contract;
- add usage and audit hooks from the first Tournament feature;
- provide a minimal support and diagnostic path from the beginning;
- maintain a cross-product domain glossary;
- treat Club Manager as feature-frozen but contract-active during Tournament development;
- review shared abstractions at the end of each Tournament milestone.

## Revised summary

The recommended delivery order is now:

```text
Minimum Platform Kernel
→ Tournament Manager
→ Club Manager hardening and completion
→ Expanded Platform Admin
→ Billing domain and manual QR operations
→ Club–Tournament integration
→ Automated payment provider
```

This sequence is appropriate because Club Manager is already mature, but it does **not** mean Platform is postponed entirely. The minimum Platform kernel must come first; the full Platform Admin and commercial operations layer can be built after Tournament and Club workflows have generated real operational requirements.

---

## 9. Two-level billing model: platform billing and product billing

The billing domain must operate at two distinct levels. These should share infrastructure but must not be conflated.

```text
Dula HQ Platform billing
Organization → pays Dula HQ

Club Manager billing
Parent/guardian/player relationship → pays the club

Tournament Manager billing
Participating team/entrant → pays the tournament organizer
```

All three can use the same manual verification architecture initially, but they have different payers, owners, permissions, invoices, usage rules, and financial reports.

### 9.1 Platform billing

**Payer:** Organization  
**Payee:** Dula HQ  
**Purpose:** subscription, entitlement, plan, usage, and platform fees  
**Owner:** Platform Admin

Examples:

- Club entitlement subscription;
- Tournament entitlement subscription;
- Combined entitlement subscription;
- active player/team/staff usage;
- tournament or entry usage;
- storage or premium module usage.

### 9.2 Club billing

**Payer:** Parent, guardian, family, or player  
**Payee:** Club  
**Purpose:** club operating charges  
**Owner:** Club Manager, Treasurer, or authorized club finance staff

Examples:

- registration fee;
- membership fee;
- training fee;
- tournament participation fee;
- uniform or equipment fee;
- transportation;
- accommodation;
- camp or event fee;
- discounts, scholarships, credits, and refunds.

A family may be responsible for several players. The billing model must therefore support a payer relationship above the individual player:

```text
Family payer
├── Player A
│   ├── registration fee
│   └── training fee
└── Player B
    ├── membership fee
    └── tournament fee
```

The club should be able to issue either player-level charges or a consolidated family invoice.

### 9.3 Tournament billing

**Payer:** Participating team, club, organization, or entrant  
**Payee:** Tournament organizer  
**Purpose:** tournament participation and competition charges  
**Owner:** Tournament Organizer or authorized tournament finance staff

Examples:

- team registration fee;
- category/division fee;
- late registration fee;
- refundable bond or deposit;
- referee or venue charge;
- additional roster/player fee;
- accommodation or logistics fee;
- cancellation or withdrawal charge;
- credits, refunds, and adjustments.

The payer should not be assumed to be a club. A Tournament-only organization may enter an external team, school, association, or independent group. The data model needs an entrant billing profile that can exist independently from Club Manager.

---

## 10. Shared billing architecture with separate billing contexts

Use one shared billing engine with explicit context rather than creating three unrelated payment systems.

```text
billing_accounts
billing_parties
billing_profiles
billing_documents
billing_lines
payment_submissions
payment_allocations
credits
refunds
billing_adjustments
billing_events
```

Every billable record should identify its context:

```text
billing_context_type
- platform
- club
- tournament
```

And its payer/recipient relationship:

```text
payer_type
- organization
- family
- guardian
- player
- club
- team
- entrant

recipient_type
- dulahq
- club
- tournament_organizer
```

A useful invoice shape is:

```text
invoice
├── billing context: club
├── payer: Family Account 102
├── recipient: Usna Gali FC
├── source: U15 Girls registration
├── status: submitted_for_verification
└── lines
    ├── registration fee
    └── tournament participation fee
```

This prevents a Platform Admin invoice to Organization C from being confused with a club invoice sent to one of Organization C’s families.

### Source references

Every charge should retain its originating business context:

```text
source_type
- subscription
- player_membership
- training_program
- tournament_entry
- tournament_category
- trip
- event
- uniform_order
- accommodation
- manual_adjustment
```

```text
source_id
- entitlement id
- player id
- membership id
- entry id
- trip id
- event id
```

This makes every amount explainable from the operational feature that created it.

---

## 11. Manual verification flow for product billing

The same placeholder payment architecture can be used for Club and Tournament billing.

```text
Charge created
→ invoice issued
→ QR/payment instructions displayed
→ payer pays externally
→ payer submits reference/proof
→ authorized finance user reviews
→ payment allocated to invoice
→ receipt/status updated
```

### Club payment flow

```text
Club creates family/player charge
→ guardian sees invoice
→ guardian scans club QR code
→ guardian submits proof/reference
→ treasurer or authorized club finance user verifies
→ player/family balance updates
→ guardian receives confirmation
```

### Tournament payment flow

```text
Tournament creates team/entrant charge
→ team contact sees invoice
→ team scans tournament QR code
→ team submits proof/reference
→ tournament finance user verifies
→ entry balance updates
→ registration/entry status updates if required
```

The QR destination is configured by the receiving business entity:

- Dula HQ for Platform billing;
- a club for Club billing;
- a tournament organizer for Tournament billing.

A payment should not be marked `paid` merely because proof was submitted.

Recommended statuses:

```text
Draft
→ Issued
→ Awaiting payment
→ Submitted for verification
→ Verified
→ Partially paid
→ Rejected
→ Overdue
→ Waived / Credited
→ Refunded
→ Cancelled
```

---

## 12. Permission model for product billing

Platform billing and product billing require separate permission families.

### Platform billing permissions

- `view_platform_billing`;
- `manage_plans`;
- `manage_entitlements`;
- `view_platform_usage`;
- `issue_platform_credit`;
- `approve_platform_adjustment`;
- `verify_platform_payment`;
- `view_platform_financial_reports`.

### Club billing permissions

- `view_club_finance`;
- `manage_club_charges`;
- `manage_family_invoices`;
- `verify_club_payment`;
- `issue_club_credit`;
- `approve_club_refund`;
- `export_club_financial_reports`.

These should be scoped to the club and, where appropriate, to the team.

### Tournament billing permissions

- `view_tournament_finance`;
- `manage_tournament_charges`;
- `manage_entry_invoices`;
- `verify_tournament_payment`;
- `issue_tournament_credit`;
- `approve_tournament_refund`;
- `export_tournament_financial_reports`.

These should be scoped to the tournament or entry. A tournament finance user must not automatically gain access to Club Manager family billing.

### Family/guardian visibility

A guardian should only see:

- invoices for their own family or linked players;
- charges addressed to them or their family account;
- payment instructions for those invoices;
- their own payment submissions;
- receipts and balances they are authorized to view.

A guardian should not see:

- another family’s fees;
- club-wide revenue;
- another player’s payment history;
- Platform billing;
- Tournament organizer financial reports.

### Team/entrant visibility

A participating team or entrant should only see:

- its own tournament invoices;
- its own registration charges;
- its own payment submissions;
- its own balance and receipts;
- charges for its own entry or roster where applicable.

It should not see another team’s financial information.

---

## 13. Relationship between payment and operational status

Product billing may influence business workflow, but it should not be hardcoded into every feature.

### Club examples

A club may choose policies such as:

- unpaid registration blocks final enrollment;
- overdue training fees show a warning but do not block attendance;
- unpaid trip fees block passenger confirmation;
- scholarship or approved credit overrides a balance warning.

### Tournament examples

A tournament may choose policies such as:

- unpaid entry fee keeps an entry in `payment_pending`;
- verified payment moves an entry to `accepted`;
- unpaid late fee blocks final roster submission;
- a refundable bond remains separately tracked from participation fees.

These should be represented as configurable workflow policies, not universal assumptions.

```text
financial_status
≠
operational_status
```

The system should be able to explain:

```text
Entry blocked because payment is pending
```

rather than simply returning a generic authorization error.

---

## 14. Revised phased billing implementation

### Billing Phase B0 — Shared billing primitives

Build once:

- billing contexts;
- billing parties;
- payer/recipient relationships;
- invoices and invoice lines;
- payment submissions;
- payment allocations;
- credits and refunds;
- manual adjustments;
- billing statuses;
- audit events;
- source references.

No automated payment provider is required.

### Billing Phase B1 — Club billing

Implement:

- player/family charges;
- family-level invoices;
- player-level allocation;
- guardian invoice view;
- club QR/payment instructions;
- proof submission;
- club finance verification;
- receipts;
- balances and statements;
- discounts, scholarships, credits, and refunds;
- club financial reports.

### Billing Phase B2 — Tournament billing

Implement:

- entrant/team billing profile;
- tournament entry invoice;
- category and roster-related charges;
- tournament QR/payment instructions;
- team proof submission;
- tournament finance verification;
- entry balance and payment status;
- tournament financial reports;
- refunds, deposits, and cancellation adjustments.

### Billing Phase B3 — Platform billing

Implement:

- organization subscriptions;
- Club/Tournament/Combined plan pricing;
- usage meters;
- projected usage charges;
- draft platform invoices;
- organization billing profile;
- Platform Admin billing dashboard;
- manual QR payment and verification for organizations;
- plan and entitlement history.

### Billing Phase B4 — Cross-context controls

Add:

- Platform Admin’s ability to troubleshoot billing across all contexts;
- strict separation of financial data by recipient and payer scope;
- consolidated organization reporting where appropriate;
- Combined entitlement rules;
- cross-product audit trails;
- reconciliation and adjustment reports.

### Billing Phase B5 — Automated payments later

Add a payment provider adapter only after the corresponding manual flow is validated:

```text
ManualQrPaymentProvider
→ AutomatedPaymentProvider
```

Each context can adopt automation independently. For example:

- Club billing may remain manual while Platform billing becomes automated;
- Tournament billing may use hosted payment links before Club billing does;
- Platform subscriptions may be automated before family or team payments.

---

## 15. Updated implementation order

The revised overall delivery sequence becomes:

```text
Minimum Platform Kernel
→ Tournament Manager core
→ Tournament billing
→ Club Manager hardening
→ Club billing
→ Expanded Platform Admin
→ Platform billing and usage
→ Club–Tournament integration
→ Cross-context billing controls
→ Automated payment providers
```

This preserves the Tournament-first priority while ensuring that each product has a usable manual billing capability before automated payments are introduced.
