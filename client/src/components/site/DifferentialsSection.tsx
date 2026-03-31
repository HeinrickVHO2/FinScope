import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bot, Briefcase, LayoutDashboard, MessageCircleMore, Sparkles, Workflow } from "lucide-react";

const differentiators = [
  {
    title: "IA que reduz atrito",
    description: "Você não precisa classificar tudo manualmente para ter uma leitura útil do mês.",
    icon: Bot,
  },
  {
    title: "Clareza sem excesso visual",
    description: "O painel foi pensado para mostrar o que pesa agora, não para soterrar você com informação.",
    icon: LayoutDashboard,
  },
  {
    title: "Pessoal e negócio no mesmo contexto",
    description: "Entenda as duas rotinas sem perder a noção do que está sobrando de verdade.",
    icon: Briefcase,
  },
  {
    title: "WhatsApp para continuar no fluxo real",
    description: "Quando abrir o app não faz sentido, o registro e a consulta podem continuar pelo chat.",
    icon: MessageCircleMore,
  },
  {
    title: "Planejado versus realizado",
    description: "Você compara intenção com realidade e ajusta antes do mês sair do controle.",
    icon: Workflow,
  },
  {
    title: "Mais simplicidade para manter o hábito",
    description: "FinScope ajuda você a voltar todos os dias sem transformar controle financeiro em castigo.",
    icon: Sparkles,
  },
];

export function DifferentialsSection() {
  return (
    <section className="border-t border-slate-200 bg-[#f6f2ea] py-16 text-slate-900 md:py-20">
      <div className="mx-auto max-w-6xl space-y-8 px-4">
        <div className="space-y-4 text-center">
          <Badge variant="outline" className="border-amber-200 bg-white/80 text-amber-900">
            Por que o FinScope é diferente
          </Badge>
          <h2 className="mx-auto max-w-3xl font-poppins text-3xl font-bold leading-tight md:text-4xl">
            Não é só controle financeiro. É menos fricção para continuar no controle.
          </h2>
          <p className="mx-auto max-w-3xl text-base leading-relaxed text-slate-600 md:text-lg">
            A maioria das ferramentas pede disciplina demais logo no primeiro dia. O FinScope foi desenhado para
            facilitar a manutenção do hábito com automação, clareza e menos trabalho repetitivo.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {differentiators.map((item) => (
            <Card
              key={item.title}
              className="rounded-[26px] border border-white/70 bg-white/90 p-6 shadow-[0_14px_36px_rgba(15,23,42,0.05)]"
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-100 text-sky-800">
                <item.icon className="h-5 w-5" />
              </div>
              <h3 className="text-xl font-semibold leading-snug text-slate-950">{item.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">{item.description}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
