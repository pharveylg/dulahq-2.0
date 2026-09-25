# Tournament staff guide

For everyone who helps run a tournament besides the organizer: the treasurer, the IT
admin, team coordinators, the secretary, logistics, communications, volunteers and
referees. It also covers the people from outside teams who get access to their own
entry.

If you're the organizer, read the [tournament organizer guide](tournament-organizer.md)
instead.

_Last checked: 2026-09-21 · There are no demo accounts for these roles. The demo
organizer (Dennis Manalo, `/demo`) can add someone to try one._

## Read this first: what the roles can do and what the app shows

The permission catalog defines nine tournament roles. Only three of them have screens
that use their permissions today:

| Role | Has a working screen? |
|---|---|
| **Organizer** | Yes, all of it |
| **Treasurer** | Yes: the **Finance** tab |
| **IT admin** | Yes: suspend and reactivate staff, and the audit trail, on the **Staff** tab |
| **Team coordinator** | No screen uses their permission yet |
| **Secretary** | No |
| **Logistics** | No |
| **Communications** | No |
| **Volunteer coordinator** | No |
| **Referee coordinator** | No |

Every role in the table can open the tournament console and **read** its **Entries**
and **Categories**. For the roles with "No", that read-only view is everything the app
offers today. The permissions are real and recorded, ready for when those screens
are built, but there is nothing to click. Each section below says so plainly.

## Getting in

1. An organization admin or the organizer adds you on the console's **Staff** tab,
   using your email and choosing your role. You need a Dulà HQ login first. The app
   can't create one.
2. Sign in and open the **Manage** link in the **Tournaments you manage** strip on the
   homepage. That opens the console at `/tm/your-org/your-tournament`.
3. You see this tournament only. You don't need to belong to the organization, and you
   can't see its clubs, players or other tournaments.

### What every staff member sees

- **Entries.** Every team that has entered, with its status and category. You can't
  accept, decline or add an entry, and **you won't see the teams' contact details**:
  their names and emails are visible only to the organizer and organization admins.
- **Categories.** Each division, with its fee and how full it is. You can't change
  them.

The two tabs read the same as the organizer's, minus the buttons.

## Treasurer

You handle the tournament's money. You can see and manage everything on the
**Finance** tab.

<!-- BEGIN permissions: tournament:treasurer -->
_Generated from the platform permission catalog. Edit the catalog, not this table — run `npm run docs:permissions` to refresh it._

| Permission | What it allows | Reach |
|---|---|---|
| **Manage tournament finances** | Registration fees, payments, refunds, and expenses | This tournament |
| **View tournament finances** | View tournament fee and financial records | This tournament |
<!-- END permissions -->

- **Record a payment** the tournament received (cash or a transfer on its own
  statement): on the invoice choose **Record payment**, enter the amount, how it was
  paid, and optionally a reference and a note.
- **Verify or reject** a payment a team reported. A rejection needs a reason, and the
  invoice reopens for another attempt.
- **Set the payment instructions** teams read: **How teams pay you**, then
  **Save instructions**.

The steps are the same as the organizer's. See **Finance** in the
[organizer guide](tournament-organizer.md#finance). The console only issues an
invoice when an entry is added, and only the organizer can add entries, so you
can't invoice a team yourself.

## IT admin

You keep people's access working. Your permissions:

<!-- BEGIN permissions: tournament:tournament_it_admin -->
_Generated from the platform permission catalog. Edit the catalog, not this table — run `npm run docs:permissions` to refresh it._

| Permission | What it allows | Reach |
|---|---|---|
| **Submit support request** | Escalate an issue to the Dula HQ platform team on behalf of the organization | This tournament |
| **Suspend/reactivate account** | Temporarily suspend or reactivate a staff member's access without removing them from the club | This tournament |
| **View audit log** | Review administrative and security activity for the club | This tournament |
| **Create logins** | Create a login for a person and issue a temporary password | This tournament |
| **Manage public listing** | Show the tournament in, or remove it from, the public directory | This tournament |
<!-- END permissions -->

On the **Staff** tab you can:

- **Suspend** a staff member to cut their access at once, and **Reactivate** them to
  restore it. They keep their record.
- Read the **Audit trail** of what's happened in this tournament.
- **Create a login** for someone who has none, and **Reissue** a temporary password for a login you created. At the top of the tab, enter their name and email; you get a temporary password shown once. They must choose their own on first sign-in; unused, it stops working after 72 hours. No email is sent, so hand it over yourself.

You can also list the tournament in the public directory: on the **Public listing** tab,
choose **List publicly**. It first shows exactly what people will see (name, organizer,
date, venue, poster) and never shows entries, players or finances. **Remove from public
directory** takes it down; the organizer can do that too, but only you and an
organization admin can list it. If the platform team has hidden it, the tab says so and
why, and your setting applies again once they lift the block.

You can't add or remove staff (that's the organizer or an organization admin). There
is no "view as" tool at tournament level: that exists for club IT admins and the
platform team.

