# Club IT admin guide

For the technical administrator of a club. You keep people's access working and
you're the one who can answer "why can't I see that?". You have **no business
authority at all**: you can't see players, fees or teams, and you can't add or
remove staff. That separation is deliberate, so the person who looks after
accounts isn't automatically someone who can read a child's records.

_Last checked: 2026-09-21 · Try it: sign in at `/demo` as **Club admin (IT)**
(Luisa Villar, Usna Gali FC), which opens the club's IT administration page._

## What you can and can't do

You can inspect what any member of the club is allowed to do, pause and restore
their access, read the club's audit trail, and ask the platform team for help.

You **can't**: see players, guardians, fees, sessions or any football or financial
record; add, remove or change the role of staff (the club manager does that);
create logins or reset passwords; or act as anyone else.

### Your default permissions

<!-- BEGIN permissions: club:club_it_admin -->
_Generated from the platform permission catalog. Edit the catalog, not this table — run `npm run docs:permissions` to refresh it._

| Permission | What it allows | Reach |
|---|---|---|
| **Manage public listing** | Show the club in, or remove it from, the public directory | Whole club |
| **Submit support request** | Escalate an issue to the Dula HQ platform team on behalf of the organization | Whole club |
| **Suspend/reactivate account** | Temporarily suspend or reactivate a staff member's access without removing them from the club | Whole club |
| **View as another user** | Start a logged, time-limited session to inspect another user's effective access for troubleshooting | Whole club |
| **View audit log** | Review administrative and security activity for the club | Whole club |
<!-- END permissions -->

## Getting to the IT page

Open the club's page (`/c/your-club`) and choose **IT administration →**. The button
only appears for people who hold at least one of the permissions above. The page
opens with *"Accounts and access troubleshooting for [club]. Business settings are
managed by the club manager."* It has four sections: **View as a member**,
**Recent view-as sessions**, **Accounts** and **Audit log**.

## Find out what someone can and can't do (View as a member)

Use this when someone says "I can't open Finances" or "I can't see my team". You
don't sign in as them and you can't act for them. You get a readout of exactly what
their role allows.

1. Under **View as a member**, choose the person from **Choose a member…**.
2. Type a **Reason (recorded in the audit log)**. A reason is required; the form
   says *A reason is required — it goes into the audit log.* if you leave it blank.
3. Choose the start button.
4. The panel now says **Viewing as [name]**, with your reason and when the session
   **expires**, and shows the readout:
   - **Role**, with markers if they're club-wide, a player, or a guardian.
   - **Assigned teams.** *No specific assignment — club-wide by role* means their
     role covers every team. *None. Team-scoped permissions will not apply
     anywhere* means a coach or team manager has been given no team, which is the
     most common reason someone "can't see anything".
   - **Club-wide permissions** and **Team permissions** they hold.
   - **Does NOT have**: what they lack. That list is usually the answer.
5. Choose **End session** when you're done. Otherwise it ends by itself after
   **30 minutes**.

Everything about the session is logged **under your identity** with your reason,
never theirs.

If you see *"You can review this club's audit trail, but starting a view-as session
needs the 'View as another user' permission"*, your role lacks that permission;
ask the platform team.

Below the panel, **Recent view-as sessions** lists earlier sessions with the time and
reason, and marks any still live.

### Common questions, and where the answer is

| Someone says | Look at |
|---|---|
| "I can't see my team's players" | **Assigned teams**. If it says *None*, the club manager needs to assign them |
| "I can't open Finances" | **Does NOT have**: *View finances* |
| "I can't record attendance" | **Does NOT have**: *Manage attendance*. Team managers never hold it; coaches and assistant coaches do |
| "I can see everything, is that right?" | **Role** says **club-wide**: a club manager sees every team |
| "A coach can see the wrong team" | **Assigned teams** lists what they're on |

## Pause or restore someone's access (Accounts)

**Accounts** lists the club's active and suspended staff, each with their email and
role. You aren't in the list: nobody suspends themselves.

- Choose **Suspend** to cut a person's access to the club immediately. They keep
  their login and their history; they just can't do anything here.
- Choose **Reactivate** to restore it. It takes effect at once.

Suspending is reversible and is **yours**. **Removing** someone permanently is the
club manager's decision. They archive the person, which ends their access while
keeping the record. Use suspension for "pause this account while we look
into it".

## List the club in the public directory

At the top of the IT page is **Public directory**. A new club is **private**: only its own
people can find it. Choose **List publicly** and it appears for everyone, signed in or not.
The card first shows exactly what people will see (name, about text, location, logo) and
warns about anything not set yet, and says plainly that no players, guardians, staff or
fees are ever shown. **Remove from public directory** takes it down again.

The listing is yours and the organization admin's to switch on. The club manager can take
it down but can't list it. Every change is recorded in the audit log. If the platform team
has hidden the club, the card says **blocked**, gives their reason, and keeps your setting
underneath so it applies again once they lift the block.

## Read the audit trail

**Audit log** shows what has happened at this club: the action, the time, who did
it, and what it was done to. It covers changes such as staff being
added or archived, team assignments and primary-coach changes, account suspensions,
and view-as sessions (starts and ends).

Nobody can edit or delete an audit entry, including you. It only lists entries
tagged to **this club**, so an organization with several clubs doesn't see one
club's activity in another's page. If the log is empty it says *No recorded
activity for this club yet.*

## Ask the platform team for help

If a problem is beyond your reach, choose **Support →** on the club's page, describe
it, and the platform team's replies appear in the same place.

## When something doesn't work

| You see | What it means |
|---|---|
| No **IT administration →** button | Your role doesn't include an IT permission. Ask the club manager |
| You can open the page but not start a session | You lack *View as another user* |
| Someone you expect isn't in **Choose a member…** | They've been archived, or aren't staff at this club |
| *You don't have permission to do that* | That's outside the IT role. Business changes go to the club manager |

## Not available yet

- Creating logins, inviting people by email, or resetting passwords and multi-factor
  authentication. These need email delivery, which isn't set up.
- Signing someone out of their open sessions.
- Changing a person's role or permissions.
