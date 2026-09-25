# Public listing of clubs and tournaments

_Written 2026-09-25. Status: **decided, being built.**_

## State when this was written

- The public directory (`/`, `/clubs`, `/tournaments`) reads two views,
  `public_clubs` and `public_tournaments`. Each returns only rows where
  `publicly_listed = true` and the organization is active, and only name, about,
  location, logo or poster, and the organization. **No player, guardian or staff data
  is in either view.**
- **Clubs have no screen that sets the flag.** All four clubs were listed only because
  someone set it in the database. `clubs_admin_write` lets a club manager write any
  column through the API, so the flag was writable, just with nothing offering it.
- **Tournaments do have a "List publicly" checkbox**, in the tournament app's platform
  console and on its creation forms. Only an org admin can write it
  (`tournaments_write` is `is_org_admin`), so a tournament IT admin cannot.
- The earlier guides said "nothing can list a club or tournament publicly". That was
  wrong for tournaments and is corrected with this work.

## Decision

**The owner opts in, and a platform admin can override.** Publishing is a setting held
by the technical administrators:

| Who | Can list | Can unlist | Can block |
|---|---|---|---|
| Club IT admin (`manage_club_listing`) | their club | their club | no |
| Tournament IT admin (`manage_tournament_listing`) | their tournament | their tournament | no |
| Org admin | any club or tournament in the org | yes | no |
| Club manager, organizer | no | yes (taking something down is always safe) | no |
| Platform admin | anything | anything | **yes** |

Blocking is a separate flag (`listing_blocked`, platform admin only). A blocked item
disappears from the directory even if its owner has it switched on, and the owner sees
why. New clubs and tournaments stay private.

## Design

- **Two catalog keys**, not one reused key: `manage_club_listing` (scope club, held by
  `club_it_admin`) and `manage_tournament_listing` (scope tournament, held by
  `tournament_it_admin`). Per-user grants still work for anyone else.
- **`listing_blocked boolean not null default false`** on `clubs` and `tournaments`;
  both views add `and not listing_blocked`.
- **A trigger is the guard**, not the UI. It refuses a change to `listing_blocked`
  unless the caller is a platform admin, and refuses turning `publicly_listed` **on**
  unless the caller holds the listing permission, is an org admin, or is a platform
  admin. Turning it off needs `can_admin_club` or the listing permission. Calls with no
  user (the service role, migrations) pass. This closes the existing hole where any club
  manager could flip the flag through the API.
- **Two RPCs** so the IT admin, who has no table write access, can act:
  `set_public_listing(kind, id, listed)` and `set_listing_block(kind, id, blocked,
  reason)`. Both authorize first, write the flag, and audit
  (`club.listing.changed`, `tournament.listing.changed`, `*.listing.blocked`).
- **UI:** a "Public directory" card with a preview of exactly what becomes public and a
  warning if the logo or about text is missing, on the club IT page and in the
  tournament console; and a Listings tab in the platform console with block/unblock.

## Tests

Who can turn listing on and off, that a club manager's direct API write is refused, that
only a platform admin can block, that a blocked item is absent from the anonymous views,
and that a suspended organization stays hidden.

## Open

- Whether the club manager should also be able to list. Held back on purpose: it can be
  granted per user, or added to the role's defaults later.
