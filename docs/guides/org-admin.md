# Org admin guide

For the administrator of an **organization** (the tenant): the business, league or
federation that owns clubs and tournaments on Dulà HQ. You're who the platform
team appointed when they set the organization up.

_Last checked: 2026-09-21 · Try it: sign in at `/demo` as **Org admin** (Jose
Bautista, Usna Gali), which opens your list of clubs._

## What you can and can't do

You're an org admin when the organization lists your sign-in email as its
administrator. That's all it takes; there's nothing to accept.

**You can:**

- Create clubs in your organization.
- Run your organization's tournaments with the **tournament console**: entries,
  categories, finances and staff. In the console you're treated as holding every
  tournament permission.
- See your organization's clubs and who staffs them.

**You can't:**

- Switch products (Club, Tournament) on or off, rename the organization, or
  suspend the organization. That's the platform team.
- See anything belonging to another organization. Nothing crosses that wall.
- Run a club's day-to-day from the club page **unless you're also on its staff**.
  This is the part that surprises people, so it has its own section below.

## Your home page

After you sign in you land on the Dulà HQ homepage with tiles for **Clubs**,
**Tournaments** and **Courts**.

- **Clubs** opens your list of clubs, with the number of staff and teams in each.
- **Tournaments** opens the tournament engine for your organization, at
  `/t/your-org`. That's where brackets and scores live. It is **not** the tournament
  console described below.
- **Courts** opens the separate court-booking app.

Above the tiles, a **Tournaments you manage** strip lists each of your organization's
tournaments with a **Manage** link straight to its console. A console lives at
`/tm/your-org/your-tournament`, and `/tournaments` lists the same tournaments too.

## Put a club or tournament in the public directory

New clubs and tournaments are private. As an org admin you can list either one: on a club's
page, use the **Public directory** card at the top and choose **List publicly**; for a
tournament, open its console and use the **Public listing** tab. Each shows exactly what
people will see, and never any players, guardians, staff or money. The club IT admin and the
tournament IT admin can do the same, and anyone running the club or tournament can take it
down. The platform team can hide a listing that shouldn't be public, and will give a reason.

## Create a club

1. On **Clubs**, choose **New club**. (If you don't see it, your organization
   doesn't have the **Club** product, so ask the platform team.)
2. Enter the **Club name**. The **URL slug** fills in from it (lowercase letters,
   numbers and hyphens); change it if you like. It becomes the club's web address,
   `/c/your-slug`, and has to be unique across the platform.
3. Choose the **Sport**, and the **Organization** if you belong to more than one.
4. Choose **Create club**.

## Appoint the first club manager

A new club has nobody running it. Someone has to be added as its **club manager**,
and you can do that yourself.

1. Open the club and choose its **Staff** tab.
2. Under **Add staff**, enter the person's **Email**, choose **club_manager**, and
   choose **Add**.

The person must **already have a Dulà HQ login**. If they don't, the form says *"No
existing Dula HQ account found… This app can't create new accounts"*, because logins
are created outside the app today.

You'll notice that on a club you don't staff you still see a **No access here** badge
and "My teams (0 of 3)" with every team marked **Not assigned**. That's expected: an
org admin can staff a club without being on its staff. **Add staff** and **Remove** are
the only staff controls you get. Designating a primary coach, renaming the club and
linking teams stay with the club manager.

**You're also the only one who can appoint a club IT admin.** The role picker only
offers it to you — a club manager doesn't see it, and the database refuses it even
if they did. That's deliberate: the [club IT admin](club-it-admin.md) role carries no
business authority, so who gets it is kept out of the business owner's hands, the
same way appointing the first club manager is kept out of theirs.

Once someone is a club manager, they add everyone else. See the
[club manager guide](club-manager.md).

## Create teams

On a club's **Teams** tab, type a **team name**, choose **Grassroots (youth)** or
**Adult**, and choose **Create team**. You can do this as an org admin without being on
the club's staff. The same tab can also **link** a team that already exists in your
organization and isn't yet claimed by a club. Club managers then add players to it.

## Run a tournament

Open `/tournaments` and choose a tournament under **Tournaments you manage**. That
opens the tournament console, which has four tabs.

| Tab | What you do there |
|---|---|
| **Entries** | See every team that entered. **Accept** or **Decline** each one. **Add entry** records a team that registered with you directly |
| **Categories** | Set up the divisions or age groups, each with an entry fee and a capacity |
| **Finance** | See what's billed, collected and outstanding. Record payments you received. Verify or reject payments teams submitted. Set the payment instructions teams read |
| **Staff** | Add and remove the people who help run the tournament, and review the audit trail |

The tournament's brackets, groups and live scores are in the tournament engine.
Use **Open tournament engine** at the top right.

Two facts worth knowing:

- **You can add an entry yourself** (a team that registered by phone or message,
  for example): its name, its category, an optional contact, and optionally an
  invoice for the category's entry fee. It's created as **pending**; accepting it
  is a separate step, so there is always a record of who decided.
- **Accepting an entry invites the team's manager.** If you added a contact whose
  role is team manager, accepting marks them invited, and they can claim access
  when they sign in with that email.

### Appoint an organizer or other tournament staff

1. In the console, open **Staff**.
2. Under **Add staff**, enter the person's **email** and choose their **role**
   (Organizer, Team coordinator, Secretary, Treasurer, Logistics, Communications,
   Volunteer coordinator, Referee coordinator, or IT admin), then **Add**.

They need an existing Dulà HQ account, the same as club staff. **Remove** archives
someone rather than deleting them, so the record of who staffed the tournament is
kept; adding them again restores them. **Suspend** and **Reactivate** pause and
restore a person's access without removing them. You can do that; an organizer
can't, because it belongs to the tournament IT admin role.

You can run the whole console yourself. Appointing an **Organizer** is how you hand
the day-to-day to someone else. An organizer doesn't need to belong to your
organization at all: their access comes only from being tournament staff, and it
covers that tournament only.

### Creating a new tournament

New tournaments are created in the tournament engine (`/t/your-org`), not in the
console. Its brackets, rosters and live scores stay in that app.

## If your organization is suspended

Everything you and your people can open goes blank and a banner says so. Paying an
invoice and asking the platform team for help are deliberately left working, so
contact them.

## When something doesn't work

| You see | What it means |
|---|---|
| Nothing happens, or *No existing Dula HQ account found*, when adding staff | The person has no login yet. Logins are created outside the app |
| **New club** is missing | Your organization has no **Club** product |
| Nothing is under **Tournaments you manage** | Your organization may not have the **Tournament** product, or has no tournaments yet |
| *No Dula HQ account exists for that email* | The person has no login. Logins are created outside the app today |

## Not available yet

- Designating a primary coach, renaming a club and linking teams, which are the club manager's.
- A screen where you see and pay Dulà HQ's own invoices to your organization. The
  platform team sends you the payment instructions.
- Filing a support request yourself. Club managers and club IT admins can; you can
  ask one to file it, or contact the platform team directly.
- Creating logins or resetting passwords.
