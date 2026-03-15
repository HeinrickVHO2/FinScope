-- Agent-oriented statement imports + WhatsApp ingestion
-- Safe to run incrementally.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS bank_statement_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  account_id text NOT NULL,
  file_name text NOT NULL,
  file_type text NOT NULL CHECK (file_type IN ('pdf', 'csv', 'ofx')),
  file_size_bytes integer NOT NULL,
  upload_status text NOT NULL DEFAULT 'received' CHECK (upload_status IN ('received', 'validated', 'rejected')),
  processing_status text NOT NULL DEFAULT 'queued' CHECK (processing_status IN ('queued', 'processing', 'completed', 'failed')),
  date_tolerance_days integer NOT NULL DEFAULT 3,
  summary jsonb,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bank_statement_uploads_user_created_at
  ON bank_statement_uploads (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS bank_statement_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_id uuid NOT NULL REFERENCES bank_statement_uploads(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  line_number integer NOT NULL,
  raw_payload jsonb,
  raw_text text,
  original_description text NOT NULL,
  normalized_description text NOT NULL,
  amount numeric(14,2) NOT NULL,
  transaction_date timestamptz NOT NULL,
  direction text NOT NULL CHECK (direction IN ('credit', 'debit')),
  currency text NOT NULL DEFAULT 'BRL',
  fingerprint text NOT NULL,
  reconciliation_status text NOT NULL DEFAULT 'pending_review' CHECK (reconciliation_status IN ('pending_review', 'matched', 'imported', 'duplicate', 'conflict', 'ignored')),
  matched_transaction_id text,
  confidence_score numeric(5,4),
  reconciliation_reason text,
  created_transaction_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bank_statement_entries_upload_line
  ON bank_statement_entries (upload_id, line_number);

CREATE INDEX IF NOT EXISTS idx_bank_statement_entries_user_fingerprint
  ON bank_statement_entries (user_id, fingerprint);

CREATE TABLE IF NOT EXISTS transaction_reconciliations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_id uuid NOT NULL REFERENCES bank_statement_uploads(id) ON DELETE CASCADE,
  statement_entry_id uuid NOT NULL REFERENCES bank_statement_entries(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  matched_transaction_id text,
  reconciliation_status text NOT NULL CHECK (reconciliation_status IN ('pending_review', 'matched', 'imported', 'duplicate', 'conflict', 'ignored')),
  confidence_score numeric(5,4),
  score_breakdown jsonb,
  reason text,
  decided_by text NOT NULL DEFAULT 'system' CHECK (decided_by IN ('system', 'user', 'agent')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transaction_reconciliations_user_status
  ON transaction_reconciliations (user_id, reconciliation_status);

CREATE TABLE IF NOT EXISTS import_processing_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_id uuid REFERENCES bank_statement_uploads(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  level text NOT NULL CHECK (level IN ('info', 'warn', 'error')),
  event text NOT NULL,
  message text NOT NULL,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_import_processing_logs_upload_created
  ON import_processing_logs (upload_id, created_at DESC);

CREATE TABLE IF NOT EXISTS user_phone_bindings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  phone_e164 text NOT NULL UNIQUE,
  provider text NOT NULL DEFAULT 'whatsapp_cloud_api',
  is_verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_phone_bindings_user
  ON user_phone_bindings (user_id);

CREATE TABLE IF NOT EXISTS inbound_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  provider_message_id text NOT NULL UNIQUE,
  user_id text,
  from_phone text NOT NULL,
  to_phone text,
  message_type text NOT NULL,
  text_body text,
  raw_payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'received',
  confidence_score numeric(5,4),
  extracted_payload jsonb,
  error_message text,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inbound_messages_user_created
  ON inbound_messages (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_inbound_messages_status
  ON inbound_messages (status);

CREATE TABLE IF NOT EXISTS media_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inbound_message_id uuid NOT NULL REFERENCES inbound_messages(id) ON DELETE CASCADE,
  user_id text,
  media_type text NOT NULL,
  mime_type text,
  storage_path text NOT NULL,
  sha256 text NOT NULL,
  file_size_bytes integer NOT NULL DEFAULT 0,
  ocr_text text,
  ocr_confidence numeric(5,4),
  status text NOT NULL DEFAULT 'processed',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_media_evidence_message
  ON media_evidence (inbound_message_id, created_at DESC);

CREATE TABLE IF NOT EXISTS agent_transaction_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  inbound_message_id uuid NOT NULL REFERENCES inbound_messages(id) ON DELETE CASCADE,
  proposed_type text NOT NULL CHECK (proposed_type IN ('income', 'expense')),
  amount numeric(14,2) NOT NULL,
  currency text NOT NULL DEFAULT 'BRL',
  description text NOT NULL,
  merchant_name text,
  category_suggestion text,
  transaction_date timestamptz NOT NULL,
  confidence_score numeric(5,4) NOT NULL,
  status text NOT NULL DEFAULT 'pending_review' CHECK (status IN ('pending_review', 'confirmed', 'ignored', 'error')),
  persisted_transaction_id text,
  evidence jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_transaction_candidates_user_status
  ON agent_transaction_candidates (user_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS whatsapp_processing_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inbound_message_id uuid NOT NULL REFERENCES inbound_messages(id) ON DELETE CASCADE,
  user_id text,
  level text NOT NULL CHECK (level IN ('info', 'warn', 'error')),
  event text NOT NULL,
  message text NOT NULL,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_processing_logs_message_created
  ON whatsapp_processing_logs (inbound_message_id, created_at DESC);

