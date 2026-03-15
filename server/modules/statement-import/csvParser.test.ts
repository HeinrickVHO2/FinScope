import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeStatementDescription,
  parseBankStatementCsv,
  parseStatementAmount,
  parseStatementDate,
} from "./csvParser";

test("parseBankStatementCsv aceita delimitador ponto e vírgula e valores brasileiros", () => {
  const csv = [
    "Data;Descrição;Valor",
    "14/03/2026;Supermercado Bom Dia;-123,45",
    "15/03/2026;Salário;3500,00",
  ].join("\n");

  const parsed = parseBankStatementCsv(csv);
  assert.equal(parsed.delimiter, ";");
  assert.equal(parsed.totalRows, 2);
  assert.equal(parsed.parsedRows.length, 2);
  assert.equal(parsed.parsedRows[0].direction, "debit");
  assert.equal(parsed.parsedRows[0].amount, 123.45);
  assert.equal(parsed.parsedRows[1].direction, "credit");
  assert.equal(parsed.parsedRows[1].transactionDate, "2026-03-15");
});

test("helpers de normalização convertem data, valor e descrição", () => {
  assert.equal(parseStatementAmount("R$ 1.234,56"), 1234.56);
  assert.equal(parseStatementDate("14/03/26"), "2026-03-14");
  assert.equal(
    normalizeStatementDescription("  PIX MERCADO SÃO JOÃO  "),
    "pix mercado sao joao",
  );
});
