# Coach and team manager guide

For the people who run a team day to day: coaches, assistant coaches and team
managers. It covers training and attendance, player development, and the tournament
roster, and it spells out where a coach and a team manager differ, because on the
same team they do different jobs.

_Last checked: 2026-09-21 · Try it: sign in at `/demo` as **Coach** (Rodrigo
Dagohoy) or **Team manager** (Benigno Kintanar). Both are on U15 Girls, so you can
compare the two roles on the same roster._

## Who does what

| | Coach | Assistant coach | Team manager |
|---|---|---|---|
| Owns the football side | Yes | Supports the coach | No |
| Records attendance | Yes | Yes | **No** |
| Writes goals, evaluations, private notes | Yes | No | **No** |
| Schedules training | Yes | No | Yes |
| Edits a player's football profile | Yes | No | Yes |
| Prepares, asks guardians, and finalizes a tournament roster | Yes | No | Yes |
| Documents and membership for the team | Medical documents only | Medical documents only | Yes |
| Sees the team's fee status | No | No | Yes (their team only) |
| Assigns coaches and staff to their team | No | No | Yes |

The three tables below are the exact defaults, generated from the platform's
permission catalog. All of it applies **only to the teams you're assigned to**.

### Coach

<!-- BEGIN permissions: club:coach -->
_Generated from the platform permission catalog. Edit the catalog, not this table — run `npm run docs:permissions` to refresh it._

| Permission | What it allows | Reach |
|---|---|---|
| **Add evaluation** | Record a player evaluation and skill ratings | Assigned teams only |
| **Add player feedback** | Add player-visible coach feedback | Assigned teams only |
| **Add private coach note** | Add a private note not visible to player/guardian | Assigned teams only |
| **Edit player football profile** | Edit position, preferred foot, and other football-profile fields | Assigned teams only |
| **Export tournament roster** | Generate a TXT/PDF of a finalized tournament roster | Assigned teams only |
| **Fill tournament roster** | Select players from the team roster onto a proposed tournament roster | Assigned teams only |
| **Finalize tournament roster** | Finalize a tournament roster once eligible players are acknowledged | Assigned teams only |
| **Manage attendance** | Take and edit training attendance | Assigned teams only |
| **Manage development** | Create and edit development goals | Assigned teams only |
| **Manage lineup** | Select match lineup and substitutes | Assigned teams only |
| **Manage match** | Record match events, minutes, and statistics | Assigned teams only |
| **Manage training** | Create and schedule training sessions and session plans | Assigned teams only |
| **Request guardian acknowledgement** | Submit a proposed tournament roster for guardian acknowledgement | Assigned teams only |
| **View attendance** | View training attendance records | Assigned teams only |
| **View development** | View development goals, evaluations, and progress | Assigned teams only |
| **View medical/safety info** | View medical alerts and safety information for assigned players | Assigned teams only |
| **View player** | View players on an assigned team | Assigned teams only |
| **View team** | View an assigned team's roster and schedule | Assigned teams only |
| **View tournament** | View tournaments an assigned team is entered in | Assigned teams only |
<!-- END permissions -->

### Assistant coach

<!-- BEGIN permissions: club:assistant_coach -->
_Generated from the platform permission catalog. Edit the catalog, not this table — run `npm run docs:permissions` to refresh it._

| Permission | What it allows | Reach |
|---|---|---|
| **Manage attendance** | Take and edit training attendance | Assigned teams only |
| **View attendance** | View training attendance records | Assigned teams only |
| **View development** | View development goals, evaluations, and progress | Assigned teams only |
| **View medical/safety info** | View medical alerts and safety information for assigned players | Assigned teams only |
| **View player** | View players on an assigned team | Assigned teams only |
| **View team** | View an assigned team's roster and schedule | Assigned teams only |
| **View tournament** | View tournaments an assigned team is entered in | Assigned teams only |
<!-- END permissions -->

### Team manager

<!-- BEGIN permissions: club:team_manager -->
_Generated from the platform permission catalog. Edit the catalog, not this table — run `npm run docs:permissions` to refresh it._

