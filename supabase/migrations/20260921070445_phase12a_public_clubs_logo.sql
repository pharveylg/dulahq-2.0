-- The public homepage is moving from text lists to logo tiles, but public_clubs
-- had no way to say what a club's logo is. Two columns, appended at the end (a
-- CREATE OR REPLACE VIEW may only add columns after the existing ones):
--   logo_key      the R2 object key in clubs.branding ->> 'logoKey'. R2 objects
--                 are private, so this is only a path -- the app signs a URL
--                 for it server-side. Exposing the key grants nothing by itself.
--   org_logo_url  the owning org's logo, the fallback when a club has none
--                 (the club-over-org precedence in src/lib/club-branding.ts).
-- security_invoker is restated because it is part of what makes this view safe
-- for anon: it reads clubs through the caller's own RLS, not the owner's.
create or replace view public.public_clubs with (security_invoker = true) as
select c.id,
       c.name,
       c.slug,
       c.about,
       c.location,
       c.sport_id,
       o.slug as org_slug,
       o.name as org_name,
       o.accent as org_accent,
       c.branding ->> 'logoKey' as logo_key,
       o.logo_url as org_logo_url
  from public.clubs c
  join public.organizations o on o.id = c.org_id
 where c.publicly_listed = true and o.status = 'active';
