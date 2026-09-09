alter table public.permissions drop constraint permissions_scope_check;
alter table public.permissions add constraint permissions_scope_check
  check (scope = any (array['club', 'team', 'player', 'tournament']));
