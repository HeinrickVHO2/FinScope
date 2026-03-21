import type { Transaction } from "@shared/schema";
import { apiFetch } from "@/lib/api";

type ExportBasicPdfParams = {
  scope: "PF" | "PJ" | "ALL";
  periodLabel: string;
};

export function resolveTransactionPeriodLabel(transactions: Transaction[]) {
  const timestamps = transactions
    .map((transaction) => {
      const parsed = new Date(transaction.date);
      return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
    })
    .filter((value): value is number => value !== null);

  if (!timestamps.length) {
    return "Sem movimentações registradas";
  }

  const startDate = new Date(Math.min(...timestamps));
  const endDate = new Date(Math.max(...timestamps));
  const formatLabel = (date: Date) =>
    `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;

  const startLabel = formatLabel(startDate);
  const endLabel = formatLabel(endDate);
  return startLabel === endLabel ? endLabel : `${startLabel} a ${endLabel}`;
}

export async function exportBasicPdf({ scope, periodLabel }: ExportBasicPdfParams) {
  const response = await apiFetch("/api/export/pro", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      type: scope,
      period: periodLabel,
    }),
  });

  if (!response.ok) {
    throw new Error("Não foi possível gerar o PDF.");
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `FinScope-relatorio-basico-${Date.now()}.pdf`;
  document.body.appendChild(anchor);
  anchor.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(anchor);
}
