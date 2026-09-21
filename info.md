# Info Log

Running record of code changes made to this repo, in the order they were done — one change at a time, each reviewed before moving to the next. Newest entry on top.

---

## 2026-09-20 — Applied `018_restore_super_admin.sql` to production

Ran the migration bundling the `super_admin` rename and the "Staff POS" role fix against the live database, per explicit go-ahead.

**Hit and fixed one bug before it landed:** the first attempt failed with `profiles_role_check` violated — the migration updated rows to `role = 'super_admin'` *before* widening the constraint that allows that value, so the very first `UPDATE` (renaming `admin` → `super_admin`) was rejected by the still-old constraint from migration 014. Applying SQL runs transactionally, so this rolled back cleanly with zero partial effect — verified production was untouched (`role, count(*)` still showed 5 `admin` rows, same as before) before retrying. Reordered `018_restore_super_admin.sql` to `ALTER TABLE` (widen constraint) first, data `UPDATE`s second, then reapplied — succeeded.

**Verified the result** by querying every non-customer profile:
- 4 accounts now `super_admin` (`admin@`, `creatorbgrn@gmail.com`, `gairebishal821@gmail.com`, `superadmin@thelawalaa.com`)
- `pos@thelawalaa.com` ("Staff POS") correctly landed on `pos_user`, not swept into `super_admin`
- `driver@thelawalaa.com` (`delivery_driver`) and `rakam@thelawalaa.com` (`accountant`) unchanged, as expected

Code and database are now in sync — the `requireRole(["super_admin"])` checks added earlier in this session match what's actually in the database.

---

## 2026-09-20 — Cleanup: fixed the seed-script bug + plaintext password, before continuing

Two problems flagged in the previous entry, fixed now as requested before moving on.

### 1. "Staff POS" account had the wrong role

Confirmed against the live database: `pos@thelawalaa.com` ("Staff POS") has `role = 'admin'` right now — it should be `pos_user`, a pre-existing bug in `999_setup_accounts.sql` unrelated to anything done earlier in this session.

- `supabase/migrations/999_setup_accounts.sql` — fixed going forward: now assigns `role = 'pos_user'` for that account.
- `supabase/migrations/018_restore_super_admin.sql` — added a one-time, narrowly-targeted correction (by exact email, only fires if the row is still `super_admin` after the blanket rename) so the row the bug already created in production gets fixed in the same migration, instead of drifting further out of sync.

### 2. Plaintext password committed to a migration file that already ran in production

`999_setup_accounts.sql` had `crypt('password123', gen_salt('bf'))` hardcoded for all three seed accounts (`superadmin@thelawalaa.com`, `pos@thelawalaa.com`, `driver@thelawalaa.com`) — a real, working password, committed to source, that had **already been applied to the live database**.

- **Fixed in the file:** each account now gets `crypt(encode(gen_random_bytes(24), 'base64'), gen_salt('bf')))` — a random password generated at migration time that is never written anywhere, not even in this script. Anyone setting up a fresh environment from these migrations gets working accounts with no discoverable password; the real owner sets their own via `/auth/forgot-password`.
- **Decision (explicit):** leave the live `password123` credentials on those three accounts as they are — no reset email, no rotation. The fix above still closes the hole for anyone setting up a fresh environment from these migrations going forward; the production exposure is a known, accepted risk by the owner's choice, not an oversight. Don't re-raise this unless asked.

**Files touched:**
- `supabase/migrations/999_setup_accounts.sql`
- `supabase/migrations/018_restore_super_admin.sql`

**Verification:** SQL reviewed by hand (no destructive syntax, `WHERE` clauses scoped to exact known rows); not yet run against production — still bundled with the not-yet-applied `018_restore_super_admin.sql` from the previous step.

---

## 2026-09-20 — Restore `super_admin` (retire `admin` for now, kept scalable) + remove POS terminal from the admin interface

**Two related changes, done together because they touch overlapping files.**

### 1. `admin` → `super_admin`

The live database currently has one top management tier named `admin` (migration `014_admin_merge_and_accounts.sql` had merged a former `super_admin`/`admin` split back into one role — see the incidental finding logged earlier). Per instruction: go back to naming that one tier `super_admin`, don't offer a second `admin` tier right now, but don't close the door on adding one later.

**How it stays scalable:** the new migration's `CHECK` constraint and the signup trigger both list **both** `'super_admin'` and `'admin'` as valid values — so reintroducing a real, lesser-privileged `admin` tier later needs **zero schema changes**, just new `requireRole()` calls in code that actually grant it something. Nothing in the app currently checks for bare `"admin"` anymore, so an `admin`-role row would be valid but powerless until that future work happens.

