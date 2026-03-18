alter table if exists public.ai_chat_history
  add column if not exists metadata jsonb;

notify pgrst, 'reload schema';
