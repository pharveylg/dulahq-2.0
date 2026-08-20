# Dula HQ Platform Services

Shared infrastructure used by both Tournament Manager and Club Manager:
Identity, Tenancy, Organizations, Subscriptions, Entitlements,
Permissions, Billing, Notifications, Messaging, Media, Files.

See [`../docs/architecture-overview.md`](../docs/architecture-overview.md)
Section 4 for what each service is responsible for.

**Current status:** Identity and Tenancy exist in early form in the
`dula-hq` repo (`auth.users`, `tenants`, `tenant_users`, RLS via
`is_tenant_member()`). Everything else in this folder is not built yet.

Extract a service into this layer only when the concept is genuinely
shared — don't build here speculatively ahead of a real second consumer.
