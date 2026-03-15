import test from "node:test";
import assert from "node:assert/strict";
import { parseMetaWebhookPayload } from "./metaWebhook";

test("parseMetaWebhookPayload normalizes official Meta text message", () => {
  const events = parseMetaWebhookPayload({
    object: "whatsapp_business_account",
    entry: [
      {
        id: "entry-1",
        changes: [
          {
            field: "messages",
            value: {
              metadata: {
                display_phone_number: "5511300000000",
              },
              contacts: [{ wa_id: "5511999999999" }],
              messages: [
                {
                  id: "wamid-1",
                  from: "5511999999999",
                  timestamp: "1770000000",
                  type: "text",
                  text: {
                    body: "gastei 89,90 no mercado",
                  },
                },
              ],
            },
          },
        ],
      },
    ],
  });

  assert.equal(events.length, 1);
  assert.equal(events[0].provider, "whatsapp_cloud_api");
  assert.equal(events[0].providerMessageId, "wamid-1");
  assert.equal(events[0].fromPhone, "+5511999999999");
  assert.equal(events[0].toPhone, "+5511300000000");
  assert.equal(events[0].text, "gastei 89,90 no mercado");
});
