# Dula HQ

A club and tournament management platform for Philippine grassroots football
(and, as other sports come online, beyond it). This repo — `dulahq-2.0` — is
the Club Manager app: Next.js 15/16 (App Router) + Supabase, deployed at
**`dulahq.app`** (break-glass URL: `dulahq-20.vercel.app`).

A sibling repo, `pharveylg/DulaHQ`, is the original Tournament Manager — a
single-file Vite app that is **frozen by design**. This repo proxies it at
`/t/...` and `/platformconsole` rather than rewriting or absorbing it; see
"Architecture" below for why.

## Where to actually read about this project

**[`CLAUDE.md`](CLAUDE.md)** is the real, continuously-updated source of
truth: every decision, migration, bug found and fixed, and open question,
in the order it happened, verified against the live database rather than
assumed. Nothing else in this repo is kept as current. Start there, not here.

Other living references:

- **[`docs/CURRENT_ARCHITECTURE.md`](docs/CURRENT_ARCHITECTURE.md)** — a
  snapshot overview of the schema, RBAC model and app structure. Faster to
  read than `CLAUDE.md` for orientation, but `CLAUDE.md` is authoritative
  where the two ever disagree.
- **[`docs/guides/`](docs/guides/)** — one how-to guide per role (platform
  admin, org admin, club manager, coach, guardian, tournament organizer,
  etc.), written from the live code and database. Each names what it can't
  do yet rather than glossing over gaps. Permission tables inside them are
  generated (`npm run docs:permissions`) from the live catalog, not
  hand-typed — don't edit them directly.
- **[`docs/proposals/`](docs/proposals/)** — design-before-build records for
  larger features, each with its decisions and a build status.
- **[`docs/demo-data-showcase.md`](docs/demo-data-showcase.md)** — the demo
  accounts and data `/demo` signs into.

## Architecture, in brief

- One Supabase project (`zytyakbgwaegvftblkcn`) backs both apps and both
  product lines (Club, Tournament). RLS is the authorization boundary; see
  `CLAUDE.md` §4–§5 for the permission model and the API surface the app
  code must use.
- The Tournament Manager engine stays unrewritten and proxied — it works,
  and porting a ~500KB single-file app into this one is pure risk with no
  benefit. New Tournament-side features (the organizer console, entrant
  portal, finance queue, etc.) are instead built natively in *this* repo
  against the shared database, reached at `/tm/...`.
- A shared session cookie (`@supabase/ssr` format) lets one sign-in work
  across both apps on the same origin — see `CLAUDE.md` §6.B.

## Running the app

```bash
npm install
npm run dev
```

Needs `.env.local` — copy `.env.example` and fill in the Supabase project
keys (dashboard → Project Settings → API for project `zytyakbgwaegvftblkcn`),
plus R2 and Resend credentials for file storage and outbound email. See
`.env.example` for the full list and what each one is for.

## Tests

```bash
npm run test:unit    # pure-function tests — no network
npm run test:rls      # RLS/RBAC suite — runs against the LIVE project (see
                       # CLAUDE.md §1: Supabase branching isn't available on
                       # the free tier), using rls-test-/@rls-test.local
                       # fixtures that clean themselves up
```

`npm run build` and `npx tsc --noEmit` are the other two checks run before
anything ships; `tsc` deliberately excludes `tests/` (a long-standing,
tracked batch of type errors in the RLS suite unrelated to app code).

## Constraints worth knowing before changing infrastructure

Free-tier-first by deliberate choice (Vercel hobby, Supabase free, R2's
always-free allowance) — see `CLAUDE.md` §8 for the specifics and what each
one means for how you build (no automatic Supabase backups or PITR, a hobby
bandwidth cap, email sent via Resend rather than Supabase's own rate-limited
mailer, and so on).
