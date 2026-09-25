# Email and invitations

_Written 2026-09-25. Status: **proposed, not started.** Needs DNS for `dulahq.app`
first._

## State when this was written

Nothing in the codebase sends email: no mail library, no `inviteUserByEmail`, no
`resetPasswordForEmail`. Supabase's built-in email is capped at 2 per hour. That blocks:

- **Forgot password.** There is not even a link on the login page.
- **Guardian invitations.** `inviteGuardian()` only flips a status flag; the guardian is
  never contacted and must be told out of band.
- **Staff, tournament staff and entry-contact invitations.** Every "add" needs the person
  to already have a login, which the guides call out repeatedly.
- **IT-admin actions** such as password reset and session revocation.

`dulahq.app` is registered and attached to Vercel but its DNS still points at the
registrar, so a verified sending domain does not exist yet.

## Proposal, in order

1. **Infrastructure (no code, needs the owner).** Move DNS for `dulahq.app`. Use Resend's
   free tier (3,000 a month, 100 a day), verify a `mail.dulahq.app` sending domain (SPF,
   DKIM, DMARC), and put the SMTP credentials into Supabase Auth. Brand the templates.
2. **Forgot and reset password.** A link on the login page, `/forgot-password`
   (`resetPasswordForEmail`) and `/reset-password` (`updateUser`). Always answers "if an
   account exists, we've sent a link", so it cannot be used to find out who has one. No
   service-role key needed.
3. **Invitations.** One server-only module using the service-role key, called only after
   the existing authorization functions pass (the pattern `add_club_staff` already uses),
   rate-limited and audited. It invites an unknown email to create an account; the
   existing claim flows (`claimPendingGuardianInvite`, `claimPendingTournamentEntryInvites`)
   then attach it. Covers guardians, club staff, tournament staff and accepted entry
   contacts, and removes the "must already have a login" restriction.
4. **Later, optional.** An email channel for notifications with link-only content and no
   player details, and IT-admin reset and session revocation on the same module.

## Decisions needed

- Provider: Resend, Cloudflare Email Service, or Brevo.
- The sending domain.
- Whether inviting a person with no account creates one automatically.

## Risks

- **The service-role key in server code is a new attack surface.** Keep it in one module
  with no other importers, gated by the same authorization the tenant actions use.
- **Minors' data.** Email bodies carry a link and a generic sentence, never a child's name
  or details.
- **Abuse of forgot-password.** Rate-limit by address and by IP.
- **Deliverability.** Free-tier limits and a new domain's reputation; start with low
  volume.
