import fs from "node:fs";
import puppeteer from "puppeteer";

type VisualPayload = Record<string, unknown>;

export type WhatsAppRenderedVisual = {
  buffer: Buffer;
  mimeType: string;
  filename: string;
  caption?: string;
};

export interface WhatsAppVisualRenderer {
  render(payload?: VisualPayload | null): Promise<WhatsAppRenderedVisual | null>;
}

const CHART_COLORS = ["#22c55e", "#0ea5e9", "#f97316", "#a855f7", "#facc15", "#ef4444"];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value) || 0);
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function toNumber(value: unknown) {
  return Number(Number(value || 0).toFixed(2));
}

function resolvePuppeteerExecutable() {
  const envPath = process.env.PUPPETEER_EXECUTABLE_PATH;
  if (envPath && fs.existsSync(envPath)) {
    return envPath;
  }

  try {
    const executablePath = puppeteer.executablePath();
    return executablePath && fs.existsSync(executablePath) ? executablePath : undefined;
  } catch (_error) {
    return undefined;
  }
}

function formatDateRange(data: VisualPayload | null) {
  const period = (data?.data || {}) as Record<string, unknown>;
  const periodData = (period.period || {}) as Record<string, unknown>;
  const start = String(periodData.start || "");
  const end = String(periodData.end || "");
  if (!start || !end) return null;

  const formatDate = (value: string) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString("pt-BR");
  };

  const formattedStart = formatDate(start);
  const formattedEnd = formatDate(end);
  if (!formattedStart || !formattedEnd) return null;
  return `${formattedStart} - ${formattedEnd}`;
}

function renderCards(cards: Array<Record<string, unknown>>) {
  if (!cards.length) return "";

  return `
    <section class="cards">
      ${cards.map((card) => `
        <article class="card">
          <span>${escapeHtml(card.label || "")}</span>
          <strong>${formatCurrency(toNumber(card.value))}</strong>
        </article>
      `).join("")}
    </section>
  `;
}

function formatCompactRangeLabel(items: Array<Record<string, unknown>>, fallbackIndex: number) {
  const firstDate = String(items[0]?.date || "");
  const lastDate = String(items[items.length - 1]?.date || "");
  const first = firstDate ? new Date(firstDate) : null;
  const last = lastDate ? new Date(lastDate) : null;

  if (first && !Number.isNaN(first.getTime()) && last && !Number.isNaN(last.getTime())) {
    const startDay = String(first.getDate()).padStart(2, "0");
    const endDay = String(last.getDate()).padStart(2, "0");
    return startDay === endDay ? startDay : `${startDay}-${endDay}`;
  }

  return `bloco ${fallbackIndex + 1}`;
}

function compactBarSeries(series: Array<Record<string, unknown>>) {
  if (series.length <= 8) {
    return {
      items: series.map((item) => ({
        label: String(item.label || item.date || "-"),
        amount: toNumber(item.amount),
      })),
      dense: false,
    };
  }

  const bucketCount = Math.min(5, Math.max(4, Math.ceil(series.length / 6)));
  const chunkSize = Math.ceil(series.length / bucketCount);
  const condensed: Array<{ label: string; amount: number }> = [];

  for (let index = 0; index < series.length; index += chunkSize) {
    const bucket = series.slice(index, index + chunkSize);
    condensed.push({
      label: formatCompactRangeLabel(bucket, condensed.length),
      amount: Number(bucket.reduce((sum, item) => sum + toNumber(item.amount), 0).toFixed(2)),
    });
  }

  return { items: condensed, dense: true };
}

