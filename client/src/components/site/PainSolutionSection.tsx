import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowRight, CircleAlert, Flame, WalletCards } from "lucide-react";
import { useAuth } from "@/lib/auth";

const painCards = [
  {
    title: "Voce ganha, paga as contas e ainda sente que o dinheiro evaporou",
    description: "Quando tudo passa por varios lugares, o mes termina com culpa, cansaco e zero clareza.",
    icon: WalletCards,
  },
  {
    title: "O excesso so aparece quando ja ficou tarde",
    description: "Pequenos gastos, assinaturas e saidas invisiveis viram um rombo silencioso ao longo das semanas.",
    icon: CircleAlert,
  },
  {
    title: "Seu financeiro vive no modo apagar incendio",
    description: "Sem uma leitura simples, voce decide no susto, corta errado e continua sem saber o que ajustar.",
    icon: Flame,
  },
];

export function PainSolutionSection() {
  const { user } = useAuth();
  const ctaHref = user ? "/dashboard" : "/signup";
  const ctaLabel = user ? "Voltar para meu controle" : "Quero sair do caos financeiro";

  return (
    <section className="border-t border-slate-200 bg-slate-950 py-16 text-white md:py-20">
      <div className="mx-auto max-w-6xl space-y-10 px-4">
        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div className="space-y-5">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-amber-300">O problema real</p>
            <h2 className="font-poppins text-3xl font-bold leading-tight md:text-4xl">
              Nao e falta de disciplina. E falta de visibilidade.
            </h2>
            <p className="max-w-xl text-base leading-relaxed text-slate-300 md:text-lg">
              Quando voce nao enxerga o que esta acontecendo, sempre parece que o dinheiro some sem aviso.
              Isso trava decisoes, atrasa metas e deixa a sensacao de que voce esta sempre correndo atras.
            </p>

            <div className="rounded-[28px] border border-white/10 bg-white/5 p-6">
              <p className="text-lg font-semibold text-white">O custo de nao olhar direito e alto.</p>
              <p className="mt-2 text-sm leading-relaxed text-slate-300">
                Uma assinatura esquecida, um excesso recorrente ou a mistura entre pessoal e negocio pode custar
                mais do que um mes inteiro de controle financeiro.
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-1">
            {painCards.map((card) => (
              <Card
                key={card.title}
                className="rounded-[26px] border border-white/10 bg-white/5 p-6 text-white shadow-[0_18px_40px_rgba(2,6,23,0.18)]"
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-amber-300">
                    <card.icon className="h-5 w-5" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-lg font-semibold leading-snug">{card.title}</h3>
                    <p className="text-sm leading-relaxed text-slate-300">{card.description}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-4 rounded-[28px] border border-amber-300/20 bg-amber-300/10 p-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xl font-semibold text-white">Voce nao precisa continuar decidindo no escuro.</p>
            <p className="mt-1 text-sm text-slate-200">
              O primeiro passo e simples: enxergar o que esta drenando seu dinheiro e agir antes do aperto.
            </p>
          </div>
          <Link href={ctaHref}>
            <Button className="min-h-12 rounded-xl bg-white px-6 text-slate-950 hover:bg-slate-100">
              {ctaLabel}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
