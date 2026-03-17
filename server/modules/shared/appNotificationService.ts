import type { AppNotification, FutureExpense } from "@shared/schema";

export type BellNotificationItem = {
  id: string;
  kind: string;
  bucket: string;
  severity: "high" | "medium" | "low";
  title: string;
  message: string;
  route?: string;
  ctaLabel?: string;
  createdAt: string;
};

type NotificationFeedParams = {
  payables: FutureExpense[];
  broadcasts: AppNotification[];
  now?: Date;
};

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
});

function formatCurrencyBRL(value: number) {
  return currencyFormatter.format(Number.isFinite(value) ? value : 0);
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isSameCalendarDay(left: Date, right: Date) {
  return left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate();
}

function isBroadcastActive(item: AppNotification, now: Date) {
  if (item.isActive === false) return false;
  const startsAt = item.startsAt ? new Date(item.startsAt) : now;
  const expiresAt = item.expiresAt ? new Date(item.expiresAt) : null;
  if (startsAt.getTime() > now.getTime()) return false;
  if (expiresAt && expiresAt.getTime() < now.getTime()) return false;
  return true;
}

function mapPayables(payables: FutureExpense[], now: Date): BellNotificationItem[] {
  const todayDate = startOfDay(now);
  const today = todayDate.getTime();
  const weekLimit = new Date(todayDate);
  weekLimit.setDate(weekLimit.getDate() + 7);

  const items = payables
    .filter((item) => item.status !== "paid")
    .map((item): BellNotificationItem | null => {
      const dueDate = new Date(item.dueDate);
      const dueTime = dueDate.getTime();
      const isOverdue = dueTime < today;
      const isDueToday = !isOverdue && isSameCalendarDay(dueDate, todayDate);
      const isDueThisWeek = !isOverdue && !isDueToday && dueTime <= weekLimit.getTime();
      if (!isOverdue && !isDueToday && !isDueThisWeek) return null;

      const bucket = isOverdue ? "overdue" : isDueToday ? "today" : "week";

      return {
        id: `payable-${item.id}`,
        kind: isOverdue ? "overdue_payable" : "upcoming_payable",
        bucket,
        severity: isOverdue ? "high" : isDueToday ? "high" : "medium",
        title: isOverdue ? "Conta atrasada" : isDueToday ? "Vence hoje" : "Vence nesta semana",
        message: `${item.title} ${isOverdue ? "venceu" : "vence"} em ${dueDate.toLocaleDateString("pt-BR")} no valor de ${formatCurrencyBRL(Number(item.amount || 0))}.`,
        route: "/future-expenses",
        ctaLabel: "Ver contas",
        createdAt: dueDate.toISOString(),
      } satisfies BellNotificationItem;
    });

  return items.filter((item): item is BellNotificationItem => item !== null);
}

function mapBroadcasts(broadcasts: AppNotification[], now: Date): BellNotificationItem[] {
  return broadcasts
    .filter((item) => isBroadcastActive(item, now))
    .map((item): BellNotificationItem => ({
      id: `broadcast-${item.id}`,
      kind: item.kind || "global_update",
      bucket: item.bucket || "general",
      severity: item.kind === "global_alert" ? "high" : item.kind === "global_promotion" ? "medium" : "low",
      title: item.title,
      message: item.message,
      route: item.route || undefined,
      ctaLabel: item.ctaLabel || undefined,
      createdAt: new Date(item.createdAt || now).toISOString(),
    }))
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
}

function sortNotifications(left: BellNotificationItem, right: BellNotificationItem) {
  const severityOrder = { high: 0, medium: 1, low: 2 } as const;
  const severityDiff = severityOrder[left.severity] - severityOrder[right.severity];
  if (severityDiff !== 0) return severityDiff;
  return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
}

export function buildNotificationFeed({
  payables,
  broadcasts,
  now = new Date(),
}: NotificationFeedParams) {
  const notifications = [...mapPayables(payables, now), ...mapBroadcasts(broadcasts, now)].sort(sortNotifications);

  const groups = {
    attention: notifications.filter((item) => ["overdue", "today", "week"].includes(item.bucket)),
    updates: notifications.filter((item) => item.kind === "global_update"),
    promotions: notifications.filter((item) => item.kind === "global_promotion"),
    general: notifications.filter((item) => item.kind === "global_alert" || item.bucket === "general"),
  };

  return {
    unreadCount: notifications.length,
    notifications,
    summary: {
      attention: groups.attention.length,
      updates: groups.updates.length,
      promotions: groups.promotions.length,
      general: groups.general.length,
    },
    groups,
  };
}

export function buildBroadcastEmailHtml(notification: Pick<AppNotification, "title" | "message" | "route" | "ctaLabel" | "kind">) {
  const accent = notification.kind === "global_promotion"
    ? "#ea580c"
    : notification.kind === "global_alert"
      ? "#dc2626"
      : "#2563eb";
  const cta = notification.route
    ? `
      <div style="margin-top:24px;">
        <a href="${notification.route}" style="display:inline-block;background:${accent};color:#fff;text-decoration:none;padding:12px 18px;border-radius:12px;font-weight:600;">
          ${notification.ctaLabel || "Abrir no FinScope"}
        </a>
      </div>
    `
    : "";

  return `
    <div style="font-family:Arial,sans-serif;background:#f8fafc;padding:24px;">
      <div style="max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:18px;overflow:hidden;">
        <div style="background:${accent};padding:18px 24px;color:#ffffff;">
          <div style="font-size:12px;letter-spacing:0.12em;text-transform:uppercase;opacity:0.9;">FinScope</div>
          <h1 style="margin:8px 0 0;font-size:24px;line-height:1.2;">${notification.title}</h1>
        </div>
        <div style="padding:24px;color:#0f172a;">
          <p style="margin:0;font-size:16px;line-height:1.6;">${notification.message}</p>
          ${cta}
        </div>
      </div>
    </div>
  `;
}
