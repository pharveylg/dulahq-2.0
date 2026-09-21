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

**Bookmark two addresses.** Nothing on the homepage links to your tournament
console yet:

- `/tournaments` lists **Tournaments you manage** and links each to its console.
- A tournament's console is at `/tm/your-org/your-tournament`.

## Create a club

1. On **Clubs**, choose **New club**. (If you don't see it, your organization
   doesn't have the **Club** product, so ask the platform team.)
2. Enter the **Club name**. The **URL slug** fills in from it (lowercase letters,
   numbers and hyphens); change it if you like. It becomes the club's web address,
   `/c/your-slug`, and has to be unique across the platform.
3. Choose the **Sport**, and the **Organization** if you belong to more than one.
4. Choose **Create club**.

## Appoint the first club manager

A new club has nobody running it. Someone has to be added as its **club manager**.
The new-club page tells you to "add yourself or someone else as club_manager on
the club's page".

**Today an org admin can't do that from the club page.** Open a club you don't
staff and you'll see a **No access here** badge, a "My teams (0 of 3)" list with
every team marked **Not assigned**, and no **Add staff** form. Only a club manager
(or a platform admin) sees that form.

What to do instead, until this is fixed:

- **Ask the platform team** to add the club manager. A platform admin can open the
  club's **Staff** tab and add them.
- The person being added must **already have a Dulà HQ login**. The form looks the
  person up by email and says *"No existing Dula HQ account found… This app can't
  create new accounts"* if there isn't one.

Once someone is a club manager, they add everyone else. See the
[club manager guide](club-manager.md).

## Create teams

This app has **no "create team" button**. A club's **Teams** tab can only **link a
team that already exists** in your organization and isn't yet claimed by a club
(you give it a URL slug). Club managers can then add players to it. A club with no
linkable team therefore can't get one from this app today.

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
| **Add staff** is missing on a club | You're not on that club's staff. See [Appoint the first club manager](#appoint-the-first-club-manager) |
| **New club** is missing | Your organization has no **Club** product |
| Nothing is under **Tournaments you manage** | Your organization may not have the **Tournament** product, or has no tournaments yet |
| *No Dula HQ account exists for that email* | The person has no login. Logins are created outside the app today |

## Not available yet

- Adding the first club manager from the club page (see above).
- A screen where you see and pay Dulà HQ's own invoices to your organization. The
  platform team sends you the payment instructions.
- Filing a support request yourself. Club managers and club IT admins can; you can
  ask one to file it, or contact the platform team directly.
- Creating teams from scratch, and creating logins or resetting passwords.
