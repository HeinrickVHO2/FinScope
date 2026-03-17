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

function renderBarChart(series: Array<Record<string, unknown>>) {
  if (!series.length) return "";
  const maxValue = series.reduce((best, item) => Math.max(best, toNumber(item.amount)), 0) || 1;

  return `
    <section class="panel">
      <div class="section-header">
        <h3>Gastos por dia</h3>
        <p>Visao dos ultimos dias registrados</p>
      </div>
      <div class="bar-chart">
        ${series.map((item, index) => {
          const amount = toNumber(item.amount);
          const height = Math.max(8, Math.round((amount / maxValue) * 180));
          return `
            <div class="bar-item">
              <span class="bar-value">${formatCurrency(amount)}</span>
              <div class="bar-shell">
                <div class="bar-fill" style="height:${height}px; background:${CHART_COLORS[index % CHART_COLORS.length]};"></div>
              </div>
              <span class="bar-label">${escapeHtml(item.label || item.date || "-")}</span>
            </div>
          `;
        }).join("")}
      </div>
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

function renderHighlights(payload: VisualPayload | null) {
  const data = (payload?.data || {}) as Record<string, unknown>;
  const chart = (((payload?.ui_payload || {}) as Record<string, unknown>).chart || {}) as Record<string, unknown>;
  const increaseExplanation = String(chart.increaseExplanation || data.increaseExplanation || "").trim();
  const largestExpense = (data.largestExpense || chart.largestExpense || null) as Record<string, unknown> | null;
  const notes: string[] = [];

  if (increaseExplanation) {
    notes.push(increaseExplanation);
  }

  if (largestExpense?.description) {
    notes.push(`Maior gasto: ${largestExpense.description} (${formatCurrency(toNumber(largestExpense.amount))})`);
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
            width: 960px;
            padding: 32px;
          }
          .sheet {
            background: white;
            border-radius: 28px;
            padding: 32px;
            box-shadow: 0 18px 50px rgba(15, 23, 42, 0.12);
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 24px;
            margin-bottom: 24px;
          }
          .eyebrow {
            display: inline-flex;
            padding: 8px 14px;
            border-radius: 999px;
            background: #dcfce7;
            color: #166534;
            font-size: 14px;
            font-weight: 700;
            letter-spacing: 0.04em;
            text-transform: uppercase;
          }
          h1 {
            margin: 14px 0 8px;
            font-size: 42px;
            line-height: 1.05;
          }
          .subtitle {
            margin: 0;
            color: #4b5563;
            font-size: 20px;
          }
          .brand {
            text-align: right;
            color: #16a34a;
            font-size: 16px;
            font-weight: 700;
          }
          .cards {
            display: grid;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: 14px;
            margin-bottom: 18px;
          }
          .card,
          .panel {
            border: 1px solid #e5e7eb;
            border-radius: 20px;
            background: #ffffff;
          }
          .card {
            padding: 18px;
            min-height: 96px;
          }
          .card span {
            display: block;
            color: #6b7280;
            font-size: 15px;
            margin-bottom: 10px;
          }
          .card strong {
            font-size: 28px;
            line-height: 1.1;
          }
          .panel {
            padding: 20px;
            margin-top: 16px;
          }
          .section-header {
            display: flex;
            justify-content: space-between;
            gap: 12px;
            align-items: flex-end;
            margin-bottom: 18px;
          }
          .section-header h3 {
            margin: 0;
            font-size: 24px;
          }
          .section-header p {
            margin: 0;
            color: #6b7280;
            font-size: 14px;
          }
          .bar-chart {
            display: flex;
            align-items: flex-end;
            gap: 14px;
            min-height: 250px;
          }
          .bar-item {
            flex: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 10px;
          }
          .bar-value {
            font-size: 13px;
            color: #4b5563;
            text-align: center;
          }
          .bar-shell {
            width: 100%;
            height: 190px;
            display: flex;
            align-items: flex-end;
            justify-content: center;
            padding: 0 8px;
          }
          .bar-fill {
            width: 100%;
            border-radius: 16px 16px 8px 8px;
            box-shadow: inset 0 -18px 24px rgba(255, 255, 255, 0.24);
          }
          .bar-label {
            font-size: 15px;
            color: #374151;
            text-transform: lowercase;
          }
          .breakdown-body {
            display: grid;
            grid-template-columns: 280px 1fr;
            gap: 28px;
            align-items: center;
          }
          .pie {
            width: 240px;
            height: 240px;
            border-radius: 999px;
            margin: 0 auto;
          }
          .legend {
            display: flex;
            flex-direction: column;
            gap: 12px;
          }
          .legend-row {
            display: grid;
            grid-template-columns: 18px 1fr auto auto;
            gap: 10px;
            align-items: center;
            font-size: 15px;
          }
          .legend-dot {
            width: 18px;
            height: 18px;
            border-radius: 999px;
          }
          .legend-name {
            color: #111827;
            font-weight: 600;
          }
          .limits {
            display: flex;
            flex-direction: column;
            gap: 16px;
          }
          .limit-card {
            border: 1px solid #e5e7eb;
            border-radius: 18px;
            padding: 16px;
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
            margin-bottom: 12px;
          }
          .limit-track {
            width: 100%;
            height: 14px;
            border-radius: 999px;
            background: #e5e7eb;
            overflow: hidden;
          }
          .limit-fill {
            height: 100%;
            border-radius: 999px;
          }
          .limit-foot {
            margin-top: 10px;
            color: #4b5563;
            font-size: 14px;
          }
          .notes p {
            margin: 0;
            font-size: 18px;
            line-height: 1.5;
          }
          .notes p + p {
            margin-top: 10px;
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
      await page.setViewport({ width: 1024, height: 1200, deviceScaleFactor: 2 });
      await page.setContent(html, { waitUntil: "domcontentloaded" });
      const contentHeight = await page.evaluate(() => Math.ceil(document.body.scrollHeight));
      await page.setViewport({
        width: 1024,
        height: Math.max(800, Math.min(1600, contentHeight + 24)),
        deviceScaleFactor: 2,
      });

      const screenshot = await page.screenshot({
        type: "png",
        fullPage: true,
      });

      return {
        buffer: Buffer.from(screenshot),
        mimeType: "image/png",
        filename: `${String(uiPayload.type || "summary")}.png`,
        caption: uiPayload.type === "limits_overview"
          ? "Segue o relatorio visual dos seus limites."
          : "Segue o grafico do seu resumo financeiro.",
      };
    } finally {
      await browser.close().catch(() => undefined);
    }
  }
}
