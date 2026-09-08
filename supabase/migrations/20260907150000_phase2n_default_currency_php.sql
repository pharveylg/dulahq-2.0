-- Dula HQ's branding and primary market is Filipino; USD was never a
-- deliberate choice, just the column default nobody had touched. Existing
-- rows (all demo/seed data) are untouched -- this only changes what new
-- inserts get when currency isn't specified explicitly.
alter table public.fee_charges alter column currency set default 'PHP';
alter table public.expenses alter column currency set default 'PHP';