function renderBarChart(series: Array<Record<string, unknown>>) {
  if (!series.length) return "";
  const compacted = compactBarSeries(series);
  const maxValue = compacted.items.reduce((best, item) => Math.max(best, toNumber(item.amount)), 0) || 1;

  return `
    <section class="panel">
      <div class="section-header">
        <h3>Gastos por dia</h3>
        <p>${compacted.dense ? "Visao consolidada do periodo" : "Visao dos ultimos dias registrados"}</p>
      </div>
      <div class="bar-chart">
        ${compacted.items.map((item, index) => {
          const amount = toNumber(item.amount);
          const height = Math.max(8, Math.round((amount / maxValue) * 180));
          return `
            <div class="bar-item">
              ${compacted.dense ? "" : `<span class="bar-value">${formatCurrency(amount)}</span>`}
              <div class="bar-shell">
                <div class="bar-fill" style="height:${height}px; background:${CHART_COLORS[index % CHART_COLORS.length]};"></div>
              </div>
              <span class="bar-label">${escapeHtml(item.label || "-")}</span>
            </div>
          `;
        }).join("")}
      </div>
      ${compacted.dense ? `<p class="chart-note">Mes consolidado em blocos para ficar legivel no WhatsApp.</p>` : ""}
    </section>
  `;
}

function renderBreakdown(series: Array<Record<string, unknown>>) {
  if (!series.length) return "";

  let runningPercent = 0;
  const stops = series
    .slice(0, 6)
    .map((item, index) => {
      const share = Math.max(0, Number(item.share || 0));
      const start = runningPercent;
      runningPercent += share * 100;
      return `${CHART_COLORS[index % CHART_COLORS.length]} ${start}% ${Math.min(100, runningPercent)}%`;
    })
    .join(", ");

  return `
    <section class="panel breakdown">
      <div class="section-header">
        <h3>Divisao por categoria</h3>
        <p>Principais categorias do periodo</p>
      </div>
      <div class="breakdown-body">
        <div class="pie" style="background: conic-gradient(${stops || "#dbeafe 0% 100%"});"></div>
        <div class="legend">
          ${series.slice(0, 6).map((item, index) => `
            <div class="legend-row">
              <span class="legend-dot" style="background:${CHART_COLORS[index % CHART_COLORS.length]};"></span>
              <span class="legend-name">${escapeHtml(item.label || item.category || "-")}</span>
              <strong>${Math.round(Number(item.share || 0) * 100)}%</strong>
              <span>${formatCurrency(toNumber(item.value ?? item.amount))}</span>
            </div>
          `).join("")}
        </div>
      </div>
    </section>
  `;
}

function renderLimits(limits: Array<Record<string, unknown>>) {
  if (!limits.length) return "";

  return `
    <section class="panel">
      <div class="section-header">
        <h3>Limites por categoria</h3>
        <p>Acompanhe o consumo dos seus limites</p>
      </div>
      <div class="limits">
        ${limits.slice(0, 6).map((item) => {
          const utilization = Math.max(0, Math.min(100, Math.round(Number(item.utilization || 0) * 100)));
          const status = String(item.status || "ok");
          const barColor = status === "exceeded" ? "#ef4444" : status === "warning" ? "#f97316" : "#22c55e";
          return `
            <div class="limit-card">
              <div class="limit-head">
                <strong>${escapeHtml(item.category || "Categoria")}</strong>
                <strong>${utilization}%</strong>
              </div>
              <div class="limit-track">
                <div class="limit-fill" style="width:${utilization}%; background:${barColor};"></div>
              </div>
              <div class="limit-foot">
                <span>${formatCurrency(toNumber(item.spent))}</span>
                <span>de ${formatCurrency(toNumber(item.limit))}</span>
              </div>
            </div>
          `;
        }).join("")}
      </div>
    </section>
  `;
}

function renderGoalProgress(progress: Record<string, unknown> | null) {
  if (!progress) return "";

  const current = toNumber(progress.current);
  const target = Math.max(1, toNumber(progress.target));
  const remaining = Math.max(0, toNumber(progress.remaining ?? (target - current)));
  const percentage = Math.max(0, Math.min(100, Number(progress.percentage || ((current / target) * 100))));

  return `
    <section class="panel goal-progress">
      <div class="goal-ring" style="background: conic-gradient(#f97316 0% ${percentage}%, #e5e7eb ${percentage}% 100%);">
        <div class="goal-ring-inner">
          <strong>${Math.round(percentage)}%</strong>
          <span>da meta</span>
        </div>
      </div>
      <div class="goal-metrics">
        <div class="goal-metric">
          <span>Guardado</span>
          <strong>${formatCurrency(current)}</strong>
        </div>
        <div class="goal-metric">
          <span>Falta</span>
          <strong>${formatCurrency(remaining)}</strong>
        </div>
        <div class="goal-metric full">
          <span>Objetivo</span>
          <strong>${formatCurrency(target)}</strong>
        </div>
      </div>
    </section>
  `;
}

