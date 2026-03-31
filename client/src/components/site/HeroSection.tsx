import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, Brain, CheckCircle2, Clock3, ShieldCheck } from "lucide-react";
import { useAuth } from "@/lib/auth";

const trustSignals = [
  { icon: Brain, label: "IA que organiza seus gastos sem planilha" },
  { icon: ShieldCheck, label: "Checkout com 14 dias de garantia" },
  { icon: Clock3, label: "Comece em poucos minutos" },
];

const heroBullets = [
  "Descubra para onde seu dinheiro está escapando antes do fim do mês apertar",
  "Separe vida pessoal e negócio sem montar uma rotina complicada",
  "Veja saldo, despesas e próximos impactos em uma tela fácil de entender",
];

export function HeroSection() {
  const { user } = useAuth();
  const primaryHref = user ? "/dashboard" : "/signup";
  const secondaryHref = user ? "/dashboard" : "/login";
  const primaryLabel = user ? "Abrir meu painel" : "Quero ver para onde meu dinheiro vai";
  const secondaryLabel = user ? "Ver meus números agora" : "Já tenho conta";

  return (
    <section className="relative overflow-hidden bg-[linear-gradient(180deg,#f8fbff_0%,#f6f2ea_52%,#ffffff_100%)] text-slate-900">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(14,116,144,0.14),_transparent_34%)]" />
      <div className="absolute right-0 top-0 h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle,_rgba(59,130,246,0.18),_transparent_62%)] blur-3xl" />

      <div className="relative mx-auto grid max-w-6xl gap-10 px-4 pb-14 pt-10 md:pb-20 md:pt-14 lg:grid-cols-[1.02fr_0.98fr] lg:items-center">
        <div className="space-y-6">
          <Badge className="w-fit border-0 bg-amber-100 px-3 py-1.5 text-amber-900 shadow-sm">
            Pare de perder dinheiro no escuro
          </Badge>

          <div className="space-y-4">
            <h1 className="max-w-2xl font-poppins text-4xl font-bold leading-tight text-slate-950 md:text-5xl lg:text-6xl">
              Você trabalha, recebe e mesmo assim termina o mês sem entender para onde o dinheiro foi.
            </h1>
            <p className="max-w-xl text-lg leading-relaxed text-slate-700 md:text-xl">
              O FinScope mostra o que está pesando no seu bolso, organiza sua rotina com IA e devolve
              clareza para você agir antes do problema crescer.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href={primaryHref}>
              <Button size="lg" className="min-h-12 w-full rounded-xl bg-slate-950 px-6 text-base text-white hover:bg-slate-900 sm:w-auto">
                {primaryLabel}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>

            {user ? (
              <Link href={secondaryHref}>
                <Button
                  size="lg"
                  variant="outline"
                  className="min-h-12 w-full rounded-xl border-slate-300 px-6 text-base text-slate-900 sm:w-auto"
                >
                  {secondaryLabel}
                </Button>
              </Link>
            ) : (
              <Button
                asChild
                size="lg"
                variant="outline"
                className="min-h-12 w-full rounded-xl border-slate-300 px-6 text-base text-slate-900 sm:w-auto"
              >
                <a href="#prova">Ver o FinScope em ação</a>
              </Button>
            )}
          </div>

          <p className="text-sm font-medium text-slate-600">
            Sem planilha. Sem adivinhação. Sem deixar o controle para depois.
          </p>

          <div className="grid gap-3 sm:grid-cols-3">
            {trustSignals.map((signal) => (
              <div
                key={signal.label}
                className="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-[0_16px_50px_rgba(15,23,42,0.06)] backdrop-blur"
              >
                <signal.icon className="mb-3 h-5 w-5 text-sky-700" />
                <p className="text-sm font-medium leading-relaxed text-slate-700">{signal.label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative">
          <div className="absolute inset-x-8 top-8 h-24 rounded-full bg-sky-200/40 blur-3xl" />

          <div className="relative rounded-[32px] border border-white/80 bg-white/90 p-4 shadow-[0_28px_90px_rgba(15,23,42,0.14)] backdrop-blur md:p-5">
            <div className="rounded-2xl border border-rose-200 bg-white/95 px-4 py-3 shadow-lg">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rose-500">Atenção</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">Você não precisa descobrir excessos só quando o saldo aperta.</p>
            </div>

            <div className="mt-4 overflow-hidden rounded-[24px] border border-slate-200 bg-white">
              <img
                src="/landing/dashboard-1.png"
                alt="Painel do FinScope com resumo financeiro, saldo do mês e análise inteligente"
                className="h-full w-full object-cover object-left-top"
              />
            </div>

            <div className="mt-4 rounded-[24px] border border-slate-200 bg-white/96 p-4 shadow-xl">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">O que você ganha</p>
              <div className="mt-3 grid gap-2.5">
                {heroBullets.map((bullet) => (
                  <div key={bullet} className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                    <p className="text-sm leading-relaxed text-slate-700">{bullet}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
