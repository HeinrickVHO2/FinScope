import test from "node:test";
import assert from "node:assert/strict";
import { CsvStatementParser } from "./parsers/CsvStatementParser";
import { OfxStatementParser } from "./parsers/OfxStatementParser";

test("CsvStatementParser parses standard bank csv", async () => {
  const parser = new CsvStatementParser();
  const csv = [
    "data;descricao;valor;tipo",
    "05/03/2026;Mercado Bairro;-120,90;debito",
    "06/03/2026;PIX Cliente;450,00;credito",
  ].join("\n");

  const entries = await parser.parse(Buffer.from(csv, "utf8"));
  assert.equal(entries.length, 2);
  assert.equal(entries[0].description, "Mercado Bairro");
  assert.equal(entries[0].amount, 120.9);
  assert.equal(entries[0].direction, "debit");
  assert.equal(entries[1].direction, "credit");
});

test("OfxStatementParser parses stmt transactions", async () => {
  const parser = new OfxStatementParser();
  const ofx = [
    "<OFX>",
    "<BANKMSGSRSV1>",
    "<STMTTRNRS>",
    "<STMTRS>",
    "<BANKTRANLIST>",
    "<STMTTRN>",
    "<TRNTYPE>DEBIT",
    "<DTPOSTED>20260305",
    "<TRNAMT>-89.50",
    "<MEMO>Padaria Centro",
    "</STMTTRN>",
    "<STMTTRN>",
    "<TRNTYPE>CREDIT",
    "<DTPOSTED>20260306",
    "<TRNAMT>1500.00",
    "<NAME>Salario",
    "</STMTTRN>",
    "</BANKTRANLIST>",
    "</STMTRS>",
    "</STMTTRNRS>",
    "</BANKMSGSRSV1>",
    "</OFX>",
  ].join("\n");

  const entries = await parser.parse(Buffer.from(ofx, "utf8"));
  assert.equal(entries.length, 2);
  assert.equal(entries[0].direction, "debit");
  assert.equal(entries[0].amount, 89.5);
  assert.equal(entries[1].direction, "credit");
});