function renderGoalList(series: Array<Record<string, unknown>>) {
  if (!series.length) return "";

  return `
    <section class="panel">
      <div class="section-header">
        <h3>Progresso das metas</h3>
        <p>Visao consolidada das metas ativas</p>
      </div>
      <div class="goal-list">
        ${series.map((item) => {
          const percentage = Math.max(0, Math.min(100, Number(item.percentage || 0)));
          return `
            <div class="goal-list-card">
              <div class="goal-list-head">
                <strong>${escapeHtml(item.label || item.title || "Meta")}</strong>
                <strong>${Math.round(percentage)}%</strong>
              </div>
              <div class="limit-track">
                <div class="limit-fill" style="width:${percentage}%; background:#22c55e;"></div>
              </div>
              <div class="limit-foot">
                <span>${formatCurrency(toNumber(item.current))}</span>
                <span>de ${formatCurrency(toNumber(item.target))}</span>
              </div>
            </div>
          `;
        }).join("")}
      </div>
    </section>
  `;
}

function renderHighlights(payload: VisualPayload | null) {
  const data = (payload?.data || {}) as Record<string, unknown>;
  const chart = (((payload?.ui_payload || {}) as Record<string, unknown>).chart || {}) as Record<string, unknown>;
  const increaseExplanation = String(chart.increaseExplanation || data.increaseExplanation || "").trim();
  const largestExpense = (data.largestExpense || chart.largestExpense || null) as Record<string, unknown> | null;
  const tips = Array.isArray(chart.tips) ? chart.tips as string[] : [];
  const alerts = Array.isArray(chart.alerts) ? chart.alerts as string[] : [];
  const notes: string[] = [];

  if (increaseExplanation) {
    notes.push(increaseExplanation);
  }

  if (largestExpense?.description) {
    notes.push(`Maior gasto: ${largestExpense.description} (${formatCurrency(toNumber(largestExpense.amount))})`);
  }

  for (const alert of alerts.slice(0, 2)) {
    notes.push(alert);
  }

  for (const tip of tips.slice(0, 2)) {
    notes.push(`Dica: ${tip}`);
  }

  if (!notes.length) return "";

  return `
    <section class="panel notes">
      ${notes.map((note) => `<p>${escapeHtml(note)}</p>`).join("")}
    </section>
  `;
}

