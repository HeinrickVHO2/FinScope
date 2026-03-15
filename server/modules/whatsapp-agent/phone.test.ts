import test from "node:test";
import assert from "node:assert/strict";
import { buildWhatsAppConversationUrl, normalizePhone } from "./phone";

test("normalizePhone preserva E.164 brasileiro valido sem duplicar o nono digito", () => {
  assert.equal(normalizePhone("+55 11 99787-3266"), "+5511997873266");
  assert.equal(normalizePhone("5511997873266"), "+5511997873266");
});

test("normalizePhone converte numero BR nacional para E.164 sem inserir digito extra", () => {
  assert.equal(normalizePhone("11 99787-3266"), "+5511997873266");
});

test("buildWhatsAppConversationUrl gera link final com numero BR correto", () => {
  assert.equal(
    buildWhatsAppConversationUrl("+55 11 99787-3266", "123456"),
    "https://wa.me/5511997873266?text=123456",
  );
});
