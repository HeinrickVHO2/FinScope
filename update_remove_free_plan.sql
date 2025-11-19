ALTER TABLE public.users
  ALTER COLUMN plan SET DEFAULT 'pro';

UPDATE public.users
SET plan = 'pro'
WHERE plan = 'free';
