DO $$
DECLARE
  super_id uuid := gen_random_uuid();
  admin_id uuid := gen_random_uuid();
  driver_id uuid := gen_random_uuid();
BEGIN
  -- Insert Super Admin
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES (super_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'superadmin@thelawalaa.com', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now())
  ON CONFLICT (email) DO UPDATE SET encrypted_password = crypt('password123', gen_salt('bf')), email_confirmed_at = now();

  -- Insert Admin / POS User
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES (admin_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pos@thelawalaa.com', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now())
  ON CONFLICT (email) DO UPDATE SET encrypted_password = crypt('password123', gen_salt('bf')), email_confirmed_at = now();

  -- Insert Driver
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES (driver_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'driver@thelawalaa.com', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now())
  ON CONFLICT (email) DO UPDATE SET encrypted_password = crypt('password123', gen_salt('bf')), email_confirmed_at = now();
END $$;

-- Update the profiles that were automatically created by the trigger
UPDATE public.profiles SET role = 'super_admin', full_name = 'The Super Admin' WHERE id = (SELECT id FROM auth.users WHERE email = 'superadmin@thelawalaa.com');
UPDATE public.profiles SET role = 'admin', full_name = 'Staff POS' WHERE id = (SELECT id FROM auth.users WHERE email = 'pos@thelawalaa.com');
UPDATE public.profiles SET role = 'delivery_driver', full_name = 'Rider Delivery' WHERE id = (SELECT id FROM auth.users WHERE email = 'driver@thelawalaa.com');

-- Update the user's personal account to confirm email so they don't need the link
UPDATE auth.users SET email_confirmed_at = now() WHERE email = 'gairebishal5@gmail.com' AND email_confirmed_at IS NULL;
