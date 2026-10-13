# Dula HQ Platform Services

Shared infrastructure used by both Tournament Manager and Club Manager:
Identity, Tenancy, Organizations, Subscriptions, Entitlements,
Permissions, Billing, Notifications, Messaging, Media, Files.

**Current status (needs a refresh — see note in the root README):** this list
predates most of what the root `CLAUDE.md` now documents as live (identity,
entitlements, permissions, billing, notifications are all built).

Extract a service into this layer only when the concept is genuinely
shared — don't build here speculatively ahead of a real second consumer.
