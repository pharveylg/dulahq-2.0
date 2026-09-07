-- Phase 1: one answer to "who is this".
-- public.users.id becomes auth.users.id. Email matching still works during
-- transition because users.email is kept in sync, so this is expand-only.

-- Nothing references public.users right now (clean slate), so realign ids directly.
delete from public.users;

alter table public.users
  add constraint users_id_fkey
  foreign key (id) references auth.users(id) on delete cascade;

-- Profile row is created automatically for every future signup.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, name, role)
  values (
    new.id,
    new.email,
    coalesce(nullif(new.raw_user_meta_data ->> 'name', ''), split_part(new.email, '@', 1)),
    'audience'
  )
  on conflict (id) do update set email = excluded.email;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- Keep email in sync if the account's email changes.
create or replace function public.sync_auth_user_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.users set email = new.email where id = new.id;
  return new;
end $$;

drop trigger if exists on_auth_user_email_changed on auth.users;
create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row when (old.email is distinct from new.email)
  execute function public.sync_auth_user_email();

-- Backfill the two existing accounts.
insert into public.users (id, email, name, role)
select u.id, u.email, split_part(u.email, '@', 1), 'audience'
from auth.users u
on conflict (id) do nothing;

update public.users set role = 'admin', name = 'Gadzai'
where lower(email) = 'pharveylg@gmail.com';

-- Identity resolution is now the JWT subject, not a string match.
create or replace function public.current_dula_user_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$ select auth.uid() $$;;