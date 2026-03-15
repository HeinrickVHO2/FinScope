import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ArrowRight, Check, Shield, Timer } from "lucide-react";

const microClaims = [
  { icon: Shield, label: "Segurança e privacidade" },
  { icon: Timer, label: "Comece sem complicação" },
  { icon: Check, label: "Você no controle" },
];

export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-white text-slate-900">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(37,99,235,0.08),_transparent_35%)]" />
      <div className="absolute inset-y-0 right-0 w-[40%] bg-[radial-gradient(circle_at_center,_rgba(37,99,235,0.05),_transparent_45%)]" />

      <div className="relative max-w-6xl mx-auto px-4 pt-16 pb-12 md:pt-20 md:pb-20">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">
              Controle financeiro sem complicação
            </Badge>
            <div className="space-y-4">
              <h1 className="text-4xl md:text-5xl font-poppins font-bold leading-tight text-slate-900">
                Veja para onde seu dinheiro vai e planeje seu mês com mais tranquilidade.
              </h1>
              <p className="text-lg text-slate-600 leading-relaxed max-w-xl">
                O FinScope organiza sua rotina financeira em um painel simples para você acompanhar
                gastos, metas e contas sem planilhas confusas.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Link href="/signup">
                <Button size="lg" className="w-full sm:w-auto">
                  Cadastre-se
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link href="/login">
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full sm:w-auto border-primary/30 text-primary hover:bg-primary/5"
                >
                  Acessar
                </Button>
              </Link>
            </div>

            <div className="flex flex-wrap gap-3">
              {microClaims.map((claim) => (
                <div
                  key={claim.label}
                  className="flex items-center gap-2 text-sm px-3 py-2 rounded-full bg-primary/5 border border-primary/10"
                >
                  <claim.icon className="h-4 w-4 text-primary" />
                  <span className="text-slate-700">{claim.label}</span>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-6 text-sm text-slate-600">
              <div>
                <p className="font-semibold text-slate-900">Visão clara do mês</p>
                <p>Acompanhe entradas, saídas e metas no mesmo lugar</p>
              </div>
              <div>
                <p className="font-semibold text-slate-900">Rotina mais organizada</p>
                <p>Tome decisões com mais calma e previsibilidade</p>
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-8 bg-gradient-to-br from-primary/10 via-white to-transparent blur-3xl" />
            <Card className="relative bg-white text-slate-900 border border-slate-200 shadow-xl overflow-hidden">
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#2563eb] via-sky-400 to-emerald-400" />
              <CardHeader>
                <CardTitle className="font-poppins">Clareza do mês</CardTitle>
                <CardDescription className="text-slate-600">
                  Exemplo ilustrativo de como você pode acompanhar seu dinheiro no dia a dia.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-4 rounded-xl bg-muted/30 border border-slate-200">
                    <p className="text-xs text-slate-500">Entradas</p>
                    <p className="text-lg font-semibold text-slate-900">O que entrou</p>
                    <p className="text-slate-600 text-xs mt-1">Salário, vendas e extras</p>
                  </div>
                  <div className="p-4 rounded-xl bg-muted/30 border border-slate-200">
                    <p className="text-xs text-slate-500">Saídas</p>
                    <p className="text-lg font-semibold text-amber-600">O que saiu</p>
                    <p className="text-slate-600 text-xs mt-1">Contas, compras e assinaturas</p>
                  </div>
                  <div className="p-4 rounded-xl bg-muted/30 border border-slate-200">
                    <p className="text-xs text-slate-500">Saldo do mês</p>
                    <p className="text-lg font-semibold text-slate-900">Planejamento claro</p>
                    <p className="text-slate-600 text-xs mt-1">Com mais consciência ao gastar</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs text-slate-500 uppercase tracking-wide">
                    Evolução da sua organização
                  </p>
                  <div className="h-3 rounded-full bg-muted/30 border border-slate-200 overflow-hidden">
                    <div className="h-full w-[78%] bg-gradient-to-r from-[#2563eb] via-sky-400 to-emerald-400" />
                  </div>
                  <p className="text-xs text-slate-600">"Consegui enxergar meus gastos do mês com clareza."</p>
                </div>

                <div className="p-4 rounded-xl bg-muted/30 border border-slate-200 space-y-3">
                  <div>
                    <p className="text-xs text-slate-500">Resumo rápido</p>
                    <p className="text-sm font-medium text-slate-900">
                      "Agora eu sei para onde meu dinheiro estava indo."
                    </p>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-700">Exemplo de resultado</span>
                    <span className="text-emerald-600 font-semibold">Ex.: economizei R$ 220 no mês</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
}
