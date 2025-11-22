import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Lock, AlertTriangle } from "lucide-react";

interface LockedAiReportProps {
  onUpgrade: () => void;
}

export function LockedAiReport({ onUpgrade }: LockedAiReportProps) {
  return (
    <Card className="border-dashed border-2 border-slate-200 bg-gradient-to-br from-slate-50 to-white shadow-none">
      <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle className="text-2xl font-semibold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-indigo-500" />
            Resumo Inteligente do seu Mês
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Visualize insights gerados pela FinScope AI ao destravar o plano Premium.
          </p>
        </div>
        <Badge className="bg-slate-900 text-white">FinScope Premium</Badge>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="relative rounded-2xl border border-slate-200 bg-white p-6 overflow-hidden">
          <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center text-center px-6">
            <Lock className="h-8 w-8 text-slate-500 mb-3" />
            <p className="text-base font-semibold text-slate-800">Prévia bloqueada</p>
            <p className="text-sm text-muted-foreground">
              Gere previsões e alertas com ajuda da IA exclusiva para clientes Premium.
            </p>
          </div>
          <div className="space-y-4 opacity-50 pointer-events-none select-none">
            <div className="h-4 w-2/3 rounded-full bg-slate-200" />
            <div className="grid gap-3 md:grid-cols-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="rounded-xl border border-slate-100 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <AlertTriangle className="h-4 w-4" />
                    Insight {index + 1}
                  </div>
                  <div className="h-3 rounded-full bg-slate-100" />
                  <div className="h-3 rounded-full bg-slate-100 w-4/5" />
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-900">Desbloqueie agora</p>
            <p className="text-sm text-muted-foreground">
              Atualize seu plano para receber dicas personalizadas e alertas inteligentes.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button onClick={onUpgrade} className="bg-indigo-600 hover:bg-indigo-700">
              Fazer upgrade para Premium
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
