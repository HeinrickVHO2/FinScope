import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

      <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pb-12 pt-16 md:pb-20 md:pt-20 lg:grid-cols-2">
        <div className="space-y-6">
          <Badge variant="outline" className="border-primary/20 bg-primary/5 text-primary">
            Controle financeiro sem complicação
          </Badge>

          <div className="space-y-4">
            <h1 className="font-poppins text-4xl font-bold leading-tight text-slate-900 md:text-5xl">
              Organize seu mês com clareza, metas e leitura financeira no mesmo painel.
            </h1>
            <p className="max-w-xl text-lg leading-relaxed text-slate-600">
              O FinScope reúne visão geral, resumo inteligente, assistente com IA e organização da rotina
              financeira em uma experiência direta para você acompanhar e decidir melhor.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
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
                className="w-full border-primary/30 text-primary hover:bg-primary/5 sm:w-auto"
              >
                Acessar
              </Button>
            </Link>
          </div>

          <div className="flex flex-wrap gap-3">
            {microClaims.map((claim) => (
              <div
                key={claim.label}
                className="flex items-center gap-2 rounded-full border border-primary/10 bg-primary/5 px-3 py-2 text-sm"
              >
                <claim.icon className="h-4 w-4 text-primary" />
                <span className="text-slate-700">{claim.label}</span>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-6 text-sm text-slate-600">
            <div>
              <p className="font-semibold text-slate-900">Painel limpo</p>
              <p>Saldo, receitas, despesas e fluxo no mesmo contexto</p>
            </div>
            <div>
              <p className="font-semibold text-slate-900">Resumo inteligente</p>
              <p>Leitura prática do mês com IA e menos trabalho manual</p>
            </div>
          </div>
        </div>

        <div className="relative">
          <div className="absolute -inset-8 bg-gradient-to-br from-primary/10 via-white to-transparent blur-3xl" />

          <div className="relative overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-[0_28px_80px_rgba(15,23,42,0.12)]">
            <img
              src="/landing/dashboard-1.png"
              alt="Visão geral do FinScope com resumo financeiro e resumo inteligente do mês"
              className="h-full w-full object-cover object-left-top"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
