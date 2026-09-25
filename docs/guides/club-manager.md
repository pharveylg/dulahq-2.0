# Club manager guide

For the person who runs a club: its staff, its fees and money, its membership and
paperwork. You're the club's business owner. The coaches own the football side.

_Last checked: 2026-09-21 · Try it: sign in at `/demo` as **Club manager** (Juan
Villanueva, Usna Gali FC), which opens the club's page._

## What you can and can't do

You can run the club across every team in it: staff, fees, expenses, membership,
documents, reports, meetings, trips, announcements and photos.

**You deliberately can't** author player development records (goals, evaluations,
private coach notes) or fill in and finalize a tournament roster. Those belong to
the coaches. You can read a player's development, but not write it. You can,
however, schedule training and record matches for any team. The table below is the
full list, generated from the platform's permission catalog, and your team-level
permissions reach every team in the club.

### Your default permissions

<!-- BEGIN permissions: club:club_manager -->
_Generated from the platform permission catalog. Edit the catalog, not this table — run `npm run docs:permissions` to refresh it._

| Permission | What it allows | Reach |
|---|---|---|
| **Manage club** | Rename the club and change club-wide settings | Whole club |
| **Manage communications** | Send team/club announcements and reminders | Whole club |
| **Manage documents** | Review and manage uploaded forms/waivers/documents | Whole club |
| **Manage finances** | Create/edit fee charges, record payments, manage expenses | Whole club |
| **Manage membership** | Manage player registration/membership status and records | Whole club |
| **Manage staff** | Add/remove club staff and assign teams | Whole club |
| **Submit support request** | Escalate an issue to the Dula HQ platform team on behalf of the organization | Whole club |
| **View audit log** | Review administrative and security activity for the club | Whole club |
| **View finances** | View club-wide fee ledger and expenses | Whole club |
| **Assign staff to a team** | Add or remove coaches and staff on a team you are responsible for | Every team in the club |
| **Edit player football profile** | Edit position, preferred foot, and other football-profile fields | Every team in the club |
| **Export tournament roster** | Generate a TXT/PDF of a finalized tournament roster | Every team in the club |
| **Manage match** | Record match events, minutes, and statistics | Every team in the club |
| **Manage training** | Create and schedule training sessions and session plans | Every team in the club |
| **View attendance** | View training attendance records | Every team in the club |
| **View development** | View development goals, evaluations, and progress | Every team in the club |
| **View medical/safety info** | View medical alerts and safety information for assigned players | Every team in the club |
| **View player** | View players on an assigned team | Every team in the club |
| **View team** | View an assigned team's roster and schedule | Every team in the club |
| **View tournament** | View tournaments an assigned team is entered in | Every team in the club |
<!-- END permissions -->

These are defaults for the role. Changing an individual person's permissions isn't
something the app offers yet.

## Your club's page

Open the club from **Clubs**, or go straight to `/c/your-club`. Your role shows as
a badge at the top, with the club's name, place and description. Choose **Edit
profile** to change the details (see below).

| Tab | What's in it |
|---|---|
| **Overview** | What needs doing today, across every team (see below) |
| **Teams** | The club's teams. Open one for its roster, training and tournaments |
| **Staff** | Everyone who works for the club, and adding more people |
| **Finances** | Money in and out: fee charges, expenses, and totals |
| **Reports** | Attendance, development and finance rollups |
| **Meetings** | Meetings with notes and action items |
| **Trips** | Trips, with passengers |
| **Announcements** | Messages to the club |
| **Photos** | The club's photo albums |

Buttons at the top link to the **Drill library →**, **Support →** (ask the platform
team for help), and, only for a club IT admin, **IT administration →**.

### Overview

What needs doing today, across every team: sessions that have no attendance
recorded, sessions with no drills planned, and goals marked as needing attention.
If there's nothing to do it says *Nothing needs your attention right now.* Today's
and upcoming sessions follow, then a card for each team: player count, the last 30
days' attendance, and how many goals are active. Club-wide totals are under
**Reports**.

## Edit the club's profile

