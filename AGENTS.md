# Thelawalaa — project notes for Codex

Multi-role street-food ordering app. **Launch market: Butwal–Manigram, Nepal.**
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
- Payments are MANUAL (no gateway in Nepal): orders start `payment_status:'pending'`; only an admin flips to paid via `markOrderPaid` (audited). UI shows "Collect Rs X".
- Currency: `npr()` in `lib/utils.ts`. Phone validation is Nepali (`lib/validations/auth.ts`).
- Delivery: flat Nrs 20 within 5km of the store (`DELIVERY_FEE` in `app/actions/orders.ts`).
- Business facts + SEO live in ONE place: `lib/seo.ts`. FAQs in `lib/faqs.ts`.
- Delivery OTP is stored only as an HMAC hash; never expose customer phones in driver HTML.

## Known TODO before production
- Verify exact Manigram store lat/lng in `lib/seo.ts`.
- Add real Google/Bing site-verification tokens to env (see README §7).
- Replace placeholder social URLs and OG image if desired.
- Could not run `npm install`/build in the build environment (no network) — run it locally and fix any version nits.
