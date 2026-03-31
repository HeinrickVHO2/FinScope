import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Bot, Eye, Radar, Sparkles } from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/lib/auth";

const solutionCards = [
  {
    title: "Veja o vazamento antes que ele vire problema",
    description: "O painel deixa claro o que está entrando, saindo e onde o dinheiro está escapando com mais frequência.",
    icon: Eye,
  },
  {
    title: "Deixe a IA reduzir o trabalho manual",
    description: "FinScope ajuda a organizar gastos e categorias sem transformar seu controle financeiro em mais uma tarefa cansativa.",
    icon: Bot,
  },
  {
    title: "Tome decisões com mais calma e menos impulso",
    description: "Com leitura simples do mês, você enxerga o que cortar, o que manter e o que merece atenção agora.",
    icon: Radar,
  },
];

const steps = [
  "Registre seus movimentos ou use a IA para acelerar o processo",
  "Entenda o que pesa no seu mês sem somar tudo na mão",
  "Aja com clareza antes do dinheiro apertar",
];

export function HowItWorksSection() {
  const { user } = useAuth();
  const ctaHref = user ? "/dashboard" : "/signup";
  const ctaLabel = user ? "Ver meu painel" : "Quero minha leitura financeira";

  return (
    <section id="como-funciona" className="bg-white py-16 text-slate-900 md:py-20">
      <div className="mx-auto max-w-6xl space-y-10 px-4">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-4">
            <Badge variant="outline" className="border-sky-200 bg-sky-50 text-sky-900">
              A solução
            </Badge>
            <h2 className="max-w-3xl font-poppins text-3xl font-bold leading-tight md:text-4xl">
              O FinScope transforma confusão financeira em clareza que você consegue usar hoje.
            </h2>
            <p className="max-w-2xl text-base leading-relaxed text-slate-600 md:text-lg">
              Em vez de despejar gráficos soltos, o FinScope mostra o que importa agora, automatiza parte da rotina
              e deixa evidente qual decisão traz mais alívio para o seu bolso.
            </p>
          </div>

          <Link href={ctaHref}>
            <Button className="min-h-12 rounded-xl bg-slate-950 px-6 text-white hover:bg-slate-900">
              {ctaLabel}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {solutionCards.map((card) => (
            <Card
              key={card.title}
              className="rounded-[26px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-6 shadow-[0_14px_36px_rgba(15,23,42,0.06)]"
            >
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-100 text-sky-800">
                <card.icon className="h-5 w-5" />
              </div>
              <h3 className="text-xl font-semibold leading-snug text-slate-950">{card.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">{card.description}</p>
            </Card>
          ))}
        </div>

        <div className="rounded-[30px] border border-slate-200 bg-[#f6f2ea] p-6 md:p-8">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Como começar</p>
              <p className="text-xl font-semibold text-slate-950">Um fluxo simples para quem tem pouca paciência e pouco tempo.</p>
            </div>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-3">
            {steps.map((step, index) => (
              <div key={step} className="rounded-2xl border border-white/80 bg-white/80 p-5 shadow-sm">
                <p className="text-sm font-semibold text-sky-800">Passo {index + 1}</p>
                <p className="mt-2 text-sm leading-relaxed text-slate-700">{step}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
