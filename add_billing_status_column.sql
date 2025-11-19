ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS billing_status TEXT NOT NULL DEFAULT 'pending';