| Permission | What it allows | Reach |
|---|---|---|
| **Assign staff to a team** | Add or remove coaches and staff on a team you are responsible for | Assigned teams only |
| **Edit player football profile** | Edit position, preferred foot, and other football-profile fields | Assigned teams only |
| **Export tournament roster** | Generate a TXT/PDF of a finalized tournament roster | Assigned teams only |
| **Fill tournament roster** | Select players from the team roster onto a proposed tournament roster | Assigned teams only |
| **Finalize tournament roster** | Finalize a tournament roster once eligible players are acknowledged | Assigned teams only |
| **Manage match** | Record match events, minutes, and statistics | Assigned teams only |
| **Manage team documents** | Upload and review documents for players on an assigned team | Assigned teams only |
| **Manage team membership** | Manage registration and membership status for players on an assigned team | Assigned teams only |
| **Manage training** | Create and schedule training sessions and session plans | Assigned teams only |
| **Request guardian acknowledgement** | Submit a proposed tournament roster for guardian acknowledgement | Assigned teams only |
| **View attendance** | View training attendance records | Assigned teams only |
| **View development** | View development goals, evaluations, and progress | Assigned teams only |
| **View medical/safety info** | View medical alerts and safety information for assigned players | Assigned teams only |
| **View player** | View players on an assigned team | Assigned teams only |
| **View team** | View an assigned team's roster and schedule | Assigned teams only |
| **View team finances** | View fee status, balances and financial summaries for an assigned team | Assigned teams only |
| **View tournament** | View tournaments an assigned team is entered in | Assigned teams only |
<!-- END permissions -->

The catalog also lists permissions for recording matches and choosing a match lineup.
**No screen uses them yet**, so there's nothing to click.

## Finding your team

Open the club from **Clubs**, or go straight to `/c/your-club`. The **Teams** tab
lists your teams as **My teams (x of y)**: the ones you're assigned to open, and every
other team says **Not assigned →**. Your **Overview** tab shows what needs doing today
across your teams only.

If a team you should be on says **Not assigned**, the club manager needs to assign
you. You can open an unassigned team's page by its address, but it shows *0 players*
and *"You can manage teams you're assigned to — ask a club admin to assign you to
this one."*

A team page has three tabs: **Roster**, **Training** and **Tournaments**.

## The roster and player profiles

Under **Roster** you can add a player with a **Player name** (required), **Jersey #**,
**Position** and **Age**.

Choose a player and a summary panel opens, with **Overview, Development, Fees,
Membership, Documents** and **Family**. Its **Development** tab has **Open development
profile →**, which opens the player's **full profile page**, with the same six tabs
and the full development tools:

| Tab | What it's for |
|---|---|
| **Overview** | A snapshot: football profile, attendance, active goals, upcoming sessions, recent activity |
| **Development** | Goals, evaluations, notes and a timeline. Coaches write; others read |
| **Fees** | Charges and payments. A team manager can see their team's fee status; coaches see nothing here |
| **Membership** | Registration status, and the player's team history |
| **Documents** | Uploaded forms and their review status |
| **Family** | The player's guardians and login |

You can edit a player's football profile (secondary position, preferred foot, date
of birth, development status) from the **Development** tab if your role allows it.

## Training and attendance

### Schedule a session

1. Open **Training** and fill in the form: **start time**, **minutes** (60 by
   default), an optional **theme**, **objective** and **notes**.
2. Choose **Schedule session**.

On a scheduled session's row, choose **Mark done** when it's happened or **Cancel** if it won't.

### Plan the session with drills

Open a session. Under **Drills**, choose **Add a drill from the library…** and **Add**.
**Remove** takes one off. The club's drills live in its **Drill library →**.
A session with no drills shows up on the club manager's Overview as needing a plan.

### Take attendance (coaches and assistant coaches)

On a session's page, each player has a status:
**No response, Present, Absent, Excused, Late, Injured, Suspended**.

The attendance percentage counts **Present** and **Late** as attended and leaves
**Injured** and **Suspended** out of the sum altogether. **Absent, Excused** and
**No response** count against it. A team manager can see attendance but can't record it.

## Player development (coaches)

Open a player, then **Development**. It has four sub-tabs: **Goals**, **Evaluations**,
**Notes** and **Timeline**.

