-- org_storage_events.org_id was created without ON DELETE CASCADE (confdeltype 'a'),
-- unlike every other org_id foreign key in the schema. Deleting any org with recorded
-- uploads therefore failed, which blocked the reseed-showcase-demo workflow's org wipe.
-- A storage event belongs to the org that uploaded it, so it should go with that org.
alter table public.org_storage_events
  drop constraint org_storage_events_org_id_fkey,
  add constraint org_storage_events_org_id_fkey
    foreign key (org_id) references public.organizations(id) on delete cascade;
