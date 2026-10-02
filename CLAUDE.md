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
  own middleware/login) at `accounts.thelawalaa.com`: a simple money book the manager keeps BY HAND —
  money in / money out entries with a category, note, payment method (cash/bank/QR) and an optional
  bill photo/PDF, plus a dashboard (balance left, today/week/month, charts), reports with Excel/CSV/print,
  and stock. It deliberately does NOT read sales from `orders` (the owner's call — sales are typed in).
  Shares the Supabase project; deployed independently. Restricted to `super_admin`/`accountant`.
  Its Vercel project's Root Directory must be `accounts-app` — with `.` it builds the customer site
  (it did until 2 Oct 2026; set via `vercel project update accounts-app --root-directory accounts-app`).

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
- Orders show as THREE steps — Ordered → Confirmed → Ready to collect (delivery: → On the way) — via `lib/order-status.ts`. The DB keeps its wider status set (`preparing`, driver states) and those fold into the nearest step; never print a raw `orders.status`, always `orderStatusLabel()`. (The Accounts app no longer shows orders, so there's no copy of it there any more.)
- `/admin` (root) is the POS terminal, in its own `app/admin/(pos)/` route group with a minimal, sidebar-free layout — pos_user needs the screen space. Management pages live under the `app/admin/(mgmt)/` route group, which adds the sidebar shell and is `super_admin`-only. There is deliberately NO `app/admin/layout.tsx`: a layout there wraps both groups, so any role gate in it locks one of them out. Don't move a page out of `(mgmt)` without checking whether pos_user should actually see it.
- `orders` RLS has one broad staff policy (`public.get_my_role() IN ('pos_user','admin','super_admin')`) — this is what Realtime `postgres_changes` subscriptions check (Live Orders panel, dashboard feed). The service-role page-load fetch always sees everything regardless, so a missing/narrow RLS policy here fails silently: initial load looks fine, new orders just never show up live. If live orders stop updating again, check this policy AND that `orders`/`deliveries` are still in the `supabase_realtime` publication (`select * from pg_publication_tables`) — it was found empty in Sep 2026 (migration 019). The Live Orders panel also re-syncs every 20s via `getLiveOrders()` as a safety net.
- Staff share devices. Sign out only via `signOutHere()` (`lib/sign-out.ts`: this device only + a full page load) and finish sign-in with `window.location.replace`, never `router.push` — Next's in-memory back/forward cache otherwise shows the previous user's screens on Back. Every signed-in layout renders `<SessionGuard userId={profile.id} />`; keep it on new ones.
- POS deals — Student 5% OR Member price, never both (`lib/discounts.ts`, shared by the POS screen and `createPosOrder`, which recomputes everything; the screen only asks). Student: 5% off items with `products.student_discount_eligible` (Coca-Cola is off by default), whole rupees. Member: items with `products.member_price` (every momo is Rs 99, migration 022; set per item in Admin → Menu) charge that instead. Order lines keep the normal price either way; the saving is `orders.discount_amount` + `discount_label` ("Student 5%" / "Member price").
- `products.pos_only` items show on the POS but never on the website: every public product query filters `pos_only = false`, and `createOrder` refuses them for non-staff. Any new public menu query needs the same filter.
- New-online-order alerts on the POS device (main device: an iPad 6th gen): an in-page chime (`lib/order-sound.ts` — iPad Safari only allows sound after a tap, so every tap re-unlocks it) plus Web Push (`lib/push.ts`, `public/sw.js`, sent from `createOrder` via `after()`). iOS delivers Web Push only to the POS installed to the Home Screen (`public/pos.webmanifest`, start_url `/admin`); the bell in the POS header walks staff through it. Needs the VAPID env vars (Vercel has them; `.env.local` doesn't).
- The POS layout (`components/pos/pos-workspace.tsx`): Sell / Orders tabs below 1280px (phone, iPad portrait and the 1024px landscape), side by side above; both panels stay mounted. Check new POS UI at 375, 768, 1024 and 1440px — and at a SHORT phone height too (375×548 is an iPhone SE in Safari): the cart's footer (total, cash return, Place order) is pinned and everything above it scrolls, so it can never be pushed off-screen. The POS layout sets `viewportFit: "cover"` and `PosThemeRoot` pads by the safe-area insets (home bar / notch on the installed app).
- The customer bottom nav (`components/mobile-nav.tsx`) brings its own spacer; never put bottom padding for it on `<body>` — that gave every staff screen (no nav) a blank strip and made the whole POS scroll on iPhones.
- Cash at the POS: "Cash received" is optional; when entered, the cart shows the return amount and the "Order placed" popup shows Received + Return (in big type) next to the order number.
- The POS is dark by default (cookie `pos-theme`, read by `app/admin/(pos)/layout.tsx`); Tailwind `darkMode: "selector"`, so `dark:` classes only apply inside the POS wrapper — style new POS UI for both.
- Sales archives (the opening-day reset) download as Excel from `/admin/archives/[id]/excel` (`lib/sales-archive-excel.ts`, built on demand from `sales_archives.snapshot`); Admin → Settings lists them all.
- SQL functions called through the API (`supabaseAdmin.rpc`) run under pg-safeupdate: every UPDATE/DELETE needs a WHERE (`WHERE true` is fine) or it fails with "UPDATE requires a WHERE clause".
- Staff training (`/staff`, `components/staff/unskippable-video.tsx`): YouTube IFrame API — the CSP in `next.config.mjs` must allow www.youtube.com in `script-src` AND `frame-src` or the player never loads. Skipping is blocked by only crediting what's been watched at real speed (seeks/fast-forward snap back, playback rate is held at 1×, and YouTube's "ended" only counts if it was really watched). The first finish is recorded in `staff_training_progress` (+ audit `TRAINING_COMPLETED`); admins see who has/hasn't finished on Admin → Training and the dashboard card (`lib/training-status.ts`).
- Accounts app security: sign-in (super_admin/accountant) THEN a 4-digit PIN (default 8848, stored only as a scrypt hash in `account_settings.pin_hash`, changeable in Accounts → Settings; 5 wrong tries in 15 min locks the PIN screen, counted in `audit_logs`). Unlocking sets an httpOnly HMAC cookie bound to the user (`accounts-app/lib/pin-cookie.ts`, key derived from the service-role key — rotating that key just asks everyone for the PIN again); middleware AND `requireAuth()` both check it, so every page, action, `/export` and `/bills/[id]` needs it. It locks itself after 15 idle minutes. Ledger tables (`account_transactions`, `account_categories`, `account_settings`, migration 023) have RLS on with no policies — service role only, after `requireAuth()`. Bills live in the PRIVATE `account-bills` bucket and are only ever opened through `/bills/[id]` (2-minute signed link).
- Dates in both report screens are Nepal calendar days (`lib/dates.ts`; `accounts-app/lib/dates.ts` is the original — change both). Never bucket by the server's clock: Vercel is UTC, 5h45m behind Banepa.
- Charts (Admin → Reports, Accounts) use recharts with the validated pair blue `#2a78d6` / orange `#eb6834` (money in / money out; counter / online), bars ≤ 24px with rounded tops, a legend for 2+ series and a "Show as table" view. Admin → Reports (`lib/sales-report.ts`) counts sales as paid, not-cancelled orders; POS orders are the ones with `placed_by` set.
- Menu photos: Admin → Menu uploads to the public `products` Storage bucket via a signed upload URL (`createProductPhotoUpload` / `setProductPhoto` in `app/actions/admin-crud.ts`).
- Admin → Settings has a PIN-gated (8848, in `app/actions/system.ts`) "reset sales data" action for clearing sample orders before real opening day. It archives everything to `sales_archives` + a downloaded JSON file first, then wipes orders/daily counter/promo usage. Nothing else is touched.

## Known TODO before production
- Verify exact Godam Chowk store lat/lng and postal code in `lib/seo.ts` (currently approximate).
- Add real Google/Bing site-verification tokens to env (see README §7).
- Replace placeholder social URLs and OG image if desired.
- `next` is pinned to 15.5.26 in both apps (`npm audit` clean as of 2026-09-30; a `postcss` override keeps Next's bundled copy patched). Next 15 rules: `cookies()`/`headers()` and page `params`/`searchParams` are async, so the server `createClient()` must be awaited. `typescript.ignoreBuildErrors` is off on purpose — those async page props are only type-checked by `next build`, never by a plain `tsc`.
- Real logo file and a real (non-placeholder) `RESEND_API_KEY` are still pending from the user — both were requested/discussed earlier but never received as accessible files/values.
