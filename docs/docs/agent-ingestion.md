# FinScope Agent Ingestion Architecture

## Scope
This module delivers two new capabilities:
- Bank statement upload/import (`PDF`, `CSV`, `OFX`) with reconciliation and review before persistence.
- WhatsApp agent ingestion for text/media, with confidence-based automation and audit trail.

The implementation is modular and does not depend on a single provider or database API surface.

## Backend Modules

### `server/modules/statement-import`
- `parsers/StatementParser.ts`: parser contract.
- `parsers/CsvStatementParser.ts`: CSV parser.
- `parsers/OfxStatementParser.ts`: OFX parser.
- `parsers/PdfStatementParser.ts`: PDF parser (heuristic extraction; safe fallback).
- `normalizer.ts`: canonical normalization + fingerprint.
- `reconciliationEngine.ts`: score-based matching by amount/date/description/type with configurable tolerance.
- `repository.ts`: persistence of uploads, entries, reconciliation links, logs.
- `service.ts`: async job orchestration, summary generation, manual status updates, confirmation import.
- `routes.ts`: API endpoints.

### `server/modules/whatsapp-agent`
- `intentParser.ts`: intent extraction (`income`/`expense`, amount, description, date, confidence).
- `ocr.ts`: OCR provider interface + mock implementation.
- `repository.ts`: inbound messages, media evidence, candidates, logs, phone bindings.
- `service.ts`: webhook processing, idempotency, user resolution by phone, auto-confirm or pending review.
- `routes.ts`: webhook + internal management endpoints.

## Data Model
Migration file: `create_agent_ingestion_tables.sql`

Tables created:
- `bank_statement_uploads`
- `bank_statement_entries`
- `transaction_reconciliations`
- `import_processing_logs`
- `user_phone_bindings`
- `inbound_messages`
- `media_evidence`
- `agent_transaction_candidates`
- `whatsapp_processing_logs`

## Statement Import Flow
1. Client uploads file (base64 + metadata + account target).
2. API validates size/type/security and creates processing job.
3. Parser extracts entries.
4. Normalizer generates canonical schema and fingerprint.
5. Reconciliation engine compares against existing transactions.
6. API exposes summary: total/new/reconciled/duplicated/conflicts.
7. User reviews statuses and optionally ignores items.
8. User confirms import; only eligible entries are persisted as transactions.
9. Audit logs and reconciliation links are retained.

## WhatsApp Flow
1. Webhook receives inbound event.
2. Signature is validated (`x-finscope-signature` / `x-whatsapp-signature`).
3. Event idempotency via `provider_message_id` uniqueness.
4. User is mapped from normalized phone binding.
5. Media evidence is saved and OCR adapter is invoked (mock in this phase).
6. NLP parser extracts financial intent + confidence.
7. If confidence is high and required fields exist, transaction is auto-created.
8. Otherwise candidate is marked `pending_review`.
9. Everything is logged for traceability.

## API Endpoints

### Statement import
- `POST /api/statement-imports/uploads`
- `GET /api/statement-imports/uploads`
- `GET /api/statement-imports/uploads/:uploadId`
- `POST /api/statement-imports/uploads/:uploadId/entries/:entryId/status`
- `POST /api/statement-imports/uploads/:uploadId/confirm`

### WhatsApp agent
- `POST /api/integrations/whatsapp/webhook`
- `POST /api/whatsapp/mock-event`
- `GET /api/whatsapp/phone-binding`
- `POST /api/whatsapp/phone-binding`
- `GET /api/whatsapp/candidates`
- `POST /api/whatsapp/candidates/:candidateId/confirm`

## Frontend
- New page: `client/src/pages/statement-imports.tsx`
- New route: `/statement-imports`
- Sidebar item: `Importar Extrato`

## Security and Audit
- File validation by type, size and malicious pattern checks.
- Signature validation for webhook.
- Idempotent inbound processing.
- No silent overwrite of user transactions.
- Processing logs for both pipelines.

## TODOs for External Integrations
- Replace `MockOcrProvider` with real OCR/document understanding provider.
- Replace generic WhatsApp payload adapter with provider-specific implementation (Cloud API, Twilio, Z-API, etc).
- Add durable queue (Redis/SQS/RabbitMQ) for asynchronous processing in production.
- Add encrypted object storage for uploaded statements and media evidence.
- Add conversational confirmation loop on WhatsApp for missing fields.
- Expand PDF extraction with bank-specific templates or OCR fallback.
- Add Open Finance connector module (future phase) reusing normalizer + reconciliation engine.

