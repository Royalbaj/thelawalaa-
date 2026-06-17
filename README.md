# Thelawalaa.com 🥘

Production-grade multi-role food ordering app for Nepal 🇳🇵 — launching in Butwal–Manigram, built to scale into a franchise brand — Next.js 14 (App Router) + Supabase + Vercel. No payment gateway: cash / QR (eSewa, FonePay) payments are confirmed manually by an admin, who always sees exactly how much to collect.

**Roles:** customer (order, track, account) · admin (full console) · pos_user (counter terminal) · delivery_driver (mobile portal)

---

## 1. Setup — Supabase

1. Create a project at https://supabase.com (region: `ap-south-1` Mumbai recommended — closest to Nepal).
2. Apply the schema:
   ```bash
   npm i -g supabase
   supabase login
   supabase link --project-ref <your-project-ref>
   supabase db push          # applies supabase/migrations/001_initial_schema.sql
   ```
   Or paste `supabase/migrations/001_initial_schema.sql` into the SQL Editor and run it, then run `supabase/seed.sql`.
3. **Enable Realtime** (Dashboard → Database → Replication): add `orders` and `deliveries`.
4. **Auth settings** (Dashboard → Authentication):
   - Site URL: `https://thelawalaa.com`
   - Redirect URLs: `https://thelawalaa.com/auth/verify`, `https://thelawalaa.com/auth/invite`, `https://thelawalaa.com/auth/forgot-password`
   - Enable email confirmations.

### Create your first admin
Self-signup can only ever create `customer` accounts (by design). To make the first admin:
1. Sign up normally on the site and verify your email.
2. Supabase Dashboard → SQL Editor:
   ```sql
   UPDATE profiles SET role = 'admin' WHERE id = '<your-user-uuid>';
   ```
3. Dashboard → Authentication → Users → your user → edit **App Metadata** (not user metadata):
   ```json
   { "role": "admin" }
   ```
Admin promotion is deliberately impossible from the app UI.

## 2. Environment variables

Copy `.env.example` → `.env.local` and fill in:

| Variable | Where to get it | Exposure |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API | public |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | same | public (RLS-guarded) |
| `SUPABASE_SERVICE_ROLE_KEY` | same — **never** add `NEXT_PUBLIC_` | server only |
| `RESEND_API_KEY` | resend.com | server only |
| `OTP_HMAC_SECRET` | `openssl rand -hex 32` | server only |
| `NEXT_PUBLIC_GOOGLE_MAPS_KEY` | Google Cloud (Maps Embed) | public, referrer-restricted |
| `NEXT_PUBLIC_SITE_URL` | `https://thelawalaa.com` | public |

## 3. Run locally

```bash
npm install
npm run dev
```

## 4. Deploy — Vercel

1. Push this folder to a GitHub repo and import it in Vercel (framework auto-detects Next.js; region pinned to `bom1` in `vercel.json`).
2. Add all env vars above in Vercel → Project → Settings → Environment Variables.
3. Deploy. Point the `thelawalaa.com` domain at Vercel.

## 5. How manual payments work

1. A customer orders online and chooses **Cash** or **QR (eSewa / FonePay)**. The order is created with `payment_status: pending` — they pay when the food arrives or is picked up.
2. The admin dashboard highlights a **"To collect (unpaid)"** total for the day, and every unpaid order shows a yellow **Collect Rs X** button with the exact amount (cash or QR).
3. When the money is in hand (or the QR transfer is verified on the eSewa/FonePay app), the admin clicks the button and confirms. The order flips to **Paid ✓**, stamped with who confirmed it and when, and the action is audit-logged. A mis-click can be reverted (also audit-logged).
4. Delivery drivers see **"COLLECT Rs X"** on unpaid orders so they know what to take at the door; the admin then confirms once the driver hands the cash over.
5. POS counter orders are paid at the till, so they're marked paid immediately by the operator.

When you're ready for a payment gateway later (eSewa ePay, Khalti, FonePay PSP), the hook point is `payment_status` in `createOrder` + a new webhook route — the rest of the app already treats `payment_status` as server-authoritative.

## 5b. Security model (read before changing anything)

