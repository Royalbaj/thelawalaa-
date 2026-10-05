-- Staff sale at the POS: up to this many items in one sale are free (price 0)
-- for a staff member. Set in Admin → Settings → Staff sale; 0 switches the
-- Staff button off. createPosOrder reads it — the screen only asks.
alter table public.app_settings
  add column if not exists staff_free_items integer not null default 2
  check (staff_free_items between 0 and 20);
