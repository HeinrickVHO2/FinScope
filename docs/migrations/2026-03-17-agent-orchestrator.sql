create extension if not exists pgcrypto;

create table if not exists goals (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  title text not null,
  target_value numeric not null,
  created_at timestamp not null default now()
);

alter table if exists goals
  alter column user_id type text using user_id::text;

alter table if exists goals
  add column if not exists current_value numeric not null default 0,
  add column if not exists target_date timestamp,
  add column if not exists status text not null default 'active',
  add column if not exists archived_at timestamp,
  add column if not exists completed_at timestamp,
  add column if not exists metadata jsonb,
  add column if not exists updated_at timestamp not null default now();

create table if not exists goal_contributions (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references goals(id) on delete cascade,
  user_id text not null,
  amount numeric not null,
  contributed_at timestamp not null default now(),
  note text,
  created_at timestamp not null default now()
);

create index if not exists goal_contributions_goal_id_idx on goal_contributions(goal_id);
create index if not exists goal_contributions_user_id_idx on goal_contributions(user_id);

create table if not exists category_limits (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  category text not null,
  scope text not null default 'ALL',
  period text not null default 'monthly',
  amount numeric not null,
  created_at timestamp not null default now(),
  updated_at timestamp not null default now()
);

create unique index if not exists category_limits_user_category_scope_period_idx
  on category_limits(user_id, category, scope, period);