- **Roles live in `app_metadata` + the `profiles` table**, never in client-settable user metadata. The signup trigger defaults everyone to `customer`; a DB trigger (`profiles_privilege_guard`) blocks clients from touching `role`, `is_active`, or `branch_id` on their own row even if a policy is later loosened.
- **RLS everywhere.** Customers see only their own rows; drivers see only assigned deliveries; `audit_logs` and `promo_codes` have **zero** client read access (no promo enumeration). Admin/POS privileged reads & writes go through server actions using the service-role client (`lib/supabase/admin.ts`, guarded by `import "server-only"`).
- **Every server action** starts with `requireRole(...)`, which calls `auth.getUser()` (JWT verified against the Auth server — `getSession()` is never trusted) and reads the role from the DB.
- **Orders are never inserted by clients.** `createOrder` re-prices every line server-side, validates address ownership, applies promos atomically (conditional increment — no over-redemption), and generates order numbers from a Postgres sequence.
- **Payments (manual, Nepal):** there is no gateway. Every customer order starts `payment_status = 'pending'`; **only an admin** can flip it to paid via `markOrderPaid`, which records who confirmed it and when (`paid_confirmed_by` / `paid_confirmed_at`) and writes an audit-log entry. The admin UI shows a **"Collect Rs X"** button with the exact amount so nothing is taken on memory. POS counter orders are marked paid immediately (the operator collects at the till). No client path can ever set payment fields.
- **Delivery OTP** is stored only as an HMAC-SHA256 hash, verified server-side with `timingSafeEqual`, max 3 attempts. Customer phone numbers never appear in driver HTML — the call button fetches a `tel:` link on demand, and every fetch is audit-logged.
- **Suspension is immediate:** suspending a user kills all their sessions globally. Admins can't suspend themselves or change their own role; admin promotion is dashboard-only.
- **Headers:** CSP, HSTS, frame and MIME protections in `next.config.mjs`. Login `redirect` param is sanitized against open redirects. Contact form has a honeypot + per-IP throttle.

## 6. Project map

```
app/(public)/          landing site (anchor sections)
app/auth/              login, signup, invite, reset, verify
app/account/           customer profile, orders, addresses
app/order/             3-step order wizard (cash / QR — pay on arrival)
app/track/[orderId]/   realtime order tracking
app/admin/             dashboard, orders, menu, staff, delivery, reports, announcements, settings
app/pos/               tablet POS terminal
app/delivery/          mobile driver portal (OTP delivery confirmation)
app/actions/           ALL mutations (server actions, Zod-validated, audited)
supabase/              migration + seed
```

Add your logo at `public/logo.png` (optional — the UI falls back to the gradient wordmark).

## 7. SEO

The site ships with professional, technically-complete on-page SEO. What's built in:

- **Rich metadata** on every page — title templates, descriptions, keywords, canonical URLs, and full **Open Graph + Twitter cards** (with a generated `public/og.png` share image) so links unfurl nicely on WhatsApp, Messenger, Facebook, X and iMessage.
- **Structured data (JSON-LD)** for `Organization`, `WebSite` (with sitelinks search box), `FoodEstablishment`, each branch as a `Restaurant` with address + geo + hours, the full `Menu`, and an `FAQPage`. This is what earns Google's rich results — the business panel, menu, and the expandable FAQ in search.
- **`sitemap.xml`** and **`robots.txt`** generated automatically (`app/sitemap.ts`, `app/robots.ts`); private areas (admin, POS, delivery, account, tracking) are kept out of the index.
- **PWA manifest** + favicon/Apple/maskable icons, `theme-color`, and `display:swap` fonts for fast, app-like mobile behaviour.
- **Keyword-aligned copy** for the brand, dishes and varieties (Thelawalaa, chatpate + chicken/ramen/mint/sweet-chilly/spicy varieties, panipuri, fulki, momo, street food Butwal/Manigram) written naturally into real headings and body text — never hidden keyword stuffing, which Google penalises.

Edit all business facts (branches, phone, socials, keywords) in one place: `lib/seo.ts`.

### To actually rank — the off-page work (do this after launch)
Code gets you a technically perfect site; rankings are earned with real-world signals no code can fake. Honestly, **no one can guarantee a permanent #1 spot** — anyone who promises that is misleading you. To compete for the top legitimately:

1. **Google Business Profile** — create one for the Manigram store with photos, hours, the delivery area, and the website link. This is the single biggest driver of "near me" and local-map rankings.
2. **Submit the sitemap** in [Google Search Console](https://search.google.com/search-console) and Bing Webmaster Tools, then paste the verification tokens into `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` / `NEXT_PUBLIC_BING_SITE_VERIFICATION`.
3. **Collect genuine reviews** on Google and Facebook — volume and recency of real reviews strongly affect local ranking.
4. **Get listed** on local directories and food aggregators, and earn links from local blogs/press.
5. **Stay fresh** — new menu items, announcements and posts signal an active site.

Brand terms ("Thelawalaa", "Thelawala") should rank quickly since the site is the authoritative source. Local terms ("chatpate Butwal", "momo Manigram", "panipuri near me") are very winnable with the Google Business Profile + reviews. As you open new franchise locations, add each as a branch in the admin console and create a Google Business Profile for it — the structured data already supports multiple branches.
