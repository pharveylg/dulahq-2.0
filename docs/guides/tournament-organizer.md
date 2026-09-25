# Tournament organizer guide

For the person who runs a tournament day to day: taking entries, setting up
divisions, collecting fees, and choosing who helps. You're appointed to one
tournament by the organization's admin, and your access covers that tournament and
nothing else.

_Last checked: 2026-09-21 · Try it: sign in at `/demo` as **Tournament organizer**
(Dennis Manalo, organizer of Tiger Cup at Davao Unity Sports). It opens the
tournament console._

## What you can and can't do

You don't need to belong to the organization: your access comes only from being the
tournament's organizer. You see **your tournament** and nothing else. Other
tournaments, even in the same organization, are invisible, and so is everything about
clubs and players.

### Your default permissions

<!-- BEGIN permissions: tournament:organizer -->
_Generated from the platform permission catalog. Edit the catalog, not this table — run `npm run docs:permissions` to refresh it._

| Permission | What it allows | Reach |
|---|---|---|
| **Submit support request** | Escalate an issue to the Dula HQ platform team on behalf of the organization | This tournament |
| **View audit log** | Review administrative and security activity for the club | This tournament |
| **Decide tournament entry** | Accept or reject a team's tournament registration | This tournament |
| **Manage competition** | Divisions, groups, brackets, fixtures, scheduling, standings, and seeding | This tournament |
| **Manage officiating** | Referee/official assignments and officiating schedules for this tournament | This tournament |
| **Manage tournament** | Configure tournament identity, categories, rules, deadlines, and requirements; publish, close, or archive the tournament | This tournament |
| **Manage tournament communications** | Tournament-wide announcements and notices | This tournament |
| **Manage tournament documents** | Tournament documentation, records, and official correspondence | This tournament |
| **Manage tournament finances** | Registration fees, payments, refunds, and expenses | This tournament |
| **Manage tournament logistics** | Venues, fields, equipment, transportation, and match-day operations | This tournament |
| **Manage tournament staff** | Add or remove tournament staff | This tournament |
| **Manage volunteers** | Volunteer recruitment, assignments, shifts, and availability | This tournament |
| **Review tournament entry** | Verify a registration's requirements, documents, fees, and eligibility -- does not decide it | This tournament |
| **View tournament finances** | View tournament fee and financial records | This tournament |
<!-- END permissions -->

