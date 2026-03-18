-- FinScope - Enable RLS across public tables
--
-- IMPORTANT
-- 1) The current backend uses SUPABASE_SERVICE_ROLE_KEY, which bypasses RLS.
--    These policies protect access made with anon/authenticated roles.
-- 2) The current app does NOT use Supabase Auth as its primary auth layer.
--    Because of that, direct browser access with anon/authenticated will only work
--    after the client is authenticated with a Supabase JWT whose auth.uid() matches user_id.
-- 3) The current realtime client in client/src/lib/realtime.ts uses the anon key without
--    a Supabase session. After this migration, direct realtime on transactions will stop
--    until the frontend is migrated to Supabase Auth or the realtime flow is moved to the backend.
-- 4) The users table stores bcrypt password hashes and must remain backend-only.

begin;

create extension if not exists pgcrypto;

-- Optional helper used in policies to keep conditions consistent.
create or replace function public.finscope_is_owner(target_user_id text)
returns boolean
language sql
stable
as $$
  select auth.uid() is not null and auth.uid()::text = target_user_id;
$$;

create or replace function public.finscope_is_owner(target_user_id uuid)
returns boolean
language sql
stable
as $$
  select auth.uid() is not null and auth.uid() = target_user_id;
$$;

comment on function public.finscope_is_owner(text)
is 'Checks whether the current Supabase Auth user owns the target row.';

comment on function public.finscope_is_owner(uuid)
is 'Checks whether the current Supabase Auth user owns the target row.';

do $$
declare
  _table text;
  _all_tables text[] := array[
    'accounts',
    'agent_transaction_candidates',
    'ai_chat_history',
    'ai_messages',
    'ai_report_settings',
    'app_notifications',
    'bank_statement_entries',
    'bank_statement_uploads',
    'business_profile',
    'category_limits',
    'future_expenses',
    'future_transactions',
    'goal_contributions',
    'goals',
    'import_processing_logs',
    'inbound_messages',
    'investment_goals',
    'investment_transactions',
    'investments',
    'media_evidence',
    'mei_accounts_backup',
    'mei_transactions_backup',
    'password_reset_tokens',
    'recurring_transactions',
    'rules',
    'transaction_reconciliations',
    'transactions',
    'user_phone_bindings',
    'user_report_preferences',
    'users',
    'whatsapp_processing_logs'
  ];
begin
  foreach _table in array _all_tables loop
    if to_regclass(format('public.%I', _table)) is not null then
      execute format('alter table public.%I enable row level security', _table);
      execute format('alter table public.%I force row level security', _table);
      execute format('revoke all on table public.%I from anon', _table);
      execute format('revoke all on table public.%I from authenticated', _table);
    end if;
  end loop;
end $$;

-- User-owned tables:
-- These tables expose only rows where user_id matches auth.uid().
do $$
declare
  _table text;
  _user_scoped_tables text[] := array[
    'accounts',
    'agent_transaction_candidates',
    'ai_chat_history',
    'ai_messages',
    'ai_report_settings',
    'bank_statement_entries',
    'bank_statement_uploads',
    'business_profile',
    'category_limits',
    'future_expenses',
    'future_transactions',
    'goal_contributions',
    'goals',
    'import_processing_logs',
    'inbound_messages',
    'investment_goals',
    'investment_transactions',
    'investments',
    'media_evidence',
    'mei_accounts_backup',
    'mei_transactions_backup',
    'recurring_transactions',
    'rules',
    'transaction_reconciliations',
    'transactions',
    'user_phone_bindings',
    'user_report_preferences',
    'whatsapp_processing_logs'
  ];
begin
  foreach _table in array _user_scoped_tables loop
    if to_regclass(format('public.%I', _table)) is null then
      continue;
    end if;

    if not exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = _table
        and column_name = 'user_id'
    ) then
      raise notice 'Skipping %, missing user_id column', _table;
      continue;
    end if;

    execute format('grant select, insert, update, delete on table public.%I to authenticated', _table);

    execute format('drop policy if exists %I on public.%I', _table || '_select_own', _table);
    execute format('drop policy if exists %I on public.%I', _table || '_insert_own', _table);
    execute format('drop policy if exists %I on public.%I', _table || '_update_own', _table);
    execute format('drop policy if exists %I on public.%I', _table || '_delete_own', _table);

    execute format(
      'create policy %I on public.%I for select to authenticated using (public.finscope_is_owner(user_id))',
      _table || '_select_own',
      _table
    );

    execute format(
      'create policy %I on public.%I for insert to authenticated with check (public.finscope_is_owner(user_id))',
      _table || '_insert_own',
      _table
    );

    execute format(
      'create policy %I on public.%I for update to authenticated using (public.finscope_is_owner(user_id)) with check (public.finscope_is_owner(user_id))',
      _table || '_update_own',
      _table
    );

    execute format(
      'create policy %I on public.%I for delete to authenticated using (public.finscope_is_owner(user_id))',
      _table || '_delete_own',
      _table
    );
  end loop;
end $$;

-- Backend-only tables:
-- Keep enabled RLS with no client policies. Access remains service-role/backend only.
--
-- users:
--   stores bcrypt password hashes and billing fields. Do not expose directly to authenticated users.
-- password_reset_tokens:
--   must remain fully private.
-- app_notifications:
--   currently fetched by backend. If the frontend later needs direct access, create a read-only policy.

-- Optional authenticated read policy for global notifications.
-- Leave commented unless you explicitly want direct client access through Supabase.
--
-- grant select on table public.app_notifications to authenticated;
-- drop policy if exists app_notifications_select_active on public.app_notifications;
-- create policy app_notifications_select_active
-- on public.app_notifications
-- for select
-- to authenticated
-- using (
--   is_active = true
--   and starts_at <= now()
--   and (expires_at is null or expires_at >= now())
-- );

commit;