1. Choose **Edit profile**.
2. Change the **Name**, **About** and **Location**.
3. To add or replace the **Logo**, choose a file (JPEG, PNG, WebP or SVG, up to
   2 MB). Choose **Remove logo** to take it off.
4. **Save**.

The logo appears on your club's tile in the public directory. If the club has no
logo it falls back to the organization's, and then to a generated crest made from
the club's initials.

**Listing the club in the public directory** is the club IT admin's and the organization
admin's to switch on, not yours. A new club is private: only signed-in people who belong
to it can find it. At the top of the club page you'll see a **Public directory** card that
shows whether it's listed and exactly what people would see. If it's listed, **Remove from
public directory** takes it down.

## Manage your staff

Open **Staff**. Each person is listed with their email and role.

### Add someone

1. Under **Add staff**, enter their **Email** and choose a **Role**.
2. Choose the button to add them.

The person **must already have a Dulà HQ login**. If they don't, the form says
*"No existing Dula HQ account found… This app can't create new accounts."* Logins
are created outside the app today. Add them once they exist.

### Choose the right role

| Role | Who it's for |
|---|---|
| **club_manager** | The club's business owner. That's you |
| **team_manager** | Runs a team's operations: documents, membership, fee visibility for their own team. Can't write development records |
| **coach** | Owns the football side: training, attendance, development, tournament rosters |
| **assistant_coach** | Supports a coach. Records attendance, authors nothing else |
| **treasurer** | Finance specialist |
| **secretary** | Documents, membership and communications |
| **staff** | A general helper with a small set of everyday permissions |

Exactly what each role holds is in the table at the top of its own guide.

**Club IT admin isn't on this list.** It carries no business authority at all —
see the [club IT admin guide](club-it-admin.md) — so appointing one is
deliberately kept out of your hands, the same way appointing you was kept out of
your own. Only an organization admin can add one, from this same Staff tab.

### Put people on teams

Coaches, team managers and assistant coaches only see the teams they're assigned
to — this genuinely matters for them, and is how you give them a team at all.
Treasurers, secretaries and staff can be assigned too, but it's a smaller thing
for them: their finance, document and membership permissions are club-wide
already, so they can open any player on any team, and post announcements to any
audience, without an assignment. Assigning one is optional for them. For each of them:

1. Choose **+ Assign to team** and pick the team.
2. To remove them from a team, use the **×** next to it.

**Primary coach.** Each team can have one primary (lead) coach. On a coach's team,
choose **Make primary**. It moves the badge from the previous primary in one step,
so the team is never left without a lead. Assistant coaches can't be primary.

### Remove someone

