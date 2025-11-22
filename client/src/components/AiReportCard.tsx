import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Sparkles, Lightbulb, AlertTriangle, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import UpgradeModal from "@/components/UpgradeModal";
import { LockedAiReport } from "@/components/LockedAiReport";
import { Skeleton } from "@/components/ui/skeleton";

type AiReportResponse = {
  insights: string[];
  tips: string[];
  warnings: string[];
  projections: string;
};

type AiReportSettings = {
  focusEconomy: boolean;
  focusDebt: boolean;
  focusInvestments: boolean;
};

const monthFormatter = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" });

export function AiReportCard() {
  const { toast } = useToast();
  const { user } = useAuth();
  const isPremium = user?.plan === "premium";

  const [data, setData] = useState<AiReportResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [settings, setSettings] = useState<AiReportSettings>({
    focusEconomy: false,
    focusDebt: false,
    focusInvestments: false,
  });
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);

  const currentPeriod = useMemo(() => {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    return `${now.getFullYear()}-${month}`;
  }, []);

  const readablePeriod = useMemo(() => {
    const [year, month] = currentPeriod.split("-");
    return monthFormatter.format(new Date(Number(year), Number(month) - 1, 1));
  }, [currentPeriod]);

  const fetchReport = useCallback(async () => {
    if (!isPremium) return;
    try {
      setIsLoading(true);
      const response = await apiFetch("/api/ai/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ period: currentPeriod }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Não foi possível gerar o relatório AI.");
      }

      const payload = await response.json();
      setData(payload);
    } catch (error) {
      setData(null);
      toast({
        title: "Não foi possível gerar o resumo inteligente",
        description: (error as Error).message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [currentPeriod, toast, isPremium]);

  useEffect(() => {
    if (!isPremium) return;
    let isMounted = true;
    async function fetchSettings() {
      try {
        const response = await apiFetch("/api/ai/report/settings", {
          credentials: "include",
        });
        if (response.ok) {
          const payload = await response.json();
          if (isMounted) {
            setSettings({
              focusEconomy: Boolean(payload.focusEconomy),
              focusDebt: Boolean(payload.focusDebt),
              focusInvestments: Boolean(payload.focusInvestments),
            });
            setSettingsError(null);
          }
        } else if (response.status === 403) {
          if (isMounted) {
            setSettingsError("Recurso disponível apenas para o plano Premium.");
          }
        }
      } catch (error) {
        console.error("[AI REPORT] erro ao obter preferências:", error);
        if (isMounted) {
          setSettingsError("Não foi possível carregar preferências personalizadas.");
        }
      }
    }

    fetchSettings().then(() => {
      if (isMounted) {
        fetchReport();
      }
    });

    return () => {
      isMounted = false;
    };
  }, [currentPeriod, fetchReport, isPremium]);

  const handleToggle = async (key: keyof AiReportSettings, value: boolean) => {
    if (!isPremium) {
      setIsUpgradeModalOpen(true);
      return;
    }
    const previousSettings = { ...settings };
    const nextSettings = { ...settings, [key]: value };
    setSettings(nextSettings);
    setIsSavingSettings(true);
    try {
      const response = await apiFetch("/api/ai/report/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(nextSettings),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "Não foi possível salvar preferências.");
      }
    } catch (error) {
      setSettings(previousSettings);
      toast({
        title: "Não foi possível salvar suas preferências",
        description: (error as Error).message,
        variant: "destructive",
      });
    } finally {
      setIsSavingSettings(false);
    }

    fetchReport();
  };

  const insights = data?.insights ?? [];
  const tips = data?.tips ?? [];
  const warnings = data?.warnings ?? [];

  if (!isPremium) {
    return (
      <>
        <LockedAiReport onUpgrade={() => setIsUpgradeModalOpen(true)} />
        <UpgradeModal
          open={isUpgradeModalOpen}
          onOpenChange={setIsUpgradeModalOpen}
          featureName="Relatório IA Premium"
        />
      </>
    );
  }

  return (
    <Card className="border-none bg-gradient-to-br from-indigo-50 to-white shadow-lg">
      <CardHeader className="space-y-2">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="text-2xl font-poppins text-slate-900 flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-indigo-500" />
              Resumo Inteligente do seu Mês
            </CardTitle>
            <CardDescription className="text-slate-600">
              Visão personalizada do período de {readablePeriod}. Geração automática pelo FinScope AI.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">Premium</Badge>
            <Badge variant="outline" className="border-amber-300 text-amber-700">
              Recomendado
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {settingsError ? (
          <p className="text-sm text-rose-500 bg-rose-50 border border-rose-100 rounded-xl p-3">
            {settingsError}
          </p>
        ) : (
          <div className="rounded-2xl border border-slate-100 bg-white/90 p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="border-indigo-200 text-indigo-700">
                Preferências do relatório
              </Badge>
              {isSavingSettings && (
                <span className="text-xs text-slate-500 flex items-center gap-1">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-500" />
                  Salvando
                </span>
              )}
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <PreferenceToggle
                label="Foco em economia"
                description="Prioriza dicas para reduzir gastos."
                checked={settings.focusEconomy}
                onCheckedChange={(checked) => handleToggle("focusEconomy", checked)}
              />
              <PreferenceToggle
                label="Foco em dívidas"
                description="Identifica pendências e riscos."
                checked={settings.focusDebt}
                onCheckedChange={(checked) => handleToggle("focusDebt", checked)}
              />
              <PreferenceToggle
                label="Foco em investimentos"
                description="Analisa oportunidades e metas."
                checked={settings.focusInvestments}
                onCheckedChange={(checked) => handleToggle("focusInvestments", checked)}
              />
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-indigo-100 bg-white/80 p-4 shadow-inner">
          <div className="flex items-center gap-2 text-sm font-medium text-indigo-600">
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            FinScope AI
          </div>
          <p className="text-sm text-slate-600 mt-2 whitespace-pre-line">
            {isLoading
              ? "Gerando resumo personalizado..."
              : data?.projections || "Gere o primeiro relatório para liberar os insights inteligentes."}
          </p>
        </div>

        {isLoading ? (
          <div className="grid gap-4 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-36 rounded-2xl" />
            ))}
          </div>
        ) : data ? (
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-2xl border border-slate-100 bg-white/90 p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Sparkles className="h-4 w-4 text-indigo-500" />
                Insights principais
              </div>
              {insights.length ? (
                <ul className="space-y-2 text-sm text-slate-600">
                  {insights.map((item, index) => (
                    <li key={index} className="flex gap-2">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-indigo-500" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Sem insights suficientes neste período.</p>
              )}
            </div>
            <div className="rounded-2xl border border-slate-100 bg-white/90 p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Lightbulb className="h-4 w-4 text-amber-500" />
                Dicas de economia
              </div>
              {tips.length ? (
                <ul className="space-y-2 text-sm text-slate-600">
                  {tips.map((tip, index) => (
                    <li key={index} className="flex gap-2">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-amber-400" />
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhuma sugestão disponível agora.</p>
              )}
            </div>
            <div className="rounded-2xl border border-slate-100 bg-white/90 p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <AlertTriangle className="h-4 w-4 text-rose-500" />
                Alertas e riscos
              </div>
              {warnings.length ? (
                <ul className="space-y-2 text-sm text-slate-600">
                  {warnings.map((warning, index) => (
                    <li key={index} className="flex gap-2">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-rose-500" />
                      <span>{warning}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Sem alertas críticos no momento.</p>
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Ainda não geramos insights suficientes neste período. Movimente sua conta para ver recomendações inteligentes.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

interface PreferenceToggleProps {
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

function PreferenceToggle({ label, description, checked, onCheckedChange }: PreferenceToggleProps) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-4 space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">{label}</p>
          <p className="text-xs text-slate-500">{description}</p>
        </div>
        <Switch checked={checked} onCheckedChange={onCheckedChange} />
      </div>
    </div>
  );
}
