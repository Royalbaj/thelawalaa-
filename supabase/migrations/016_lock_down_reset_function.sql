-- CRITICAL: `REVOKE ALL ... FROM PUBLIC` in migration 014 did NOT actually
-- block anon/authenticated from calling reset_sales_data() — Supabase's
-- default privileges grant EXECUTE on new functions directly to anon and
-- authenticated, not via the PUBLIC pseudo-role, so revoking from PUBLIC
-- alone left those direct grants untouched. Confirmed while testing: the
-- anon key could invoke this destructive function and only failed on an
-- unrelated FK constraint, not a permissions error — meaning a call with
-- any valid profile id would have wiped every order in production.
REVOKE EXECUTE ON FUNCTION public.reset_sales_data(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reset_sales_data(UUID) TO service_role;
