-- Found live: the platform console's support queue silently rendered "no
-- requests" for an org that had just filed one -- no error surfaced
-- because the page destructured only `data`, not `error` (exactly the
-- silent-failure shape flagged repeatedly elsewhere in this project).
--
-- Root cause: created_by/author_user_id referenced auth.users(id), not
-- public.users(id) -- the established convention every other user-
-- referencing FK in this schema uses (club_staff.user_id, etc.) precisely
-- because auth.users isn't exposed to PostgREST's embedding, so
-- `users!created_by(name, email)` had no relationship to find. public.users
-- IS auth.users.id (phase1 identity unification) -- retargeting changes
-- nothing about what the column stores, only what PostgREST can embed.
alter table public.support_requests drop constraint support_requests_created_by_fkey;
alter table public.support_requests
  add constraint support_requests_created_by_fkey foreign key (created_by) references public.users(id) on delete cascade;

alter table public.support_request_messages drop constraint support_request_messages_author_user_id_fkey;
alter table public.support_request_messages
  add constraint support_request_messages_author_user_id_fkey foreign key (author_user_id) references public.users(id) on delete cascade;
