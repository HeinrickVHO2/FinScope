import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Lock, AlertTriangle } from "lucide-react";
import { BILLING_PLANS } from "@shared/plans";

interface LockedAiReportProps {
  onUpgrade: () => void;
}

export function LockedAiReport({ onUpgrade }: LockedAiReportProps) {
  return (
    <Card className="border-2 border-dashed border-slate-200 bg-gradient-to-br from-slate-50 to-white shadow-none">
      <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-2xl font-semibold">
            <Sparkles className="h-5 w-5 text-indigo-500" />
            Resumo inteligente do mês
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Veja análises mais completas, alertas e interpretações ao ativar o Premium.
          </p>
          <p className="mt-2 text-sm font-medium text-primary">{BILLING_PLANS.premium.commercialCopy.dailyPriceLabel}</p>
        </div>
        <Badge className="bg-slate-900 text-white">FinScope Premium</Badge>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6">
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 px-6 text-center backdrop-blur-sm">
            <Lock className="mb-3 h-8 w-8 text-slate-500" />
            <p className="text-base font-semibold text-slate-800">Prévia bloqueada</p>
            <p className="text-sm text-muted-foreground">
              Receba previsões, alertas e insights premium com ajuda da IA avançada.
            </p>
          </div>
          <div className="pointer-events-none select-none space-y-4 opacity-50">
            <div className="h-4 w-2/3 rounded-full bg-slate-200" />
            <div className="grid gap-3 md:grid-cols-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="space-y-2 rounded-xl border border-slate-100 p-4">
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <AlertTriangle className="h-4 w-4" />
                    Insight {index + 1}
                  </div>
                  <div className="h-3 rounded-full bg-slate-100" />
                  <div className="h-3 w-4/5 rounded-full bg-slate-100" />
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-900">Desbloqueie agora</p>
            <p className="text-sm text-muted-foreground">
              Atualize seu plano para liberar relatórios com IA, dicas mais úteis e alertas inteligentes.
            </p>
            <p className="mt-1 text-sm text-primary">{BILLING_PLANS.premium.commercialCopy.upsellSupport}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button onClick={onUpgrade} className="bg-indigo-600 hover:bg-indigo-700">
              Ver plano Premium
            </Button>
            <Button variant="outline" onClick={onUpgrade}>
              Conhecer benefícios
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