- **Goals.** **+ Add goal** takes a goal (for example *Improve weak-foot passing*), an
  optional related skill from the club's skill framework, a **start** and **target**
  level from 1 to 5, who can see it, and **success criteria**. Each goal has a status:
  *not started, in progress, on track, needs attention, achieved, archived*. Goals
  marked **needs attention** show up on the club manager's Overview.
- **Evaluations.** **+ Add evaluation** records a date, an optional **period** (for
  example *Fall 2026*), overall **Technical, Tactical, Physical** and **Mental**
  scores from 1 to 5 (halves allowed), a rating for individual skills, and free text
  for **Strengths** and **Development areas**.
- **Notes.** A short note or feedback, with who can see it.

**Who can see a goal, evaluation or note is your choice**, and it defaults to
**Coach only**:

| Setting | Who sees it |
|---|---|
| Coach only | The coach |
| Club staff | Staff at the club |
| Player | The player |
| Parent | The guardians |
| Player + parent | Both |

A guardian or player is notified when something they can see is added. A **Coach
only** entry never notifies anyone and can't be opened by a family. Team managers
can't write any of this.

## Tournament rosters

A team enters a tournament through the organizer; you don't register the team. Once
it has an entry, you build its roster. Open the team's **Tournaments** tab and choose
the entry. It shows a status for the whole roster (**Draft, Proposed, Awaiting
guardians, Ready for review, Partly finalized, Finalized**), how many players are
proposed and finalized, and its **revision** number.

Coaches and team managers both do all of the steps below.

1. **Propose players.** Under **Add players**, tick who you want and choose
   **Propose [n] players**. Anyone under 18 is marked **Needs guardian consent**. If
   they have no guardian on file they're marked **No guardian on file**, and they can't
   go on until the club adds one.
2. **Ask guardians.** Choose **Ask guardians ([n])**. Each guardian gets a request in
   the app to **Confirm participation** or **Decline**. You're notified straight away
   if one declines.
3. **Finalize.** When guardians have confirmed, choose **Finalize ([n])**. Players
   who are 18 or over go straight through. A minor whose guardian hasn't confirmed
   **isn't finalized**; they simply aren't ready yet, and you'll see them as
   **Awaiting guardian**.
4. **Change it later.** To take someone off a finalized roster, choose **Withdraw**
   next to them, give a **reason**, and **Confirm withdrawal**. They stay on record as
   **Withdrawn** and the roster moves to a new revision. To bring them back, propose
   and finalize them again.

Each player shows where they are: **Not selected, Proposed, Awaiting guardian,
Guardian confirmed, Guardian declined, Withdrawn, Finalized**. **Export roster (TXT)**
downloads the finalized roster as a text file.

These states are for **visibility**. Nothing forces the order, so a coach can finalize
before every guardian has answered, and the app only lets through players whose
consent is in.

## Documents and membership

Where your role allows it, these are on the player's **Documents** and **Membership**
tabs:

- A **coach** can upload and review **medical** documents (medical clearance, allergy
  disclosure, insurance card) for their team.
- A **team manager** can upload and review documents of every kind, and manage
  registration and membership status, for their team.
- **Moving a player to another team is the club manager's job**, not a team
  manager's: it needs the club-wide membership permission, which a team manager
  doesn't hold. Ask the club manager.

## What guardians see

Guardians are notified when you add a goal, evaluation or note they're allowed to see,
change a fee or membership, ask them about a tournament, or move their child. They
never see **Coach only** items or other players. Their view is in the
[guardian and player guide](guardian-and-player.md).

## When something doesn't work

| You see | What it means |
|---|---|
| **Not assigned →** on your team | The club manager needs to assign you |
| No **Development** controls | You're a team manager or assistant coach; only coaches write development |
| No attendance dropdowns | You're a team manager, who can't record attendance |
| A player is stuck on **Needs guardian consent** | The guardian hasn't confirmed, or there isn't one on file. Ask the club manager to add and invite them |
| **Finalize (0)** | Nobody on the proposed list is ready yet: minors are still awaiting a guardian |
| *You don't have permission to do that* | Your role doesn't include it. The tables at the top list what it does |

## Not available yet

- Recording matches, choosing a lineup, and match statistics. The permissions exist
  but no screen does.
- A PDF export of a roster. The export is a text file.
- Emails to guardians. Requests are shown in the app and as device notifications.
