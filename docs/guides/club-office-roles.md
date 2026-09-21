# Club office roles guide

For the club's **treasurer**, **secretary** and general **staff**: the people who
handle money, paperwork and communications rather than coaching. This guide is
short on purpose, because for these roles there is a real difference between what
the role is *allowed* to do and what the app has a screen for today. It tells you
both.

_Last checked: 2026-09-21 · Try it: there's no treasurer or secretary demo account.
Sign in at `/login` as `staff.u15-boys.usna-gali-fc@dulahq-showcase.local` (Corazon
Estrada, role **staff**, password `DemoPass2026!`) to see the office view._

## The three roles

| Role | Meant for | Holds |
|---|---|---|
| **Treasurer** | The money | Club finances (view and manage) |
| **Secretary** | Paperwork and communications | Documents, membership, communications |
| **Staff** | A general helper | Finances, documents, membership, communications |

All three can also **view** players, teams and tournaments, but only **on teams
they're assigned to**. That limit matters a great deal here (see below).

### Treasurer

<!-- BEGIN permissions: club:treasurer -->
_Generated from the platform permission catalog. Edit the catalog, not this table — run `npm run docs:permissions` to refresh it._

| Permission | What it allows | Reach |
|---|---|---|
| **Manage finances** | Create/edit fee charges, record payments, manage expenses | Whole club |
| **View finances** | View club-wide fee ledger and expenses | Whole club |
| **View player** | View players on an assigned team | Assigned teams only |
| **View team** | View an assigned team's roster and schedule | Assigned teams only |
| **View tournament** | View tournaments an assigned team is entered in | Assigned teams only |
<!-- END permissions -->

### Secretary

<!-- BEGIN permissions: club:secretary -->
_Generated from the platform permission catalog. Edit the catalog, not this table — run `npm run docs:permissions` to refresh it._

| Permission | What it allows | Reach |
|---|---|---|
| **Manage communications** | Send team/club announcements and reminders | Whole club |
| **Manage documents** | Review and manage uploaded forms/waivers/documents | Whole club |
| **Manage membership** | Manage player registration/membership status and records | Whole club |
| **View player** | View players on an assigned team | Assigned teams only |
| **View team** | View an assigned team's roster and schedule | Assigned teams only |
| **View tournament** | View tournaments an assigned team is entered in | Assigned teams only |
<!-- END permissions -->

### Staff

<!-- BEGIN permissions: club:staff -->
_Generated from the platform permission catalog. Edit the catalog, not this table — run `npm run docs:permissions` to refresh it._

| Permission | What it allows | Reach |
|---|---|---|
| **Manage communications** | Send team/club announcements and reminders | Whole club |
| **Manage documents** | Review and manage uploaded forms/waivers/documents | Whole club |
| **Manage finances** | Create/edit fee charges, record payments, manage expenses | Whole club |
| **Manage membership** | Manage player registration/membership status and records | Whole club |
| **View finances** | View club-wide fee ledger and expenses | Whole club |
| **View player** | View players on an assigned team | Assigned teams only |
| **View team** | View an assigned team's roster and schedule | Assigned teams only |
| **View tournament** | View tournaments an assigned team is entered in | Assigned teams only |
<!-- END permissions -->

## What you'll actually see

Open the club at `/c/your-club`. Your badge shows your role. The tabs you get depend
on what you hold:

| Tab | Treasurer | Secretary | Staff |
|---|---|---|---|
| **Teams** | Yes, but every team says **Not assigned →** | Same | Same |
| **Staff** | Your own row | Your own row | Your own row |
| **Finances** | Yes | No | Yes |
| **Reports** | Yes | No | Yes |
| **Meetings** | Yes | Yes | Yes |
| **Trips** | Yes | Yes | Yes |
| **Announcements** | Read | Read | Read |
| **Photos** | Yes | Yes | Yes |

The tabs above were observed as the demo `staff` user; the treasurer and secretary
columns follow from what their roles hold (a secretary has no finance permission, so
no **Finances** or **Reports**).

The **Drill library →** button is also there. **Overview** doesn't appear: it's for
people with teams.

### Finances and Reports (treasurer, staff)

**Finances** shows what's **Collected**, **Outstanding**, **Overdue charges**,
**Expenses** and **Net**, every fee charge, and the club's **Expenses**.

- To record an expense choose **+ Add expense**, fill in a description, category and
  amount, and **Save expense**. **Delete** takes one off.
- **Reports** gives the club-wide totals, attendance and development by team for the
  last 30 days, and a financial summary. It's read-only.

### Meetings and trips

- **Meetings.** **+ New meeting** takes a title and a location or link. Open a
  meeting to add **Notes** and **Action items**.
- **Trips.** Create a trip by name.

## What you can't do today, and why

This is the important part. **The screens for a player's documents, membership,
and fees all live on the player's own profile**, and a player's profile only opens
for someone assigned to that player's team. The app can assign only **coaches,
assistant coaches and team managers** to teams. A treasurer, secretary or staff member
can't be assigned to one from the screen.

The result, confirmed as the demo `staff` user:

- Every team page opens but shows *0 players* and *"You can manage teams you're
  assigned to — ask a club admin to assign you to this one."*
- So you **can't** open a player, record or edit a fee charge, review a document,
  or change membership status, even though your role holds those permissions.
- **Announcements** can be posted only to a team you're assigned to, so without a team
  there's no form.

Until that changes, the tabs above are the useful part of these roles. **Fee
charges, document review and membership changes are done by the club manager**, who
sees every player. If your club needs a treasurer to record fee payments, ask the
club manager to do it or to raise it with the platform team.

## Ask for help

If your club manager isn't available, the platform team can be reached from the
**Support →** button. It appears only for people with the support permission (club
managers and IT admins); if you don't see it, ask your club manager to file a request
for you.

## When something doesn't work

| You see | What it means |
|---|---|
| Teams all say **Not assigned →** | Expected for these roles today. See above |
| No **Finances** tab | You hold no finance permission (a secretary doesn't) |
| A team page shows *0 players* | You aren't assigned to it, and can't be from the screen |
| *You don't have permission to do that* | Your role doesn't include it. The tables at the top list what it does |

## Not available yet

- Assigning a treasurer, secretary or staff member to a team, so their document,
  membership and fee permissions have a screen to use.
- A club-level way to add a fee charge without opening a player.
- Posting a club-wide announcement as anyone but a club manager.
