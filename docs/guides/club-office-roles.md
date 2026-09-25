# Club office roles guide

For the club's **treasurer**, **secretary** and general **staff**: the people who
handle money, paperwork and communications rather than coaching.

_Last checked: 2026-09-23 · Try it: there's no treasurer or secretary demo account.
Sign in at `/login` as `staff.u15-boys.usna-gali-fc@dulahq-showcase.local` (Corazon
Estrada, role **staff**, password `DemoPass2026!`) to see the office view._

## The three roles

| Role | Meant for | Holds |
|---|---|---|
| **Treasurer** | The money | Club finances (view and manage) |
| **Secretary** | Paperwork and communications | Documents, membership, communications |
| **Staff** | A general helper | Finances, documents, membership, communications |

Every permission below reaches **the whole club**, not just a team you're on — open
any team, open any player, and your role's controls are there. This is true even if
you're never assigned to a single team.

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

**"View player"/"View team"/"View tournament" say "Assigned teams only" in the
catalog, but don't let that mislead you** — that's the permission's own narrow
label, not the whole story. Your manage/view finance, document and membership
permissions are club-scope, and the app opens a player to anyone holding one,
whichever team they're on. See [Reaching a player](#reaching-a-player) below.

## What you'll actually see

Open the club at `/c/your-club`. Your badge shows your role. The tabs you get depend
on what you hold:

| Tab | Treasurer | Secretary | Staff |
|---|---|---|---|
| **Teams** | Every team, with its real roster | Same | Same |
| **Staff** | Your own row | Your own row | Your own row |
| **Finances** | Yes | No | Yes |
| **Reports** | Yes | No | Yes |
| **Meetings** | Yes | Yes | Yes |
| **Trips** | Yes | Yes | Yes |
| **Announcements** | Read | Read and post | Read and post |
| **Photos** | Yes | Yes | Yes |

The tabs above were observed as the demo `staff` user; the treasurer and secretary
columns follow from what their roles hold (a secretary has no finance permission, so
no **Finances** or **Reports**).

The **Drill library →** button is also there. **Overview** doesn't appear: it's for
people with teams.

### Finances and Reports (treasurer, staff)

**Finances** shows what's **Collected**, **Outstanding**, **Overdue charges**,
**Expenses** and **Net**, every fee charge with the player's real name, and the
club's **Expenses**.

- To record an expense choose **+ Add expense**, fill in a description, category and
  amount, and **Save expense**. **Delete** takes one off.
- There's no club-level "+ Add fee charge" here — a fee charge is always about one
  player, so you record it from that player's own page. See below.
- **Reports** gives the club-wide totals, attendance and development by team for the
  last 30 days, and a financial summary. It's read-only.

### Meetings and trips

- **Meetings.** **+ New meeting** takes a title and a location or link. Open a
  meeting to add **Notes** and **Action items**.
- **Trips.** Create a trip by name.

## Reaching a player

Open **Teams**, choose any team — you don't need to be assigned to it — and pick a
player from the roster on the left. Their panel opens with **Overview / Development
/ Fees / Membership / Documents / Family** tabs:

- **Fees** (treasurer, staff): **+ Add charge**, and payments against existing
  charges.
- **Membership** (secretary, staff): **+ Add period**, and a status dropdown
  (pending/active/expired/transferred) on each one.
- **Documents** (secretary, staff): the player's uploaded forms with their review
  status, **Approve** / **Reject…** / **Remove** on each, and **+ Upload document**.
  A pending count shows on the tab.
- **Development** links out to the player's full profile for goals, evaluations and
  notes.
- **Family** (guardians, player account) stays coach/club-manager territory —
  that one genuinely does need you to be assigned to the team.

None of this needed an assignment. Assigning yourself to a team (ask your club
manager — **Staff** tab → your row → **+ Assign to team**) only changes your badge on
that team from *"club-wide access"* to *"assigned"*, and lets you add or remove
players, run training and manage guardians there. Nothing about Fees, Documents,
Membership or Announcements needs it.

### Announcements (secretary, staff)

**Manage communications** lets you post to **any audience and any team**, with no
assignment: open **Announcements**, write a **Title** and **Message**, choose the
audience (club, a team, players, guardians, coaches or staff), and **Post**. You can
also pin and delete announcements. A treasurer holds no communications permission and
sees no form.

## Ask for help

If your club manager isn't available, the platform team can be reached from the
**Support →** button. It appears only for people with the support permission (club
managers and IT admins); if you don't see it, ask your club manager to file a request
for you.

## When something doesn't work

| You see | What it means |
|---|---|
| No **Fees**/**Membership** controls on a player | You hold no matching permission. The tables at the top list what your role has |
| No **Finances** tab | You hold no finance permission (a secretary doesn't) |
| No form under **Announcements** | You hold no communications permission (a treasurer doesn't). A coach or team manager can post to their own team only |
| *You don't have permission to do that* | Your role doesn't include it |

## Not available yet

- A club-level way to add a fee charge without opening a player.
