create extension if not exists pgcrypto;

create table if not exists app_notifications (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  message text not null,
  kind text not null default 'global_update',
  bucket text not null default 'general',
  route text,
  cta_label text,
  audience text not null default 'all',
  is_active boolean not null default true,
  starts_at timestamp not null default now(),
  expires_at timestamp,
  send_email boolean not null default false,
  email_subject text,
  metadata jsonb,
  created_by text,
  created_at timestamp not null default now()
);

create index if not exists app_notifications_active_idx
  on app_notifications(is_active, starts_at, created_at desc);

create index if not exists app_notifications_expires_idx
  on app_notifications(expires_at);