- **New migration:** `supabase/migrations/018_restore_super_admin.sql` — renames existing `admin` rows to `super_admin` in `profiles` and `auth.users.raw_app_meta_data`, updates the `profiles_role_check` constraint and the `handle_new_user()` trigger to allow both values.
- **Code:** every `requireRole(["admin", ...])` call, role-comparison (`profile.role === "admin"`), role array, badge-color map, and the staff invite/role-change dropdowns were changed from `"admin"` to `"super_admin"` — **21 files** across `app/actions/*`, `app/admin/(mgmt)/*`, `app/delivery/*`, `app/staff/*`, `lib/role-home.ts`, `lib/validations/staff.ts`, `components/admin/staff-controls.tsx`, `components/mobile-nav.tsx`, and `accounts-app/{middleware.ts, lib/supabase/server.ts, app/login/page.tsx}`. Full list is in the diff — grep for `super_admin` if you want to see every spot.
- `999_setup_accounts.sql` (seed/test data, already applied to production once) left **untouched** — it sets a "Staff POS" test account to `role = 'admin'`, which looks like a pre-existing labeling bug (that account's email is `pos@thelawalaa.com`, so it should probably be `pos_user`) unrelated to this change. Flagging it, not fixing it. It also hardcodes a plaintext test password (`password123`) that already ran against production — worth rotating separately if those test accounts are still reachable.

**⚠️ Migration not yet applied to the live Supabase project.** The code and the DB must change together — deploying this code without running `018_restore_super_admin.sql` first would lock out every current `admin` account, since `requireRole(["super_admin"])` would no longer match their `role = 'admin'` row. Waiting for confirmation before running it against production (5 real staff rows + `auth.users` metadata).

### 2. POS terminal removed from the admin interface

Previously `super_admin` (then `admin`) could both see a "POS Terminal" link in their sidebar and directly load `/admin` (the counter screen), sharing it with `pos_user`.

- `app/admin/layout.tsx` — now only `pos_user` can load `/admin` at all (not just hidden from nav — the route itself redirects anyone else to login).
- `app/admin/page.tsx` — `requireRole` narrowed to `["pos_user"]`.
- `components/admin/sidebar-nav.tsx` — removed the "POS Terminal" nav entry entirely; simplified the now-unnecessary exact-path check that existed only because of it.
- `components/admin/pos-header.tsx` — removed the `isAdmin` prop and its "back to dashboard" icon link, both dead now that `super_admin` never reaches this header.

Counter operations and business management are now fully separate logins, as requested.

**Files touched:** 25 total — see the two lists above. No accounts-app files beyond the role-rename ones.

**Verification done:** TypeScript typecheck on both the main app and `accounts-app` — both clean. **Not done:** running the migration (see warning above), and no live UI test (would need a real `pos_user` and `super_admin` session).

---

## 2026-09-20 — Fix: staff invite links expiring instantly

**Problem reported:** staff invited from `app/admin/staff` get an email, but by the time they click the link it says "expired" — even within seconds of it being sent.

**Root cause found:** `inviteStaff()` (`app/actions/staff.ts`) called `supabaseAdmin.auth.admin.inviteUserByEmail()`, which sends Supabase's own email containing a raw `https://<project>.supabase.co/auth/v1/verify?...` link. That link is a plain `GET` request that **consumes the one-time invite token the instant anything requests it** — including corporate email security scanners and inbox link-preview bots, which automatically fetch every link in an incoming email to check it's safe. The token is burned before the real person ever clicks, so they see "expired" on a link that's actually only seconds old.

**Fix — no new database table needed:**
- `app/actions/staff.ts` — `inviteStaff()` now calls `supabaseAdmin.auth.admin.generateLink({ type: "invite", ... })` instead of `inviteUserByEmail()`. `generateLink` issues the same one-time token but does **not** auto-send an email, so nothing can prefetch it. We send our own email via Resend (same pattern already used for order-confirmation emails in `app/actions/orders.ts`) with a link to our own `/auth/invite?token_hash=...&type=invite` page.
- `app/auth/invite/page.tsx` — rewritten as a two-step flow. Step 1 renders an inert "Accept invite" button — nothing is consumed on page load, so a bot that fetches the HTML sees a harmless static page. The token is only consumed inside the button's `onClick` handler, via `supabase.auth.verifyOtp({ token_hash, type: "invite" })`, which real bots don't trigger (they don't click buttons). Step 2 (password setup) only appears after that succeeds.
- Added `resendStaffInvite(targetId)` — generates and emails a fresh link for an account still showing "Invite pending", without creating a duplicate account.
- `components/admin/staff-controls.tsx` + `app/admin/(mgmt)/staff/page.tsx` — added a **"Resend invite"** button next to any staff row still showing the "Invite pending" badge, wired to the new action.

**Files touched:**
- `app/actions/staff.ts`
- `app/auth/invite/page.tsx`
- `components/admin/staff-controls.tsx`
- `app/admin/(mgmt)/staff/page.tsx`

**Not touched / no schema change:** no new tables or migrations — this fix uses Supabase's own `generateLink` + `verifyOtp` primitives, which were already sufficient.

**Verification done:** read-through + TypeScript typecheck (see terminal output). **Not yet done:** a live end-to-end test (send a real invite, click it, confirm it works) — that needs `RESEND_API_KEY` / `SUPABASE_SERVICE_ROLE_KEY` in a running environment, which this session doesn't have. Recommend testing this on staging/Vercel preview before it reaches production staff.

**Incidental finding (not acted on):** the live database has no `super_admin` role — migration `014_admin_merge_and_accounts.sql` merged it back into `admin` ("one management tier, not two"). The architecture doc written earlier in this conversation assumed `admin` and `super_admin` were separate tiers; that assumption needs correcting before any role-permission work (the "admin sees stats only" / accountant / pos_user-today-only changes) is implemented in code.

---

## 2026-09-20 — Accountant: added a read-only Orders view to `accounts-app`

**Before touching anything, checked what already exists** — and there's more built than the earlier architecture doc assumed:
- `accounts-app/` is a **second, already-working Next.js app** (own `package.json`, `middleware.ts`, login page), on a separate subdomain per `supabase/migrations/014_admin_merge_and_accounts.sql`'s own comment ("Accounts app — stock/inventory + expenses, separate subdomain"). Still the same stack (Next.js + Supabase) — just a second deployment target, not a second framework.
- Access is already locked to `role IN ('admin', 'accountant')` in three places: `middleware.ts`, `lib/supabase/server.ts#getVerifiedUser`, and the login page itself. Rakam (accountant) can already sign in here once her invite is accepted (see the fix above).
- **Stock restock forecasting already exists** — `accounts-app/app/(app)/reports/page.tsx` computes average daily usage from `stock_movements` over the last 30 days and estimates days-of-stock-remaining per item, color-coded (red ≤3 days, amber ≤7 days). This *is* "Level 2" of the restock-intelligence design from the blueprint doc — no need to build it again.
- The dashboard (`accounts-app/app/(app)/page.tsx`) already shows today/week/month revenue, monthly expenses, net, and a low-stock alert banner.

**Gap found:** none of the above lets Rakam open an individual order and see its contents — only aggregates. That's what "accountant should see all data" was actually missing.

**Added:**
- `accounts-app/app/(app)/orders/page.tsx` — full order list, search by order number, filter by status. Read-only: no status dropdown, no "mark paid" button (those stay in the main admin console, where every write is audited — accounts-app has no order-mutating actions at all, by design).
- `accounts-app/app/(app)/orders/[id]/page.tsx` — single order detail: customer + address, payment method and who confirmed it, delivery timeline if applicable, full line items, and totals breakdown.
- `accounts-app/components/shell.tsx` — added "Orders" to the nav.

**Files touched:**
- `accounts-app/app/(app)/orders/page.tsx` (new)
- `accounts-app/app/(app)/orders/[id]/page.tsx` (new)
- `accounts-app/components/shell.tsx`

**Not done:** nothing in the main `app/admin` console was touched — the "admin sees stats only, not order details" restriction (item 3 below) is a separate, bigger change to an app that's actively used for daily operations, and still needs the `super_admin`-merge correction factored in first.

**Verification done:** read-through against the existing schema (`order_items`, `deliveries`, `addresses` columns confirmed via the live database) and the sibling `app/admin/orders` page for pattern consistency. TypeScript typecheck running next.

---

## Next up (not started)

1. `pos_user` scoped to today's orders only (RLS)
2. `admin` restricted to aggregate stats only (needs the `super_admin` correction factored in)
3. Payment gateway adapter scaffold
4. Homepage CMS wiring (`home_page_sections`, `site_settings`)
