import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import UpgradeModal from "@/components/UpgradeModal";
import { FileDown, Loader2, Lock } from "lucide-react";
import { useDashboardView } from "@/context/dashboard-view";

const REPORT_TYPES = [
  {
    value: "financeiro",
    label: "Financeiro completo",
    description: "KPIs consolidados, tabela de movimentos e ranking de categorias.",
  },
  {
    value: "receitas_despesas",
    label: "Receitas x Despesas",
    description: "Comparativo do período selecionado com foco em fluxo de caixa.",
  },
  {
    value: "empresarial",
    label: "Painel Empresarial",
    description: "Versão com foco em contas PJ e tributos.",
  },
] as const;

const PERIOD_OPTIONS = [
  { value: "last_30_days", label: "Últimos 30 dias" },
  { value: "last_quarter", label: "Último trimestre" },
  { value: "custom_period", label: "Período personalizado" },
  { value: "year_to_date", label: "Ano corrente" },
] as const;

interface ExportPdfPremiumModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ExportPdfPremiumModal({ open, onOpenChange }: ExportPdfPremiumModalProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const { selectedView } = useDashboardView();

  const [reportType, setReportType] = useState<typeof REPORT_TYPES[number]["value"]>("financeiro");
  const [period, setPeriod] = useState<typeof PERIOD_OPTIONS[number]["value"]>("last_30_days");
  const [includeCharts, setIncludeCharts] = useState(true);
  const [includeInsights, setIncludeInsights] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);

  const isPremiumUser = useMemo(() => user?.plan === "premium", [user?.plan]);

  const selectedTypeLabel = useMemo(
    () => REPORT_TYPES.find((option) => option.value === reportType)?.label ?? "Financeiro completo",
    [reportType]
  );

  const selectedPeriodLabel = useMemo(
    () => PERIOD_OPTIONS.find((option) => option.value === period)?.label ?? "Últimos 30 dias",
    [period]
  );

  const dashboardScope = useMemo<"PF" | "PJ" | "ALL">(() => {
    if (selectedView === "PJ") return "PJ";
    if (selectedView === "PF") return "PF";
    return "ALL";
  }, [selectedView]);

  const reportScope = useMemo<"PF" | "PJ" | "ALL">(() => {
    if (reportType === "empresarial") return "PJ";
    return dashboardScope;
  }, [reportType, dashboardScope]);

  useEffect(() => {
    if (!open) return;
    if (selectedView === "PJ" && isPremiumUser) {
      setReportType("empresarial");
    } else {
      setReportType("financeiro");
    }
  }, [selectedView, open, isPremiumUser]);

  async function handleExport() {
    if (reportScope === "PJ" && !isPremiumUser) {
      setIsUpgradeModalOpen(true);
      return;
    }
    setIsExporting(true);
    try {
      const response = await fetch("/api/pdf/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          type: selectedTypeLabel,
          period: selectedPeriodLabel,
          includeCharts,
          includeInsights,
          reportType: reportType,
          accountScope: reportScope,
        }),
      });

      if (!response.ok) {
        throw new Error("Não foi possível gerar o PDF agora. Tente novamente.");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `FinScope-premium-${reportType}-${Date.now()}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast({
        title: "PDF gerado com sucesso",
        description: "O download começou automaticamente. Confira sua pasta de downloads.",
      });
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Erro ao exportar PDF",
        description: (error as Error).message ?? "Tente novamente em instantes.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  }

  const handleUpgrade = () => {
    setIsUpgradeModalOpen(true);
  };

  const modalBody = isPremiumUser ? (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-2">
        <div>
          <p className="text-sm font-medium text-slate-900">Formato Premium A4</p>
          <p className="text-xs text-slate-500">
            Exportação com KPIs consolidados, tabelas estilizadas, placeholders para gráficos base64 e insights automáticos.
          </p>
        </div>
        <div className="rounded-lg bg-white/80 p-3 border border-amber-200 text-amber-900 text-xs">
          <strong>Atenção:</strong> o processo pode levar alguns minutos para carregar o engine de PDF no servidor. 
          O download iniciará automaticamente assim que o processamento for concluído.
        </div>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wide text-slate-500">Tipo de relatório</Label>
            <Select value={reportType} onValueChange={(value) => setReportType(value as typeof reportType)}>
              <SelectTrigger className="w-full rounded-xl border-slate-200 bg-white/80">
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                {REPORT_TYPES.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <div>
                      <p className="font-medium text-slate-900">{option.label}</p>
                      <p className="text-xs text-slate-500">{option.description}</p>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wide text-slate-500">Período</Label>
            <Select value={period} onValueChange={(value) => setPeriod(value as typeof period)}>
              <SelectTrigger className="w-full rounded-xl border-slate-200 bg-white/80">
                <SelectValue placeholder="Selecione o período" />
              </SelectTrigger>
              <SelectContent>
                {PERIOD_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-900">Incluir gráficos</p>
              <p className="text-xs text-slate-500">Os gráficos utilizam imagens base64 já geradas no backend.</p>
            </div>
            <Switch checked={includeCharts} onCheckedChange={setIncludeCharts} />
          </div>
          <div className="flex items-center justify-between border-t border-slate-100 pt-4">
            <div>
              <p className="text-sm font-medium text-slate-900">Incluir insights</p>
              <p className="text-xs text-slate-500">Comentários automáticos baseados nos KPIs do período.</p>
            </div>
            <Switch checked={includeInsights} onCheckedChange={setIncludeInsights} />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
        <div>
          <p className="text-sm font-semibold text-emerald-900">Formato executivo</p>
          <p className="text-xs text-emerald-700">Ideal para apresentar a investidores ou contabilidade.</p>
        </div>
        <Badge variant="secondary" className="bg-white text-emerald-600">
          Premium
        </Badge>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={() => onOpenChange(false)}>
          Cancelar
        </Button>
        <Button onClick={handleExport} disabled={isExporting}>
          {isExporting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Gerando PDF
            </>
          ) : (
            <>
              <FileDown className="mr-2 h-4 w-4" />
              Exportar PDF
            </>
          )}
        </Button>
      </div>
    </div>
  ) : (
    <div className="space-y-6 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
        <Lock className="h-8 w-8" />
      </div>
      <div className="space-y-2">
        <p className="text-lg font-semibold text-slate-900">Exportação Premium bloqueada</p>
        <p className="text-sm text-slate-500">
          Essa funcionalidade é exclusiva para clientes Premium. Faça o upgrade e libere PDFs executivos com KPIs,
          gráficos base64 e insights automáticos.
        </p>
      </div>
      <div className="rounded-2xl border border-primary/40 bg-primary/5 p-4 text-sm text-primary">
        Upgrade instantâneo com 10 dias de garantia total. Cancelou? Devolvemos 100%.
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Button variant="ghost" onClick={() => onOpenChange(false)}>
          Agora não
        </Button>
        <Button onClick={handleUpgrade}>Fazer upgrade agora</Button>
      </div>
    </div>
  );

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-full max-w-2xl rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-semibold tracking-tight">
              Exportar PDF Premium
            </DialogTitle>
            <DialogDescription>
              Personalize o relatório FinScope Premium em formato A4 com placeholders para gráficos base64, KPIs e
              insights.
            </DialogDescription>
          </DialogHeader>
          {modalBody}
        </DialogContent>
      </Dialog>
      <UpgradeModal open={isUpgradeModalOpen} onOpenChange={setIsUpgradeModalOpen} featureName="Relatórios Premium" />
    </>
  );
}

export default ExportPdfPremiumModal;
