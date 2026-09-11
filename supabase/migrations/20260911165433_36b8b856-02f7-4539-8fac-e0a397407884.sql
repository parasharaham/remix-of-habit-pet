ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS plan_code text NOT NULL DEFAULT 'FREE',
  ADD COLUMN IF NOT EXISTS plan_state text NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN IF NOT EXISTS one_time boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS provider_price_id text,
  ADD COLUMN IF NOT EXISTS provider_purchase_token text;

UPDATE public.subscriptions
SET plan_code = CASE
      WHEN status IN ('pro_active','pro_cancelled','trial','active') AND billing_interval = 'yearly' THEN 'YEARLY_PRO'
      WHEN status IN ('pro_active','pro_cancelled','trial','active') THEN 'MONTHLY_PRO'
      ELSE 'FREE'
    END,
    plan_state = CASE
      WHEN status = 'pro_cancelled' THEN 'CANCELLED'
      WHEN status = 'pro_expired' THEN 'EXPIRED'
      WHEN status = 'payment_failed' THEN 'PAST_DUE'
      ELSE 'ACTIVE'
    END;

CREATE INDEX IF NOT EXISTS subscriptions_provider_purchase_token_idx
  ON public.subscriptions (provider_purchase_token);