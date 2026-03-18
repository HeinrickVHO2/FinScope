import test from "node:test";
import assert from "node:assert/strict";
import { buildBroadcastEmailHtml, buildNotificationFeed, resolveAbsoluteNotificationRoute } from "./appNotificationService";

test("buildNotificationFeed combina alertas operacionais e notificacoes globais", () => {
  const feed = buildNotificationFeed({
    now: new Date("2026-03-17T12:00:00.000Z"),
    payables: [
      {
        id: "future-1",
        userId: "user-1",
        accountType: "PF",
        title: "Conta de luz",
        category: "Contas Fixas",
        amount: "180.00",
        dueDate: new Date("2026-03-16T12:00:00.000Z"),
        isRecurring: false,
        recurrenceType: null,
        status: "pending",
        createdAt: new Date("2026-03-15T12:00:00.000Z"),
      },
    ],
    broadcasts: [
      {
        id: "notice-1",
        title: "Nova atualizacao",
        message: "Agora voce pode acompanhar novidades direto no sino.",
        kind: "global_update",
        bucket: "updates",
        route: "/dashboard",
        ctaLabel: "Abrir painel",
        audience: "all",
        isActive: true,
        startsAt: new Date("2026-03-17T08:00:00.000Z"),
        expiresAt: null,
        sendEmail: false,
        emailSubject: null,
        metadata: null,
        createdBy: "ops",
        createdAt: new Date("2026-03-17T08:00:00.000Z"),
      },
    ],
  });

  assert.equal(feed.unreadCount, 2);
  assert.equal(feed.groups.attention.length, 1);
  assert.equal(feed.groups.updates.length, 1);
  assert.match(feed.notifications[0]?.title || "", /Conta atrasada|Nova atualizacao/);
});

test("buildBroadcastEmailHtml inclui CTA quando rota estiver presente", () => {
  const html = buildBroadcastEmailHtml({
    title: "Promo especial",
    message: "Teste 7 dias de uma funcao nova.",
    route: "https://finscope.com.br/novidades",
    ctaLabel: "Ver novidade",
    kind: "global_promotion",
  });

  assert.match(html, /Promo especial/);
  assert.match(html, /Ver novidade/);
  assert.match(html, /https:\/\/finscope\.com\.br\/novidades/);
});

test("resolveAbsoluteNotificationRoute converte rota interna para URL absoluta", () => {
  const url = resolveAbsoluteNotificationRoute("/dashboard", "https://app.finscope.com.br");
  assert.equal(url, "https://app.finscope.com.br/dashboard");
});
