-- ============================================================
-- Admin → Marketing & ROI is a budget + ledger, not ad tracking (owner's
-- call): set a marketing budget per month (overall and per category),
-- record every marketing expense and every return it brought, see what's
-- left and the ROI. Replaces 031's campaign links / attribution, which
-- were never used (no orders or sign-ups linked, no costs logged).
-- ============================================================

-- ── Out: ad tracking ──────────────────────────────────────────
DROP INDEX IF EXISTS public.orders_campaign;
DROP INDEX IF EXISTS public.profiles_signup_campaign;
ALTER TABLE public.orders   DROP COLUMN IF EXISTS campaign_id;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS signup_campaign_id;
DROP FUNCTION IF EXISTS public.marketing_click(TEXT);
DROP TABLE IF EXISTS public.marketing_costs;

CREATE OR REPLACE FUNCTION public.prevent_privilege_self_escalation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF current_setting('request.jwt.claims', true)::jsonb->>'role' = 'authenticated' THEN
    NEW.role                := OLD.role;
    NEW.is_active           := OLD.is_active;
    NEW.branch_id           := OLD.branch_id;
    NEW.marketing_opt_in    := OLD.marketing_opt_in;
    NEW.marketing_opt_in_at := OLD.marketing_opt_in_at;
    NEW.terms_accepted_at   := OLD.terms_accepted_at;
  END IF;
  RETURN NEW;
END $$;

-- ── Activities: a named marketing effort with its own budget ──
-- (the old campaigns, without the tracking bits; existing rows kept)
ALTER TABLE IF EXISTS public.marketing_campaigns RENAME TO marketing_activities;
ALTER TABLE public.marketing_activities DROP CONSTRAINT IF EXISTS marketing_campaigns_channel_check;
ALTER TABLE public.marketing_activities RENAME COLUMN channel TO category;
UPDATE public.marketing_activities SET category = CASE category
  WHEN 'print' THEN 'printing' WHEN 'poster' THEN 'printing' WHEN 'flyer' THEN 'printing'
  WHEN 'facebook' THEN 'social' WHEN 'instagram' THEN 'social' WHEN 'tiktok' THEN 'social' WHEN 'google' THEN 'social' WHEN 'sms' THEN 'social'
  WHEN 'influencer' THEN 'influencers' WHEN 'event' THEN 'events' WHEN 'radio' THEN 'media'
  ELSE 'other' END
WHERE true;
ALTER TABLE public.marketing_activities ADD CONSTRAINT marketing_activities_category_check
  CHECK (category IN ('printing','social','events','samples','offers','signage','influencers','media','other'));
DROP INDEX IF EXISTS public.marketing_campaigns_promo;
ALTER TABLE public.marketing_activities
  DROP COLUMN IF EXISTS code,
  DROP COLUMN IF EXISTS landing_path,
  DROP COLUMN IF EXISTS promo_code_id,
  DROP COLUMN IF EXISTS clicks;
ALTER INDEX IF EXISTS public.marketing_campaigns_pkey RENAME TO marketing_activities_pkey;
DROP TRIGGER IF EXISTS marketing_campaigns_updated_at ON public.marketing_activities;
DROP TRIGGER IF EXISTS marketing_activities_updated_at ON public.marketing_activities;
CREATE TRIGGER marketing_activities_updated_at BEFORE UPDATE ON public.marketing_activities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ── Expenses and returns ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.marketing_entries (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind           TEXT NOT NULL CHECK (kind IN ('expense', 'return')),
  entry_date     DATE NOT NULL,
  category       TEXT NOT NULL CHECK (category IN ('printing','social','events','samples','offers','signage','influencers','media','other')),
  activity_id    UUID REFERENCES public.marketing_activities(id) ON DELETE SET NULL,
  amount         NUMERIC(12,2) NOT NULL CHECK (amount > 0 AND amount <= 10000000),
  new_customers  INTEGER CHECK (new_customers IS NULL OR new_customers >= 0),
  payment_method TEXT CHECK (payment_method IS NULL OR payment_method IN ('cash', 'bank', 'qr', 'other')),
  note           TEXT CHECK (note IS NULL OR char_length(note) <= 300),
  created_by     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS marketing_entries_date ON public.marketing_entries (entry_date);
CREATE INDEX IF NOT EXISTS marketing_entries_activity ON public.marketing_entries (activity_id) WHERE activity_id IS NOT NULL;

-- ── Budgets: per month, overall ('total') and optionally per category ──
CREATE TABLE IF NOT EXISTS public.marketing_budgets (
  month      DATE NOT NULL CHECK (EXTRACT(DAY FROM month) = 1),
  category   TEXT NOT NULL DEFAULT 'total' CHECK (category IN ('total','printing','social','events','samples','offers','signage','influencers','media','other')),
  amount     NUMERIC(12,2) NOT NULL CHECK (amount >= 0 AND amount <= 100000000),
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (month, category)
);

ALTER TABLE public.marketing_settings DROP COLUMN IF EXISTS monthly_budget;

ALTER TABLE public.marketing_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_budgets ENABLE ROW LEVEL SECURITY;  -- no policies: service role only, after a role check