Choose **Remove** on their row. This **archives** them rather than deleting them:
they lose all access to the club immediately and their team assignments are
cleared, but the record stays under **Former staff**, so their history isn't lost.
Their login still exists; it just does nothing at this club. To bring someone back,
add them again with the same role: their old record is restored (without their team
assignments, which you'd need to give them again).

Only club managers and organization admins see **Remove**. Other staff, who used to
be shown the button and then refused, no longer are.

### People edit their own profile

Each staff member can add their own phone number, bio, photo and certifications
from their own row. The edit form only appears on your own row.

## Teams and players

**Create a team.** On **Teams**, type a **team name** (for example *U12 Boys*), choose
**Grassroots (youth)** or **Adult**, and choose **Create team**. Its web address is made
from the name (`u12-boys`, or `u12-boys-2` if that's taken).

**Link a team.** Below that, the link form attaches a team that already exists in your
organization and hasn't been claimed by a club, and asks you for a **URL slug**. If
there's no such team you'll see *"No unclaimed teams available to link."*

**Add a player.** Open a team. On the **Roster** tab, add a player: **Player
name**, **Jersey #**, **Position** and **Age** (the name is required).

Choose a player and a summary panel opens with **Overview, Development, Fees,
Membership, Documents** and **Family**. Fees are added and paid there, and documents
are uploaded and reviewed on the **Documents** tab. Its **Development** tab has
**Open development profile →**, which opens the **full profile page** with goals,
evaluations and notes. The full profile has the same six tabs:

| Tab | What it holds |
|---|---|
| **Overview** | A snapshot: football profile, development, training, recent activity |
| **Development** | Goals, evaluations, notes, timeline. You can read; coaches write |
| **Fees** | The player's charges and payments |
| **Membership** | Registration status and the player's team history |
| **Documents** | Uploaded forms and their review status |
| **Family** | Guardians, and the player's own login |

### Move a player to another team

On **Membership**, use **Move to another team** and pick the destination (it has
to be in your club). The player keeps their whole history: evaluations, fees,
documents. Their old team stint is closed and a new one opened, the guardian is
notified, and it's recorded in the audit log. Leaving the club altogether is
different: change their membership status instead.

### Add a guardian and invite them

Players under 18 need a guardian, who gets the notifications and gives consent.

1. On the player's **Family** tab, choose **+ Add guardian** and enter their
   **name**, **phone** and **email**.
2. Choose **Invite** next to them.

**Invite only marks the guardian as invited. It doesn't send them anything.** Tell
them yourself to go to `/guardian-signup` and create an account with **the same
email** you entered. Their account links to the invite automatically. They can then
see their child, and they'll be asked to confirm tournament participation.

Each guardian has a **Permissions** control. It lists what they can do (see fees,
see evaluations, confirm tournament entries…) with the default on or off, and lets
you switch one for that guardian. **Reset to default** undoes an override.

To give a **player** their own login for viewing their profile, use the link form on
the same tab, with **Their Dula HQ email**. It attaches an account that already
exists, and the player only ever sees their own information.

## Money

### Fees

Fees are charged per player.

1. Open the player, then the **Fees** tab, then **+ Add charge**.
2. Choose the **fee type**, enter the **amount**, and optionally a **due date**.
3. When money comes in, choose **Record payment**, enter the amount (it fills in
   what's still owed), pick **Cash, Bank transfer, Card** or **Other**, and save.
4. If a charge is late, **Mark overdue**.

Don't set a charge's status by hand. It follows the payments you record: paid,
part-paid, overdue or pending.

Guardians are notified when a charge is added, when a payment is recorded, and when
the status changes.

### The Finances tab

**Finances** adds it up across the club: **Collected**, **Outstanding**,
**Overdue charges**, **Expenses** and **Net**. Below the tiles are every fee
charge, and the club's **Expenses**. To record one, choose **+ Add expense** and
fill in a description, category and amount, then **Save expense**. **Delete** takes
one off if it was a mistake.

If your club uses invoices with QR payment (for example an event fee), a
**QR payment invoices** section appears once the club has one. A club with none
never sees it, so you aren't shown two ledgers.

## Meetings, trips, announcements and photos

- **Meetings.** **+ New meeting** takes a title and a location or link. Open one to
  keep its **Notes** and add **Action items**.
- **Trips.** Create a trip by name and add players as passengers. Guardians are
  notified when a player is added to or removed from a trip.
- **Announcements.** Write a **Title** and **Message** and choose the audience. Secretaries and staff can post too (any audience, any team); coaches and team managers post to their own team only.
- **Photos.** The club's albums.

## Ask the platform team for help

Choose **Support →** at the top of the club's page. Describe the problem, and the
platform team's replies appear in the same place.

## When something doesn't work

| You see | What it means |
|---|---|
| *You don't have permission to do that* | Your role doesn't cover it. The table at the top lists what it does |
| *No existing Dula HQ account found* when adding staff | They have no login yet |
| A coach can't see a team | They're not assigned to it. Use **+ Assign to team** |
| **Development** has no way to add a goal for you | By design: coaches write development, you read it |
| A guardian says they can't sign up | Check the email you entered matches the one they're using, and that you chose **Invite** |
| A guardian can't find their child's page | See the note in the [guardian and player guide](guardian-and-player.md) about the address |
| Everything is blank and there's a banner | The organization is suspended. Contact the platform team |

## Not available yet

- Emails to guardians, staff or players. Invitations, reminders and payment
  receipts are shown in the app (and as browser notifications if the person turned
  them on) but never emailed.
- Creating logins or resetting passwords.
- Changing an individual staff member's permissions.
- Listing your club in the public directory yourself (you can take it down, but the IT admin or an organization admin lists it).
