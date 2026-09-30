# Thelawalaa — project notes for Claude Code

Multi-role street-food ordering app. **Launch market: Banepa–Godam Chowk, Kavrepalanchok, Nepal.**
Stack: Next.js 15 (App Router) + React 19 + TypeScript, Supabase (Postgres/RLS/Auth), Tailwind, Resend, Vercel.

## First steps after unzipping
1. `npm install`
2. Copy `.env.example` → `.env.local` and fill in Supabase + Resend + OTP_HMAC_SECRET values (see README §2).
3. Create a Supabase project, then apply `supabase/migrations/001_initial_schema.sql` and `supabase/seed.sql` (see README §1).
4. `npm run dev`

## Roles
customer · super_admin · pos_user · delivery_driver · accountant. Route protection is in `middleware.ts`.
`super_admin` is the management role (migration 018 restored it after 014 had merged it into `admin`;
`admin` stays allowed by the DB constraint but no code grants it anything). Counter work and management
are separate logins: `pos_user` gets only the POS screen, `super_admin` never sees it. `accountant` only
exists to log into the separate Accounts app and has no access to the main site.
**A role rename must land in the DB, `middleware.ts` ROLE_ROUTES, every `requireRole()`, `lib/role-home.ts`
and the Accounts app together, and be deployed** — a half-applied rename (DB changed, production code not)
locked every manager out in Sep 2026.

## Apps in this repo
- **Main site** (this directory) — customer site, POS (`/admin`), management (`/admin/(mgmt)/*`),
  driver portal (`/delivery`), staff training (`/staff`). Deploys as the `thelawalaa` Vercel project.
- **`accounts-app/`** — a fully separate Next.js project (own `package.json`, own Vercel project,
  own middleware/login) for stock, expenses, and reports. Shares the same Supabase project/tables
  so it reads the same order data, but is deployed independently so it can never slow down or share
  a build with the main site. Live at `accounts.thelawalaa.com`. Restricted to `super_admin`/`accountant`.
  Its Vercel project's Root Directory must be `accounts-app` — with `.` it builds the customer site.

## Conventions / guardrails (please preserve)
- ALL mutations go through server actions in `app/actions/*` — they start with `requireRole(...)` and are Zod-validated. Clients never write orders or payment status directly.
- Privileged reads use the service-role client in `lib/supabase/admin.ts` (guarded by `import "server-only"`), only after a role check.
- Payments are hybrid: cash/QR-in-person orders start `payment_status:'pending'` and only an admin can flip them to paid via `markOrderPaid` (audited, actor = the admin) — UI shows "Collect Rs X". Online orders paid via the eSewa gateway (`lib/payments/esewa.ts`, `app/actions/payments.ts`) are auto-confirmed by the `app/api/payments/esewa/callback` route once it re-verifies the transaction server-side against eSewa's status API — that audit row has `actor_id: null` ("the system"), never trust the redirect payload alone.
- **eSewa and delivery are both gated behind a single-row `app_settings` table** (`esewa_enabled`, `delivery_enabled`, both default `false`), toggled only from `/admin/settings` via `updateAppSettings` (`app/actions/settings.ts`, `super_admin` only). Checked both in the UI (`app/order/page.tsx`, homepage) and server-side in `createOrder`/`getEsewaPaymentForm` — never trust the client alone for whether a gated payment/order type is currently allowed.
- The opening-day promo (`app_settings.opening_promo_*`, `lib/promo.ts`) overrides a category's price both at charge time (`createOrder`/`createPosOrder`) AND everywhere it's displayed (POS tiles, `/order`, homepage) — if you add a new place a product price is shown, run it through `applyOpeningPromoPrice()` too, or the shown price will drift from what's actually charged.
- Currency: `npr()` in `lib/utils.ts`. Phone validation is Nepali (`lib/validations/auth.ts`).
- Delivery: flat Nrs 20 within 5km of the store (`DELIVERY_FEE` in `app/actions/orders.ts`).
- Business facts + SEO live in ONE place: `lib/seo.ts`. FAQs in `lib/faqs.ts`.
- Delivery OTP is stored only as an HMAC hash; never expose customer phones in driver HTML.
- `/admin` (root) is the POS terminal, in its own `app/admin/(pos)/` route group with a minimal, sidebar-free layout — pos_user needs the screen space. Management pages live under the `app/admin/(mgmt)/` route group, which adds the sidebar shell and is `super_admin`-only. There is deliberately NO `app/admin/layout.tsx`: a layout there wraps both groups, so any role gate in it locks one of them out. Don't move a page out of `(mgmt)` without checking whether pos_user should actually see it.
- `orders` RLS has one broad staff policy (`public.get_my_role() IN ('pos_user','admin','super_admin')`) — this is what Realtime `postgres_changes` subscriptions check (Live Orders panel, dashboard feed). The service-role page-load fetch always sees everything regardless, so a missing/narrow RLS policy here fails silently: initial load looks fine, new orders just never show up live. If live orders stop updating again, check this policy first.
- Admin → Settings has a PIN-gated (8848, in `app/actions/system.ts`) "reset sales data" action for clearing sample orders before real opening day. It archives everything to `sales_archives` + a downloaded JSON file first, then wipes orders/daily counter/promo usage. Nothing else is touched.

## Known TODO before production
- Verify exact Godam Chowk store lat/lng and postal code in `lib/seo.ts` (currently approximate).
- Add real Google/Bing site-verification tokens to env (see README §7).
- Replace placeholder social URLs and OG image if desired.
- `next` is pinned to 15.5.26 in both apps (`npm audit` clean as of 2026-09-30; a `postcss` override keeps Next's bundled copy patched). Next 15 rules: `cookies()`/`headers()` and page `params`/`searchParams` are async, so the server `createClient()` must be awaited. `typescript.ignoreBuildErrors` is off on purpose — those async page props are only type-checked by `next build`, never by a plain `tsc`.
- Real logo file and a real (non-placeholder) `RESEND_API_KEY` are still pending from the user — both were requested/discussed earlier but never received as accessible files/values.
