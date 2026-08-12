ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS billing_interval text NOT NULL DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS paddle_customer_id text,
  ADD COLUMN IF NOT EXISTS paddle_subscription_id text,
  ADD COLUMN IF NOT EXISTS current_period_start timestamptz,
  ADD COLUMN IF NOT EXISTS cancel_at_period_end boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_user_id_key ON public.subscriptions(user_id);

DROP TRIGGER IF EXISTS subscriptions_set_updated_at ON public.subscriptions;
CREATE TRIGGER subscriptions_set_updated_at BEFORE UPDATE ON public.subscriptions
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;

CREATE TABLE IF NOT EXISTS public.scan_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  usage_date date NOT NULL,
  scan_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, usage_date)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.scan_usage TO authenticated;
GRANT ALL ON public.scan_usage TO service_role;

ALTER TABLE public.scan_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS scan_usage_owner ON public.scan_usage;
CREATE POLICY scan_usage_owner ON public.scan_usage FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS scan_usage_set_updated_at ON public.scan_usage;
CREATE TRIGGER scan_usage_set_updated_at BEFORE UPDATE ON public.scan_usage
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();