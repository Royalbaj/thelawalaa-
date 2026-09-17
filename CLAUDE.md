# Thelawalaa — project notes for Claude Code

Multi-role street-food ordering app. **Launch market: Banepa–Godam Chowk, Kavrepalanchok, Nepal.**
Stack: Next.js 14 (App Router) + TypeScript, Supabase (Postgres/RLS/Auth), Tailwind, Resend, Vercel.

## First steps after unzipping
1. `npm install`
2. Copy `.env.example` → `.env.local` and fill in Supabase + Resend + OTP_HMAC_SECRET values (see README §2).
3. Create a Supabase project, then apply `supabase/migrations/001_initial_schema.sql` and `supabase/seed.sql` (see README §1).
4. `npm run dev`

## Roles
customer · admin · pos_user · delivery_driver. Route protection is in `middleware.ts`.

## Conventions / guardrails (please preserve)
- ALL mutations go through server actions in `app/actions/*` — they start with `requireRole(...)` and are Zod-validated. Clients never write orders or payment status directly.
- Privileged reads use the service-role client in `lib/supabase/admin.ts` (guarded by `import "server-only"`), only after a role check.
- Payments are hybrid: cash/QR-in-person orders start `payment_status:'pending'` and only an admin can flip them to paid via `markOrderPaid` (audited, actor = the admin) — UI shows "Collect Rs X". Online orders paid via the eSewa gateway (`lib/payments/esewa.ts`, `app/actions/payments.ts`) are auto-confirmed by the `app/api/payments/esewa/callback` route once it re-verifies the transaction server-side against eSewa's status API — that audit row has `actor_id: null` ("the system"), never trust the redirect payload alone.
- **eSewa and delivery are both gated behind a single-row `app_settings` table** (`esewa_enabled`, `delivery_enabled`, both default `false`), toggled only from `/super-admin/settings` via `updateAppSettings` (`app/actions/settings.ts`, `super_admin` only). Checked both in the UI (`app/order/page.tsx`, homepage) and server-side in `createOrder`/`getEsewaPaymentForm` — never trust the client alone for whether a gated payment/order type is currently allowed.
- Currency: `npr()` in `lib/utils.ts`. Phone validation is Nepali (`lib/validations/auth.ts`).
- Delivery: flat Nrs 20 within 5km of the store (`DELIVERY_FEE` in `app/actions/orders.ts`).
- Business facts + SEO live in ONE place: `lib/seo.ts`. FAQs in `lib/faqs.ts`.
- Delivery OTP is stored only as an HMAC hash; never expose customer phones in driver HTML.
- Pages under `/super-admin/*` must use `requireRole(["super_admin"])`, not `["admin"]` — middleware already restricts that whole path to `super_admin` only, so checking `"admin"` inside the page throws "Forbidden" for every real visitor (this was a live bug, fixed across 5 pages).

## Known TODO before production
- Verify exact Godam Chowk store lat/lng and postal code in `lib/seo.ts` (currently approximate).
- Add real Google/Bing site-verification tokens to env (see README §7).
- Replace placeholder social URLs and OG image if desired.
- Could not run `npm install`/build in the build environment (no network) — run it locally and fix any version nits.
