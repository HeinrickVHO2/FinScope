ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS billing_status TEXT NOT NULL DEFAULT 'pending';

UPDATE public.users
SET billing_status = 'active'
WHERE billing_status IS NULL;
