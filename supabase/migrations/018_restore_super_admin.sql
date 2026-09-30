-- ============================================================
-- Restore 'super_admin' as the sole full-access role, undoing
-- migration 014's merge into 'admin' ("one management tier, not
-- two"). 'admin' stays in every allow-list below so a distinct,
-- lesser admin tier can be reintroduced later with ZERO further
-- schema changes — but no application code currently grants
-- 'admin' any access at all: every requireRole() check in the
-- codebase now reads 'super_admin' explicitly. See info.md for
-- the full list of application files touched alongside this.
-- ============================================================

-- Widen the constraint FIRST — a data UPDATE that writes 'super_admin'
-- before this runs fails immediately, since the old constraint
-- (migration 014) doesn't allow that value yet.
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('super_admin', 'admin', 'pos_user', 'delivery_driver', 'customer', 'accountant'));

UPDATE profiles SET role = 'super_admin' WHERE role = 'admin';

UPDATE auth.users
SET raw_app_meta_data = raw_app_meta_data || '{"role":"super_admin"}'::jsonb
WHERE raw_app_meta_data->>'role' = 'admin';

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  requested_role TEXT := COALESCE(NEW.raw_app_meta_data->>'role', 'customer');
BEGIN
  IF requested_role NOT IN ('super_admin', 'admin', 'pos_user', 'delivery_driver', 'customer', 'accountant') THEN
    requested_role := 'customer';
  END IF;
  INSERT INTO profiles (id, full_name, phone, role, branch_id, vehicle_type, vehicle_number)
  VALUES (
    NEW.id,
    LEFT(COALESCE(NEW.raw_user_meta_data->>'full_name', 'Customer'), 100),
    LEFT(NEW.raw_user_meta_data->>'phone', 20),
    requested_role,
    NULLIF(NEW.raw_app_meta_data->>'branch_id','')::uuid,
    NULLIF(NEW.raw_app_meta_data->>'vehicle_type',''),
    LEFT(NEW.raw_app_meta_data->>'vehicle_number', 20)
  );
  RETURN NEW;
END;
$$;

-- Note: RLS policies from migrations 013/014 already list BOTH 'admin'
-- and 'super_admin' in their role checks (they were never cleaned up
-- after the 014 merge), so they need no change here — they already
-- cover 'super_admin' rows and will keep working unmodified if a real
-- 'admin' tier is reintroduced later.

-- ============================================================
-- One-time correction: 999_setup_accounts.sql wrongly gave the
-- pos@thelawalaa.com ("Staff POS") seed account role = 'admin'
-- instead of 'pos_user'. The blanket rename above just swept that
-- mistake from 'admin' to 'super_admin' along with everyone else's —
-- undo that for this one specific, known account. (999 itself is
-- fixed going forward; this line repairs the row it already created.)
-- ============================================================
UPDATE profiles SET role = 'pos_user'
WHERE role = 'super_admin'
  AND id = (SELECT id FROM auth.users WHERE email = 'pos@thelawalaa.com');
