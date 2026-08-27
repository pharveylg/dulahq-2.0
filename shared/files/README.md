# Files (Platform Service)

Backed by **Cloudflare R2** (S3-compatible object storage), not Supabase
Storage — see `docs/architecture-overview.md`'s hosting/storage decision.

## Why R2 instead of Supabase Storage

- R2's free tier: 10GB storage, **and no egress fees** — Supabase
  Storage's free tier is 1GB and (like most object storage) charges for
  bandwidth out. For a platform serving photos/exports to lots of
  guardians/players, egress is the cost that actually adds up.
- Nothing about file storage depends on Postgres/RLS, so moving it off
  Supabase doesn't touch the tenant-isolation model at all — it's a
  clean, low-risk swap, unlike the database itself.

## Usage

See `lib/r2.ts` for `uploadFile`, `getDownloadUrl`, `deleteFile`.

**Important:** R2 has no built-in tenant isolation — the key prefix
convention (`tenants/<tenant_id>/...`) is a naming discipline, not a
security boundary by itself. Every call site must check the caller's
permission (via the existing Postgres RLS policies, e.g.
`membership_export_requests`) *before* calling into this module. Never
trust a key passed from the client.

## Current consumers

- `membership_export_requests.export_file_id` (Club Manager) — once a
  club/guardian's export is generated, the file lives here.
- `public.media` (Club Manager, added 2026-08-27) — club photo gallery.
  Confirmed via the Cloudflare API that the `dula-hq-2-0-files` bucket
  exists (created 2026-08-20) and verified end-to-end (upload, signed-URL
  fetch, delete) against it — this superseded the "no bucket confirmed
  created" note that used to be here.

## Required environment variables

```
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
```

Create these under Cloudflare dashboard → R2 → your bucket → "Manage API
tokens". Use a token scoped to this bucket only, not an account-wide key.
