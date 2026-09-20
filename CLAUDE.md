# Thelawalaa — project notes for Claude Code

Multi-role street-food ordering app. **Launch market: Banepa–Godam Chowk, Kavrepalanchok, Nepal.**
Stack: Next.js 14 (App Router) + TypeScript, Supabase (Postgres/RLS/Auth), Tailwind, Resend, Vercel.

## First steps after unzipping
1. `npm install`
2. Copy `.env.example` → `.env.local` and fill in Supabase + Resend + OTP_HMAC_SECRET values (see README §2).
3. Create a Supabase project, then apply `supabase/migrations/001_initial_schema.sql` and `supabase/seed.sql` (see README §1).
4. `npm run dev`

## Roles
customer · admin · pos_user · delivery_driver · accountant. Route protection is in `middleware.ts`.
`admin` is the single management tier (super_admin was merged into it — see below); `accountant` only
exists to log into the separate Accounts app and has no access to the main site.

## Apps in this repo
- **Main site** (this directory) — customer site, POS (`/admin`), management (`/admin/(mgmt)/*`),
  driver portal (`/delivery`), staff training (`/staff`). Deploys as the `thelawalaa` Vercel project.
- **`accounts-app/`** — a fully separate Next.js project (own `package.json`, own Vercel project,
  own middleware/login) for stock, expenses, and reports. Shares the same Supabase project/tables
  so it reads the same order data, but is deployed independently so it can never slow down or share
  a build with the main site. Live at `accounts.thelawalaa.com`. Restricted to `admin`/`accountant`.

## Conventions / guardrails (please preserve)
- ALL mutations go through server actions in `app/actions/*` — they start with `requireRole(...)` and are Zod-validated. Clients never write orders or payment status directly.
- Privileged reads use the service-role client in `lib/supabase/admin.ts` (guarded by `import "server-only"`), only after a role check.
- Payments are hybrid: cash/QR-in-person orders start `payment_status:'pending'` and only an admin can flip them to paid via `markOrderPaid` (audited, actor = the admin) — UI shows "Collect Rs X". Online orders paid via the eSewa gateway (`lib/payments/esewa.ts`, `app/actions/payments.ts`) are auto-confirmed by the `app/api/payments/esewa/callback` route once it re-verifies the transaction server-side against eSewa's status API — that audit row has `actor_id: null` ("the system"), never trust the redirect payload alone.
- **eSewa and delivery are both gated behind a single-row `app_settings` table** (`esewa_enabled`, `delivery_enabled`, both default `false`), toggled only from `/admin/settings` via `updateAppSettings` (`app/actions/settings.ts`, `admin` only). Checked both in the UI (`app/order/page.tsx`, homepage) and server-side in `createOrder`/`getEsewaPaymentForm` — never trust the client alone for whether a gated payment/order type is currently allowed.
- The opening-day promo (`app_settings.opening_promo_*`, `lib/promo.ts`) overrides a category's price both at charge time (`createOrder`/`createPosOrder`) AND everywhere it's displayed (POS tiles, `/order`, homepage) — if you add a new place a product price is shown, run it through `applyOpeningPromoPrice()` too, or the shown price will drift from what's actually charged.
- Currency: `npr()` in `lib/utils.ts`. Phone validation is Nepali (`lib/validations/auth.ts`).
- Delivery: flat Nrs 20 within 5km of the store (`DELIVERY_FEE` in `app/actions/orders.ts`).
- Business facts + SEO live in ONE place: `lib/seo.ts`. FAQs in `lib/faqs.ts`.
- Delivery OTP is stored only as an HMAC hash; never expose customer phones in driver HTML.
- `/admin` (root) is the POS terminal and deliberately has NO sidebar shell (`app/admin/layout.tsx` is minimal) — pos_user needs the screen space. Management pages live under the `app/admin/(mgmt)/` route group, which adds the sidebar shell and is `admin`-only. Don't move a page out of `(mgmt)` without checking whether pos_user should actually see it.
- `orders` RLS has one broad staff policy (`public.get_my_role() IN ('pos_user','admin')`) — this is what Realtime `postgres_changes` subscriptions check (Live Orders panel, dashboard feed). The service-role page-load fetch always sees everything regardless, so a missing/narrow RLS policy here fails silently: initial load looks fine, new orders just never show up live. If live orders stop updating again, check this policy first.
- Admin → Settings has a PIN-gated (8848, in `app/actions/system.ts`) "reset sales data" action for clearing sample orders before real opening day. It archives everything to `sales_archives` + a downloaded JSON file first, then wipes orders/daily counter/promo usage. Nothing else is touched.

## Known TODO before production
- Verify exact Godam Chowk store lat/lng and postal code in `lib/seo.ts` (currently approximate).
- Add real Google/Bing site-verification tokens to env (see README §7).
- Replace placeholder social URLs and OG image if desired.
- Could not run `npm install`/build in the build environment (no network) — run it locally and fix any version nits.
- `next` is pinned to 14.2.30 in both apps, which has several known CVEs (`npm audit` in either app lists them) — worth a deliberate, tested upgrade pass at some point, not a drive-by bump given how much of the App Router API changed in 15/16.
- Real logo file and a real (non-placeholder) `RESEND_API_KEY` are still pending from the user — both were requested/discussed earlier but never received as accessible files/values.
