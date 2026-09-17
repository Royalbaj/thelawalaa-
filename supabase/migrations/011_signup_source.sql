-- ─────────────────────────────────────────────
-- SIGNUP SOURCE — tracks where a customer account came from (e.g. the
-- QR poster campaign vs. the regular website), so super-admin can see
-- how a marketing push is performing. Set via user_metadata at signup
-- (untrusted input already, same trust level as full_name/phone —
-- never used for anything privileged) and copied into profiles by the
-- same SECURITY DEFINER trigger that already reads full_name/phone.
-- ─────────────────────────────────────────────

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS signup_source TEXT NOT NULL DEFAULT 'web';

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  requested_role TEXT := COALESCE(NEW.raw_app_meta_data->>'role', 'customer');
  source TEXT := COALESCE(NULLIF(NEW.raw_user_meta_data->>'signup_source', ''), 'web');
BEGIN
  IF requested_role NOT IN ('super_admin','admin','pos_user','delivery_driver','customer') THEN
    requested_role := 'customer';
  END IF;
  INSERT INTO profiles (id, full_name, phone, role, branch_id, vehicle_type, vehicle_number, signup_source)
  VALUES (
    NEW.id,
    LEFT(COALESCE(NEW.raw_user_meta_data->>'full_name', 'Customer'), 100),
    LEFT(NEW.raw_user_meta_data->>'phone', 20),
    requested_role,
    NULLIF(NEW.raw_app_meta_data->>'branch_id','')::uuid,
    NULLIF(NEW.raw_app_meta_data->>'vehicle_type',''),
    LEFT(NEW.raw_app_meta_data->>'vehicle_number', 20),
    LEFT(source, 40)
  );
  RETURN NEW;
END;
$$;
