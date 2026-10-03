-- ============================================================
-- Marketing (Admin → Marketing): campaigns with a budget and a tracking
-- link (/go/<code>), every rupee spent on them, and what they brought in.
-- A visit through a campaign link sets a 30-day cookie; orders and sign-ups
-- made with it (or with the campaign's promo code) are credited to it.
-- All tables: RLS on, no policies — service role only, after a role check.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.marketing_campaigns (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL CHECK (char_length(name) BETWEEN 2 AND 80),
  channel       TEXT NOT NULL CHECK (channel IN ('facebook','instagram','tiktok','google','poster','flyer','influencer','sms','event','print','radio','other')),
  code          TEXT NOT NULL UNIQUE CHECK (code ~ '^[a-z0-9][a-z0-9-]{1,29}$'),
  landing_path  TEXT NOT NULL DEFAULT '/' CHECK (landing_path IN ('/', '/order', '/auth/signup')),
  promo_code_id UUID REFERENCES public.promo_codes(id) ON DELETE SET NULL,
  budget        NUMERIC(12,2) CHECK (budget IS NULL OR budget >= 0),
  starts_on     DATE NOT NULL DEFAULT CURRENT_DATE,
  ends_on       DATE,
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'ended')),
  notes         TEXT CHECK (notes IS NULL OR char_length(notes) <= 500),
  clicks        INTEGER NOT NULL DEFAULT 0,
  created_by    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS marketing_campaigns_promo ON public.marketing_campaigns (promo_code_id) WHERE promo_code_id IS NOT NULL;
DROP TRIGGER IF EXISTS marketing_campaigns_updated_at ON public.marketing_campaigns;
CREATE TRIGGER marketing_campaigns_updated_at BEFORE UPDATE ON public.marketing_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE IF NOT EXISTS public.marketing_costs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.marketing_campaigns(id) ON DELETE CASCADE,
  spent_on    DATE NOT NULL,
  amount      NUMERIC(12,2) NOT NULL CHECK (amount > 0 AND amount <= 10000000),
  note        TEXT CHECK (note IS NULL OR char_length(note) <= 200),
  created_by  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS marketing_costs_campaign ON public.marketing_costs (campaign_id, spent_on);
CREATE INDEX IF NOT EXISTS marketing_costs_spent_on ON public.marketing_costs (spent_on);

-- One row: the numbers the ROI maths needs.
CREATE TABLE IF NOT EXISTS public.marketing_settings (
  id               INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  gross_margin_pct NUMERIC(5,2) NOT NULL DEFAULT 60 CHECK (gross_margin_pct BETWEEN 0 AND 100),
  monthly_budget   NUMERIC(12,2) CHECK (monthly_budget IS NULL OR monthly_budget >= 0),
  updated_by       UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO public.marketing_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- Who came from which campaign.
ALTER TABLE public.orders   ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES public.marketing_campaigns(id) ON DELETE SET NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS signup_campaign_id UUID REFERENCES public.marketing_campaigns(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS orders_campaign ON public.orders (campaign_id) WHERE campaign_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS profiles_signup_campaign ON public.profiles (signup_campaign_id) WHERE signup_campaign_id IS NOT NULL;

ALTER TABLE public.marketing_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_settings ENABLE ROW LEVEL SECURITY;

-- A click through /go/<code>: counted in one statement (no lost updates).
CREATE OR REPLACE FUNCTION public.marketing_click(p_code TEXT)
RETURNS TABLE (id UUID, landing_path TEXT) LANGUAGE sql VOLATILE SET search_path = public AS $$
  UPDATE public.marketing_campaigns c SET clicks = c.clicks + 1
  WHERE c.code = lower(p_code) AND c.status <> 'ended'
  RETURNING c.id, c.landing_path
$$;
REVOKE ALL ON FUNCTION public.marketing_click(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.marketing_click(TEXT) TO service_role;

-- A signed-in user writing their own profile row can't change their role,
-- their consent record — nor which campaign signed them up.
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
    NEW.signup_campaign_id  := OLD.signup_campaign_id;
  END IF;
  RETURN NEW;
END $$;
