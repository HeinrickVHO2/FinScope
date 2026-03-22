import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, Check, Shield, Timer } from "lucide-react";
import { useAuth } from "@/lib/auth";

const microClaims = [
  { icon: Shield, label: "Seguranca e privacidade" },
  { icon: Timer, label: "Comece sem complicacao" },
  { icon: Check, label: "Voce no controle" },
];

export function HeroSection() {
  const { user } = useAuth();
  const primaryHref = user ? "/dashboard" : "/signup";
  const secondaryHref = user ? "/settings" : "/login";
  const primaryLabel = user ? "Ir para o painel" : "Cadastre-se";
  const secondaryLabel = user ? "Ver configuracoes" : "Acessar";

  return (
    <section className="relative overflow-hidden bg-white text-slate-900">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(37,99,235,0.08),_transparent_35%)]" />
      <div className="absolute inset-y-0 right-0 w-[40%] bg-[radial-gradient(circle_at_center,_rgba(37,99,235,0.05),_transparent_45%)]" />

      <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pb-12 pt-16 md:pb-20 md:pt-20 lg:grid-cols-2">
        <div className="space-y-6">
          <Badge variant="outline" className="border-primary/20 bg-primary/5 text-primary">
            Controle financeiro sem complicacao
          </Badge>

          <div className="space-y-4">
            <h1 className="font-poppins text-4xl font-bold leading-tight text-slate-900 md:text-5xl">
              Organize seu mes com clareza, metas e leitura financeira no mesmo painel.
            </h1>
            <p className="max-w-xl text-lg leading-relaxed text-slate-600">
              O FinScope reune visao geral, resumo inteligente, assistente com IA e organizacao da rotina
              financeira em uma experiencia direta para voce acompanhar e decidir melhor.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href={primaryHref}>
              <Button size="lg" className="w-full sm:w-auto">
                {primaryLabel}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href={secondaryHref}>
              <Button
                size="lg"
                variant="outline"
                className="w-full border-primary/30 text-primary hover:bg-primary/5 sm:w-auto"
              >
                {secondaryLabel}
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
              <p>Leitura pratica do mes com IA e menos trabalho manual</p>
            </div>
          </div>
        </div>

        <div className="relative">
          <div className="absolute -inset-8 bg-gradient-to-br from-primary/10 via-white to-transparent blur-3xl" />

          <div className="relative overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-[0_28px_80px_rgba(15,23,42,0.12)]">
            <img
              src="/landing/dashboard-1.png"
              alt="Visao geral do FinScope com resumo financeiro e resumo inteligente do mes"
              className="h-full w-full object-cover object-left-top"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
