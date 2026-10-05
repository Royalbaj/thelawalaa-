-- Can the counter (pos_user) cancel orders? Switched in Admin → Settings →
-- Feature flags (super_admin only). Default true = how it worked before.
-- Enforced in adminUpdateOrderStatus (server) and the POS hides its Cancel
-- button when it's off. The manager (super_admin) can always cancel.
alter table public.app_settings
  add column if not exists pos_can_cancel boolean not null default true;
