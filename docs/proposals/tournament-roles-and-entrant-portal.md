# Tournament roles with no screen, and the entrant portal

_Written 2026-09-25. Status: **proposed, not started.**_

## State when this was written

Six tournament roles hold a permission that no page uses:

| Role | Permission | Backing data that exists today |
|---|---|---|
| Team coordinator | `review_tournament_entry` | `tournament_entries` (no notes or flags) |
| Secretary | `manage_tournament_documents` | none (`document_uploads` is per player) |
| Communications | `manage_tournament_communications` | none (`announcements` is club-only) |
| Referee coordinator | `manage_officiating` | `org_officials`, `tournament_officials` |
| Logistics | `manage_tournament_logistics` | `venues` only |
| Volunteer coordinator | `manage_tournament_volunteers` | none |

The organizer console has Entries, Categories, Finance and Staff.

**The larger gap: a team contact has no screen at all.** External entrants can claim an
account by email once their entry is accepted, but nothing renders their entry, invoice
or documents. So there is nobody to send documents requests or announcements to, and
nothing creates a payment submission (today the finance queue is fed only by hosts
recording payments themselves).

## Proposal

Add tabs to the existing console, gated by permission, rather than six separate
applications. Build the portal first because three of the roles depend on it.

1. **Entrant portal.** `/tm/entry/<id>` for an entry's contacts: status, invoice and
   payment submission, and later documents and announcements. Uses the existing
   `is_tournament_entry_contact` predicate.
2. **Team coordinator.** `tournament_entry_notes` (entry, author, note or flag,
   resolved). Holders of `review_tournament_entry` may add them and read the entry's
   contacts (today only the organizer and org admin can). Flags show in the Organizer's
   decision queue.
3. **Communications.** Tournament announcements to entrants, officials or the public
   page, delivered through the existing notifications. Needs the portal.
4. **Secretary.** `tournament_documents` per entry (waivers, insurance, roster forms)
   with pending/approved/rejected, reusing the player Documents pattern and R2 storage.
   Needs the portal for uploads.
5. **Referee coordinator.** An Officials tab over the existing tables. Match-level
   assignment stays in the tournament engine, because matches live in its JSON blob.
6. **Logistics and volunteers.** New tables with no existing backing: venues and per-team
   arrival and accommodation notes; volunteer shifts for people who may not have
   accounts. Largest and least certain.

## Decision needed

Build slices 1 to 4, and **retire logistics and volunteer coordinator from the catalog**
until someone needs them, rather than leave roles that do nothing?

## Risks

- The portal is the first screen for people outside any organization, so its access rules
  need the same care the console got (`tec_read` and entry-scoped policies, tested with
  users who belong to no organization).
- Communications and document requests are only as good as the email or in-app delivery
  behind them; see [email and invitations](email-and-invitations.md).
