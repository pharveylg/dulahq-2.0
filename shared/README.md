# Dula HQ Platform Services

This folder was meant to hold infrastructure shared across both the Club
Manager and Tournament Manager apps: Identity, Tenancy, Organizations,
Subscriptions, Entitlements, Permissions, Billing, Notifications,
Messaging, Media, Files.

**In practice, only Files (`files/`, backed by R2) ever ended up here.**
Everything else in that original list is real and live — see `CLAUDE.md` —
but it was built directly in this app's own `src/lib/` and Postgres, not
extracted into this layer. That follows the rule below: the Tournament
Manager engine stays frozen and proxied (`CLAUDE.md` §8) rather than
calling into this app's code, so it never became the second consumer that
would justify pulling identity, permissions, billing, etc. out here.

Extract a service into this layer only when the concept is genuinely
shared — don't build here speculatively ahead of a real second consumer.
