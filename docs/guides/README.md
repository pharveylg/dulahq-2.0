# Dulà HQ how-to guides

Practical guides for the people who use Dulà HQ, one per role. They tell you what
your role can see and do, how to do the everyday jobs step by step, and what to
do when the app says no.

_Last checked: 2026-09-21, against the app's code, the live database, and the
demo accounts. Where a feature doesn't exist yet, the guide says so instead of
describing it as if it did._

## Which guide is mine?

| If you are… | Read | What you use |
|---|---|---|
| Running the Dulà HQ platform itself | [Platform admin](platform-admin.md) | The platform console at `/platformconsole` |
| The administrator of an organization (the tenant) | [Org admin](org-admin.md) | Clubs, tournaments and staff across your organization |
| Running one club | [Club manager](club-manager.md) | Your club's page at `/c/your-club` |
| The club's technical administrator | [Club IT admin](club-it-admin.md) | The club's IT administration page |
| A coach, assistant coach or team manager | [Coach and team manager](coach-and-team-manager.md) | Your team's page: training, development, rosters |
| A club treasurer, secretary or general staff member | [Club office roles](club-office-roles.md) | Finances, meetings and trips on the club's page |
| Running a tournament | [Tournament organizer](tournament-organizer.md) | The tournament console at `/tm/your-org/your-tournament` |
| Helping run a tournament (treasurer, IT admin, coordinators) | [Tournament staff](tournament-staff.md) | The same console, with the access your role holds |
| A parent, or a player, whose club uses Dulà HQ | [Guardian and player](guardian-and-player.md) | `/guardian` or `/player` |

The demo accounts for most of these roles are listed in
[demo-data-showcase.md](../demo-data-showcase.md).

## The ideas you need first

**Organization (org).** The tenant. One business, league or federation. It owns
clubs and tournaments, and everything inside it is walled off from every other
organization: nobody sees another org's people, players or money.

**Product.** What an org has switched on: **Club** (rosters, teams, fees) and/or
**Tournament** (entries, categories, brackets). The platform admin turns products
on and off. **Courts** is a separate app at `courts.dulahq.app` and isn't a product
an org switches on.

**Club, team, player.** A club has teams; a team has players. A player under 18
has a **guardian** (a parent or carer) who gets the notifications and gives the
consent.

**Tournament, category, entry.** A tournament has categories (age groups or
divisions). A team **enters** a category; the organizer accepts or declines the
entry.

**Role and permission.** Your **role** (coach, club manager, treasurer…) gives you
a default bundle of **permissions**. The app only shows controls you're allowed to
use, and the database enforces it independently, so a control that's missing is
missing on purpose. If you do something you're not allowed to and the app says
*You don't have permission to do that*, that is the app working, not a fault.

**Assigned teams.** Coaches, team managers and other team-level roles only see the
teams they're assigned to. Club managers see every team in their club.

## Signing in

1. Go to `/login`, enter your email and password, and choose **Sign in**.
2. You'll land on the Dulà HQ homepage. What you see there depends on who you are:
   - **Signed in, with an organization:** tiles for Clubs, Tournaments and Courts.
   - **Everyone else** (including guardians and players): the public directory of
     clubs and tournaments. Your own page is a separate address, `/guardian` or
     `/player`. See the [guardian and player guide](guardian-and-player.md) —
     bookmark it, because there is no link to it from the homepage yet.

**Creating an account.** The only sign-up page is for guardians who have been
invited (`/guardian-signup`). There is no self-service sign-up for staff, org
admins or organizers: their login has to exist before they can be added to
anything, and the app links it by email address. Today that login is created
outside the app.

**Forgotten password.** There is no "forgot password" link yet. Ask your
organization's administrator or the Dulà HQ platform team.

## Try any role without an account

`/demo` signs you into a ready-made showcase in one click: a club, a tournament
organizer and a set of people with different roles. Treat it as a sandbox: it can
be re-seeded at any time, which wipes what you changed. Each guide names the
persona to try. The full list, with who sees what, is in
[demo-data-showcase.md](../demo-data-showcase.md).

## When something doesn't work

- **"You don't have permission to do that."** Your role doesn't include it. The
  guide for your role lists what it does include. If you think it should, ask
  whoever manages your organization.
- **A page is blank or an organization has "access paused".** The organization
  has been suspended. A banner at the top says so. Contact the platform team.
- **You can see something but a button is missing.** Some controls are hidden when
  your role can view but not change something. That's deliberate.
- **Anything else.** A club manager or club IT admin can send the platform team a
  support request from the club's **Support** page.

## Keeping these guides honest

The permission tables in each guide are generated from the platform's permission
catalog. To refresh them after the catalog changes:

```
npm run docs:permissions          # rewrite any table that is out of date
npm run docs:permissions:check    # change nothing; fail if a table is stale
```

The test suite runs the check, so a guide can't quietly fall behind the roles it
describes. Everything around the tables is written by hand and carries a "last
checked" date.
