import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, Check, Shield, Timer } from "lucide-react";

const microClaims = [
  { icon: Shield, label: "Segurança e privacidade" },
  { icon: Timer, label: "Comece sem complicação" },
  { icon: Check, label: "Você no controle" },
];

function DashboardHeroPreview() {
  return (
    <div className="relative overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-[0_28px_80px_rgba(15,23,42,0.12)]">
      <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-4">
        <span className="h-2.5 w-2.5 rounded-full bg-rose-300" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
      </div>

      <div className="grid min-h-[520px] grid-cols-[96px_1fr] bg-slate-50 md:grid-cols-[118px_1fr]">
        <aside className="border-r border-slate-200 bg-white px-3 py-5">
          <div className="mb-6 text-sm font-semibold text-primary md:text-base">FINSCOPE</div>
          <div className="space-y-2 text-[11px] text-slate-500 md:text-xs">
            {["Início", "Minha empresa", "Contas a pagar", "WhatsApp", "Assistente", "Metas"].map((item, index) => (
              <div
                key={item}
                className={`rounded-xl px-3 py-2 ${index === 0 ? "bg-slate-100 font-medium text-slate-900" : ""}`}
              >
                {item}
              </div>
            ))}
          </div>
        </aside>

        <div className="relative p-4 md:p-6">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Suas finanças em um só lugar</p>
              <h2 className="mt-2 font-poppins text-2xl font-bold text-slate-900 md:text-[2rem]">Visão geral</h2>
            </div>
            <div className="hidden gap-2 md:flex">
              {["Conta Pessoal", "Minha empresa", "Visão Total"].map((item) => (
                <div key={item} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[26px] border border-slate-200 bg-white p-4 md:p-5">
            <p className="text-sm text-slate-500">Resumo do período</p>
            <h3 className="mt-1 text-2xl font-semibold text-slate-900">Finanças Pessoais</h3>

            <div className="mt-4 grid gap-3 md:grid-cols-4">
              {[
                ["Saldo", "R$ 2.945,01"],
                ["Receitas", "R$ 0,00"],
                ["Despesas", "R$ 4.040,00"],
                ["Fluxo", "R$ -4.040,00"],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs text-slate-500">{label}</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5 rounded-[26px] border border-primary/10 bg-primary/[0.03] p-4 md:p-5">
            <div className="flex items-center gap-2">
              <span className="text-lg text-primary">✦</span>
              <h3 className="text-xl font-semibold text-slate-900">Resumo inteligente do mês</h3>
            </div>
            <p className="mt-2 text-sm text-slate-600">
              Visão personalizada do período, com alertas, leitura dos movimentos e próximos passos.
            </p>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {[
                "Foco em economia",
                "Foco em dívidas",
                "Foco em investimentos",
              ].map((item, index) => (
                <div key={item} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-sm font-medium text-slate-900">{item}</p>
                  <div className="mt-4 flex justify-end">
                    <div className={`h-7 w-14 rounded-full ${index === 1 ? "bg-primary" : "bg-slate-300"} p-1`}>
                      <div className={`h-5 w-5 rounded-full bg-white ${index === 1 ? "ml-auto" : ""}`} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="absolute bottom-5 right-5 w-[300px] rounded-[26px] border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-200 px-4 py-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Finscope IA</p>
                <p className="mt-1 text-xl font-semibold text-slate-900">Assistente com IA</p>
                <p className="mt-1 text-sm text-slate-500">Registre gastos e metas sem sair da tela.</p>
              </div>
              <span className="text-slate-400">×</span>
            </div>

            <div className="space-y-3 px-4 py-4">
              <div className="rounded-2xl rounded-tl-md border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                Anotado! R$ 3.900,00 pela compra do relógio na conta pessoal.
              </div>
              <div className="ml-auto rounded-2xl rounded-tr-md bg-primary px-4 py-3 text-sm text-white">
                Recebi meu salário de 6200 reais
              </div>
              <div className="rounded-2xl rounded-tl-md border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                Isso é da sua conta pessoal ou da sua empresa?
              </div>
            </div>

            <div className="border-t border-slate-200 px-4 py-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-400">
                Ex.: Recebi 2.000 de salário
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

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
              Organize seu dinheiro com visão clara, metas e rotina financeira no mesmo painel.
            </h1>
            <p className="max-w-xl text-lg leading-relaxed text-slate-600">
              O FinScope une visão geral, contas previstas, WhatsApp e assistente com IA em uma experiência
              direta para você registrar, acompanhar e decidir melhor ao longo do mês.
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
              <p>Saldo, fluxo de caixa, resumos e decisões no mesmo contexto</p>
            </div>
            <div>
              <p className="font-semibold text-slate-900">Menos trabalho manual</p>
              <p>Use IA e WhatsApp sem perder clareza na operação do dia a dia</p>
            </div>
          </div>
        </div>

        <div className="relative">
          <div className="absolute -inset-8 bg-gradient-to-br from-primary/10 via-white to-transparent blur-3xl" />
          <div className="relative scale-[0.95] origin-top-right md:scale-100">
            <DashboardHeroPreview />
          </div>
        </div>
      </div>
    </section>
  );
}
