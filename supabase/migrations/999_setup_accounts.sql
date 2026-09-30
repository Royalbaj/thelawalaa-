-- Bootstrap accounts for a fresh environment only. Every account gets
-- a random password NO ONE ever sees or stores — not even this script.
-- Whoever owns each address must go through /auth/forgot-password to
-- set their own. This is deliberate: a real, working password must
-- never be committed to a migration file (a previous version of this
-- file did exactly that, with a fixed plaintext value that had already
-- shipped to production — see info.md for the incident note and the
-- required cleanup).
DO $$
DECLARE
  super_id uuid := gen_random_uuid();
  pos_id   uuid := gen_random_uuid();
  driver_id uuid := gen_random_uuid();
BEGIN
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES (super_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'superadmin@thelawalaa.com', crypt(encode(gen_random_bytes(24), 'base64'), gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now())
  ON CONFLICT (email) DO UPDATE SET email_confirmed_at = now();

  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES (pos_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pos@thelawalaa.com', crypt(encode(gen_random_bytes(24), 'base64'), gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now())
  ON CONFLICT (email) DO UPDATE SET email_confirmed_at = now();

  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES (driver_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'driver@thelawalaa.com', crypt(encode(gen_random_bytes(24), 'base64'), gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now())
  ON CONFLICT (email) DO UPDATE SET email_confirmed_at = now();
END $$;

-- Update the profiles that were automatically created by the trigger.
-- "Staff POS" is a pos_user (its own email says so) — a prior version
-- of this file wrongly set it to 'admin'; see 018_restore_super_admin.sql
-- for the one-time fix to the row that mistake already created in
-- production.
UPDATE public.profiles SET role = 'super_admin', full_name = 'The Super Admin' WHERE id = (SELECT id FROM auth.users WHERE email = 'superadmin@thelawalaa.com');
UPDATE public.profiles SET role = 'pos_user', full_name = 'Staff POS' WHERE id = (SELECT id FROM auth.users WHERE email = 'pos@thelawalaa.com');
UPDATE public.profiles SET role = 'delivery_driver', full_name = 'Rider Delivery' WHERE id = (SELECT id FROM auth.users WHERE email = 'driver@thelawalaa.com');

-- Update the user's personal account to confirm email so they don't need the link
UPDATE auth.users SET email_confirmed_at = now() WHERE email = 'gairebishal5@gmail.com' AND email_confirmed_at IS NULL;