function buildHtml(payload?: VisualPayload | null) {
  const safePayload = payload || null;
  const uiPayload = ((safePayload?.ui_payload || null) as Record<string, unknown> | null);
  if (!uiPayload?.type) return null;

  const cards = Array.isArray(uiPayload.cards) ? uiPayload.cards as Array<Record<string, unknown>> : [];
  const chart = (uiPayload.chart || {}) as Record<string, unknown>;
  const limits = Array.isArray(uiPayload.limits) ? uiPayload.limits as Array<Record<string, unknown>> : [];
  const series = Array.isArray(chart.series) ? chart.series as Array<Record<string, unknown>> : [];
  const breakdownSeries = Array.isArray(chart.breakdownSeries)
    ? chart.breakdownSeries as Array<Record<string, unknown>>
    : (Array.isArray(chart.series) ? chart.series as Array<Record<string, unknown>> : []);

  const title = escapeHtml(uiPayload.title || "Resumo financeiro");
  const subtitleParts = [String(uiPayload.subtitle || "").trim(), formatDateRange(safePayload)].filter(Boolean);
  const subtitle = subtitleParts.map((part) => escapeHtml(part)).join(" • ");

  let body = "";
  if (uiPayload.type === "financial_summary") {
    body = [
      renderCards(cards),
      renderBarChart(series),
      renderBreakdown(breakdownSeries),
      renderHighlights(safePayload),
    ].join("");
  } else if (uiPayload.type === "expense_breakdown") {
    body = [renderCards(cards), renderBreakdown(breakdownSeries)].join("");
  } else if (uiPayload.type === "limits_overview") {
    body = [renderLimits(limits)].join("");
  } else if (uiPayload.type === "goal_progress") {
    body = [renderGoalProgress((uiPayload.progress || null) as Record<string, unknown> | null)].join("");
  } else if (uiPayload.type === "goals_list") {
    body = [renderGoalList(series)].join("");
  } else if (uiPayload.type === "financial_guidance") {
    body = [
      renderCards(cards),
      renderBreakdown(breakdownSeries),
      renderHighlights(safePayload),
    ].join("");
  } else {
    return null;
  }

  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <style>
          :root {
            color-scheme: light;
            font-family: Arial, sans-serif;
          }
          * { box-sizing: border-box; }
          body {
            margin: 0;
            background: #f3f4f6;
            color: #111827;
          }
          .frame {
            width: 760px;
            padding: 24px;
          }
          .sheet {
            background: white;
            border-radius: 26px;
            padding: 24px;
            box-shadow: 0 18px 40px rgba(15, 23, 42, 0.12);
          }
          .header {
            display: block;
            margin-bottom: 20px;
          }
          .eyebrow {
            display: inline-flex;
            padding: 7px 12px;
            border-radius: 999px;
            background: #dcfce7;
            color: #166534;
            font-size: 12px;
            font-weight: 700;
            letter-spacing: 0.04em;
            text-transform: uppercase;
          }
          h1 {
            margin: 12px 0 6px;
            font-size: 34px;
            line-height: 1.08;
          }
          .subtitle {
            margin: 0;
            color: #4b5563;
            font-size: 17px;
          }
          .brand {
            margin-top: 10px;
            color: #16a34a;
            font-size: 14px;
            font-weight: 700;
          }
          .cards {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 12px;
            margin-bottom: 14px;
          }
          .card,
          .panel {
            border: 1px solid #e5e7eb;
            border-radius: 18px;
            background: #ffffff;
          }
          .card {
            padding: 16px;
            min-height: 84px;
          }
          .card span {
            display: block;
            color: #6b7280;
            font-size: 13px;
            margin-bottom: 8px;
          }
          .card strong {
            font-size: 23px;
            line-height: 1.1;
          }
          .panel {
            padding: 16px;
            margin-top: 12px;
          }
          .section-header {
            display: flex;
            justify-content: space-between;
            gap: 12px;
            align-items: flex-end;
            margin-bottom: 14px;
          }
          .section-header h3 {
            margin: 0;
            font-size: 20px;
          }
          .section-header p {
            margin: 0;
            color: #6b7280;
            font-size: 12px;
          }
          .bar-chart {
            display: flex;
            align-items: flex-end;
            gap: 12px;
            min-height: 200px;
          }
          .bar-item {
            flex: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 8px;
            min-width: 0;
          }
          .bar-value {
            font-size: 11px;
            color: #4b5563;
            text-align: center;
          }
          .bar-shell {
            width: 100%;
            height: 150px;
            display: flex;
            align-items: flex-end;
            justify-content: center;
            padding: 0 4px;
          }
          .bar-fill {
            width: 100%;
            border-radius: 12px 12px 6px 6px;
            box-shadow: inset 0 -18px 24px rgba(255, 255, 255, 0.24);
          }
          .bar-label {
            font-size: 12px;
            color: #374151;
            font-weight: 600;
            letter-spacing: 0.01em;
          }
          .chart-note {
            margin: 12px 0 0;
            color: #6b7280;
            font-size: 12px;
          }
          .breakdown-body {
            display: block;
          }
          .pie {
            width: 180px;
            height: 180px;
            border-radius: 999px;
            margin: 0 auto 16px;
          }
          .legend {
            display: flex;
            flex-direction: column;
            gap: 10px;
          }
          .legend-row {
            display: grid;
            grid-template-columns: 14px 1fr auto auto;
            gap: 8px;
            align-items: center;
            font-size: 13px;
          }
          .legend-dot {
            width: 14px;
            height: 14px;
            border-radius: 999px;
          }
          .legend-name {
            color: #111827;
            font-weight: 600;
          }
          .limits {
            display: flex;
            flex-direction: column;
            gap: 12px;
          }
          .goal-list {
            display: flex;
            flex-direction: column;
            gap: 12px;
          }
          .goal-list-card {
            border: 1px solid #e5e7eb;
            border-radius: 16px;
            padding: 14px;
            background: #fafafa;
          }
          .goal-list-head {
            display: flex;
            justify-content: space-between;
            gap: 12px;
            align-items: center;
            margin-bottom: 10px;
          }
          .goal-progress {
            text-align: center;
          }
          .goal-ring {
            width: 220px;
            height: 220px;
            border-radius: 999px;
            margin: 0 auto 18px;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .goal-ring-inner {
            width: 154px;
            height: 154px;
            border-radius: 999px;
            background: white;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            box-shadow: inset 0 0 0 1px #e5e7eb;
          }
          .goal-ring-inner strong {
            font-size: 40px;
            line-height: 1;
          }
          .goal-ring-inner span {
            margin-top: 6px;
            font-size: 16px;
            color: #6b7280;
          }
          .goal-metrics {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 12px;
          }
          .goal-metric {
            border: 1px solid #e5e7eb;
            border-radius: 16px;
            padding: 14px;
            text-align: left;
            background: #fafafa;
          }
          .goal-metric.full {
            grid-column: 1 / -1;
          }
          .goal-metric span {
            display: block;
            margin-bottom: 6px;
            font-size: 13px;
            color: #6b7280;
          }
          .goal-metric strong {
            font-size: 24px;
          }
          .limit-card {
            border: 1px solid #e5e7eb;
            border-radius: 16px;
            padding: 14px;
            background: #fafafa;
          }
          .limit-head,
          .limit-foot {
            display: flex;
            justify-content: space-between;
            gap: 12px;
            align-items: center;
          }
          .limit-head {
            margin-bottom: 10px;
          }
          .limit-track {
            width: 100%;
            height: 12px;
            border-radius: 999px;
            background: #e5e7eb;
            overflow: hidden;
          }
          .limit-fill {
            height: 100%;
            border-radius: 999px;
          }
          .limit-foot {
            margin-top: 8px;
            color: #4b5563;
            font-size: 12px;
          }
          .notes p {
            margin: 0;
            font-size: 15px;
            line-height: 1.5;
          }
          .notes p + p {
            margin-top: 8px;
          }
        </style>
      </head>
      <body>
        <main class="frame">
          <section class="sheet">
            <header class="header">
              <div>
                <span class="eyebrow">FinScope</span>
                <h1>${title}</h1>
                ${subtitle ? `<p class="subtitle">${subtitle}</p>` : ""}
              </div>
              <div class="brand">Assistente Financeiro</div>
            </header>
            ${body}
          </section>
        </main>
      </body>
    </html>
  `;
}

export class PuppeteerWhatsAppVisualRenderer implements WhatsAppVisualRenderer {
  async render(payload?: VisualPayload | null): Promise<WhatsAppRenderedVisual | null> {
    const uiPayload = ((payload?.ui_payload || null) as Record<string, unknown> | null);
    const html = buildHtml(payload);
    if (!uiPayload?.type || !html) return null;

    const browser = await puppeteer.launch({
      headless: true,
      executablePath: resolvePuppeteerExecutable(),
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
      protocolTimeout: Number(process.env.PUPPETEER_PROTOCOL_TIMEOUT || "90000"),
    });

    try {
      const page = await browser.newPage();
      await page.setViewport({ width: 820, height: 1400, deviceScaleFactor: 2 });
      await page.setContent(html, { waitUntil: "domcontentloaded" });
      const sheet = await page.$(".sheet");
      if (!sheet) return null;
      const screenshot = await sheet.screenshot({
        type: "png",
      });

      return {
        buffer: Buffer.from(screenshot),
        mimeType: "image/png",
        filename: `${String(uiPayload.type || "summary")}.png`,
        caption: uiPayload.type === "limits_overview"
          ? "Segue o relatorio visual dos seus limites."
          : uiPayload.type === "goal_progress" || uiPayload.type === "goals_list"
            ? "Segue o grafico das suas metas."
            : uiPayload.type === "financial_guidance"
              ? "Segue o contexto visual das suas dicas financeiras."
              : "Segue o grafico do seu resumo financeiro.",
      };
    } finally {
      await browser.close().catch(() => undefined);
    }
  }
}
