import test from "node:test";
import assert from "node:assert/strict";
import { extractInvoiceDate, parseInvoiceCalendarDate, parseInvoiceText } from "./invoiceParser";

test("parseInvoiceText extracts total and items from OCR-like Brazilian receipt text", () => {
  const parsed = parseInvoiceText(`
SUPERMERCADO TRIUNFO LTDA
RUA SETE, 349 - VL VERDE - LONDRINA PR
14/03/2026 20:56:28
7891913573017 File de Peito 0,341 kg 19,99 6,81
7894905392903 Acougue Bovino 1 un 9,99 9,99
7891095305012 Lava Roupas Bril 1 un 14,90 14,90
Subtotal 52,52
Valor pago 52,52
`);

  assert.ok(parsed);
  assert.equal(parsed?.merchant, "SUPERMERCADO TRIUNFO LTDA");
  assert.equal(parsed?.total, 52.52);
  assert.equal(parsed?.date, "14/03/2026");
  assert.ok((parsed?.items.length || 0) >= 2);
});

test("extractInvoiceDate prioritizes issuance date over lower-priority dates in the document", () => {
  const extracted = extractInvoiceDate(`
Autorizacao: 13/03/2026 23:58:00
Data de emissao: 14/03/2026 00:02:00
Valor total 52,52
`);

  assert.equal(extracted, "14/03/2026");
});

test("parseInvoiceCalendarDate keeps invoice day stable when converted to ISO", () => {
  const parsed = parseInvoiceCalendarDate("14/03/2026");

  assert.ok(parsed);
  assert.equal(parsed?.toISOString().slice(0, 10), "2026-03-14");
});
