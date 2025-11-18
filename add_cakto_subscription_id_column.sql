ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS cakto_subscription_id TEXT;