## Team coordinator

You review entries: the catalog describes it as checking a registration's
requirements, documents, fees and eligibility, without deciding. The organizer alone
accepts or declines.

<!-- BEGIN permissions: tournament:team_coordinator -->
_Generated from the platform permission catalog. Edit the catalog, not this table — run `npm run docs:permissions` to refresh it._

| Permission | What it allows | Reach |
|---|---|---|
| **Review tournament entry** | Verify a registration's requirements, documents, fees, and eligibility -- does not decide it | This tournament |
<!-- END permissions -->

**There is no review screen yet.** You can read the list of entries, and that's all.
Contact details stay with the organizer.

## Secretary

You look after the tournament's documentation, records and official correspondence.

<!-- BEGIN permissions: tournament:secretary -->
_Generated from the platform permission catalog. Edit the catalog, not this table — run `npm run docs:permissions` to refresh it._

| Permission | What it allows | Reach |
|---|---|---|
| **Manage tournament documents** | Tournament documentation, records, and official correspondence | This tournament |
<!-- END permissions -->

**No documents screen exists yet.** You have the read-only Entries and Categories.

## Logistics

You'd handle venues, fields, equipment, transport and match-day operations.

<!-- BEGIN permissions: tournament:logistics -->
_Generated from the platform permission catalog. Edit the catalog, not this table — run `npm run docs:permissions` to refresh it._

| Permission | What it allows | Reach |
|---|---|---|
| **Manage tournament logistics** | Venues, fields, equipment, transportation, and match-day operations | This tournament |
<!-- END permissions -->

**No logistics screen exists yet.** Read-only Entries and Categories only.

## Communications

You'd send tournament-wide announcements and notices.

<!-- BEGIN permissions: tournament:communications -->
_Generated from the platform permission catalog. Edit the catalog, not this table — run `npm run docs:permissions` to refresh it._

| Permission | What it allows | Reach |
|---|---|---|
| **Manage tournament communications** | Tournament-wide announcements and notices | This tournament |
<!-- END permissions -->

**No tournament announcements screen exists yet.** Read-only Entries and Categories
only.

## Volunteer coordinator

You'd recruit volunteers and manage their shifts and availability.

<!-- BEGIN permissions: tournament:volunteer_coordinator -->
_Generated from the platform permission catalog. Edit the catalog, not this table — run `npm run docs:permissions` to refresh it._

| Permission | What it allows | Reach |
|---|---|---|
| **Manage volunteers** | Volunteer recruitment, assignments, shifts, and availability | This tournament |
<!-- END permissions -->

**No volunteers screen exists yet.** Read-only Entries and Categories only.

## Referee coordinator

You'd assign referees and officials and manage officiating schedules.

<!-- BEGIN permissions: tournament:referee_coordinator -->
_Generated from the platform permission catalog. Edit the catalog, not this table — run `npm run docs:permissions` to refresh it._

| Permission | What it allows | Reach |
|---|---|---|
| **Manage officiating** | Referee/official assignments and officiating schedules for this tournament | This tournament |
<!-- END permissions -->

**No officiating screen exists yet.** Read-only Entries and Categories only. (An
organization keeps its pool of officials at the organization level, and only an org
admin edits that pool.)

## People from outside teams

A team that isn't a Dulà HQ club can still get access to its own entry.

1. When the organizer adds the team's entry, they can list a **contact** for it: a
   name, an email, and a role of **Team manager** or **Coach**.
2. When the organizer **accepts** the entry, the team manager contact is marked
   *invited*. A coach stays as information unless invited separately.
3. The contact signs in with that **same email** (they need a login) and their access
   to that entry is claimed automatically.

Their access covers **that one entry**, not the tournament. **There's no screen for
them yet**, so today they hold the access but have nothing to open. Nothing is
emailed: the organizer has to tell them.

## When something doesn't work

| You see | What it means |
|---|---|
| You can't find the console | Look for the **Tournaments you manage** strip on the homepage. If it isn't there, you haven't been added as staff yet |
| You can open Entries but can't change anything | Expected for every role except the organizer |
| No **Finance** tab | You hold no finance permission. Only the treasurer and organizer do |
| No **Suspend** button | Only a tournament IT admin or an organization admin can suspend someone |
| *You don't have permission to do that* | Your role doesn't include it |
| *No Dula HQ account exists for that email* (when being added) | You need a login first |

## Not available yet

- Screens for the team coordinator, secretary, logistics, communications, volunteer
  coordinator and referee coordinator roles.
- A screen for outside team contacts.
- Any email or message telling someone they've been added.