You **can't** suspend or reactivate someone's account (that belongs to the
tournament IT admin role, and to the organization's admin), and you can't change
what an organization has switched on.

## Getting to your console

The tournament console is at `/tm/your-org/your-tournament`, for example
`/tm/davao-unity-sports/tiger-cup`. You don't have to type it: after you sign in, the
homepage shows a **Tournaments you manage** strip with a **Manage** link for each
tournament, and `/tournaments` lists the same ones.

At the top of the console you'll see the tournament's name, its organization, date and
venue, and **Open tournament engine**, which goes to the separate app that holds
brackets, groups and live scores.

## Entries

The **Entries** tab lists every team that has entered, with tabs to filter:
**Pending, Accepted, Declined, Flagged** and **All**, each with a count. The tab itself shows
a badge for how many are pending. When nothing is waiting it says *No entries are
waiting for a decision.*

### Notes and flags from your team coordinator

A team coordinator (or you) can leave a **note** or a **flag** on an entry from **Notes**. An entry with an open flag shows *open flag* beside its status, and **Flagged** lists them all. **Resolve** closes a flag once you've dealt with it. Teams never see notes or flags.

### Accept or decline

Each pending entry has **Accept** and **Decline**. Declining asks you to confirm
(*Decline [team]?*). Both go through an audited path, so there's always a record of
who decided and when.

Accepting an entry **invites its team manager**: if the entry has a contact whose role
is team manager, their status changes to *invited*, and they can claim access to their
entry when they sign in with that email. Coach contacts stay as information unless
they're invited separately.

### Add an entry yourself

Use this for a team that registered with you by phone or message.

1. Choose **+ Add entry**.
2. Fill in the **Team name**, and pick the **Category**. Each category in the list
   shows its fee and how full it is, like *U15 Boys · ₱1,500.00 · 3/8*. A category
   that's full is greyed out and marked *full*.
3. Optionally add a **Contact name**, **Contact email** and **Contact role** (*Team
   manager* or *Coach*). A contact needs both a name and an email.
4. If the category has a fee, a box reads *Issue a ₱1,500.00 registration-fee invoice*.
   It's ticked by default; untick it if you don't want to bill them.
5. Choose **Add entry**. It says *Entry added as pending.*

The entry is **always created as pending**. Accepting it is a separate step. The
contact and the invoice are follow-ons: if either fails, the entry still exists and
the message tells you exactly what didn't happen.

The invoice can **only be issued at this point**. There's no way to bill an entry
later.

A category with a capacity stops accepting new entries when it's full. **Pending and
accepted entries both take a place**; declined and withdrawn ones don't.

## Categories

Set up the divisions or age groups on the **Categories** tab. Choose **Add a
category** and fill in a **Name** (for example *U15 Boys*), and optionally an **Age
group**, a **Format** (for example *7-a-side*), an **Entry fee (PHP)** and a
**Capacity (teams)**. Each category shows its fee and how many entries it has, like
*₱1,500.00 · 3 of 8 entries*.

**Edit** changes any of it. **Delete** asks you to confirm, and is refused if teams
have entered that category.

## Finance

The **Finance** tab shows up if you hold a finance permission, which an organizer does.
Its badge counts payments waiting for you.

It starts with four figures: **Billed, Collected, Outstanding** and **To verify**.

### Tell teams how to pay

Under **How teams pay you**, write your GCash number, bank account, or where to hand
over cash, and choose **Save instructions**. Teams read this when they pay an invoice.

### Record a payment you received

Most fees arrive as cash, or a transfer you can see on your own statement. Nobody
"submits" those, so you record them:

1. Under **Open invoices**, choose **Record payment** on the invoice.
2. Enter the **Amount received** (it fills in what's still owed), **How** it was
   paid (Cash, Bank transfer, QR transfer or Other), and optionally a **Receipt or
   reference** and a **Note**.
3. Choose **Record payment**.

You can't record more than what's owed. A part-payment leaves the invoice **Part
paid**; the rest marks it **Paid** and it moves to **Settled and closed**.

### Verify or reject a payment a team submitted

When a payer reports a payment it appears under **Payments to verify**, with the
amount, method, reference and their note.

- **Verify** once you've confirmed the money arrived.
- **Reject** asks for a reason (*Say why it was rejected so the payer knows what to
  fix.*). The invoice goes back to **Awaiting payment**, or **Part paid** if some money
  is already in, so the payer can try again.

Everything on this tab is recorded against you in the audit trail.

## Staff

The **Staff** tab shows who helps run the tournament and lets you add and remove them.

1. Under **Add staff**, enter their **email**, choose a **role**, and **Add**.
2. **Remove** archives someone. The record stays under **Former staff**, and adding
   them again restores them.

They need an existing Dulà HQ login. If there isn't one you'll see *no Dula HQ account
exists for that email*, because the app can't create logins. The roles and what each
can do are in the [tournament staff guide](tournament-staff.md).

Below the list is the **Audit trail** of what's happened in this tournament, with
who did it and when.

## Rosters

You don't build a team's roster. A team's own coach does, as described in the
[coach and team manager guide](coach-and-team-manager.md). For a team that isn't a
Dulà HQ club (an outside team you entered yourself), no coach has an account to do
it, so the roster step falls to an **organization admin**. Ask yours.

## When something doesn't work

| You see | What it means |
|---|---|
| A category is greyed out and marked *full* | It's reached its capacity. Raise it under **Categories** |
| *That is still referenced by something else* when deleting a category | Teams have entered it |
| No **Finance** tab | You hold no finance permission |
| No **Suspend** button on staff | That's the IT admin's job, or the organization admin's |
| You can't find the console | Look for the **Tournaments you manage** strip on the homepage. If it isn't there, you haven't been added as staff on that tournament yet |
| *You don't have permission to do that* | Your role doesn't include it |

## Not available yet

- Public self-service registration. Teams can't sign themselves up; you or an org
  admin add them.
- Payments a team reports appear under **Payments to verify** once the team manager has signed in (with the email you listed) and used **Your team entries** on the home page. Cash and transfers you receive yourself are still recorded by you.
- Listing the tournament in the public directory. The tournament IT admin or an
  organization admin does that on the **Public listing** tab; you can take it down there.
- Assigning referees and officials, and the "flag for review" step for team
  coordinators.
- Brackets, schedules and live scores in the console. They're in the tournament
  engine.
- Sending the platform team a support request. *Submit support request* is in the
  table above, but the only Support page today is on a club's page, so an organizer
  with no club has nowhere to use it. Contact the platform team directly.
