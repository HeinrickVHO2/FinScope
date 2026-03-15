import test from "node:test";
import assert from "node:assert/strict";
import { WhatsAppMediaService } from "./media";

test("WhatsAppMediaService does not derive textHint from raw image binary", async () => {
  const service = new WhatsAppMediaService();

  const prepared = await service.prepareMedia({
    id: "media-1",
    mimeType: "image/jpeg",
    base64: Buffer.from("JFIF\x00ICC_PROFILE fake binary", "utf8").toString("base64"),
  });

  assert.ok(prepared);
  assert.equal(prepared?.textHint || "", "");
});
