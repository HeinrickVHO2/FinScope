import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Link2, Sparkles, Gauge, ArrowRight } from "lucide-react";
import { Link } from "wouter";

const steps = [
  {
    title: "Informe ou conecte suas contas",
    description: "Traga bancos, cartões e planilhas em poucos cliques. Sem fricção, sem formulários infinitos.",
    icon: Link2,
  },
  {
    title: "A IA interpreta tudo automaticamente",
    description: "Identifica gastos invisíveis, ajusta categorias e prevê o impacto das próximas contas.",
    icon: Sparkles,
  },
  {
    title: "Você só acompanha a evolução",
    description: "Alertas inteligentes, metas atualizadas e clareza do que vai sobrar até o fim do mês.",
    icon: Gauge,
  },
];

export function HowItWorksSection() {
  return (
    <section className="py-16 bg-white text-slate-900">
      <div className="max-w-6xl mx-auto px-4 space-y-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-3">
            <p className="text-sm uppercase tracking-[0.2em] text-slate-500">Como funciona</p>
            <h2 className="text-3xl md:text-4xl font-poppins font-bold">
              Clareza total em três passos simples
            </h2>
            <p className="text-slate-600 max-w-2xl">
              O fluxo foi desenhado para você começar a usar sem suporte. Mas se preferir, um especialista te acompanha.
            </p>
          </div>
          <Link href="/signup">
            <Button className="bg-primary text-white hover:bg-primary/90">
              Começar agora
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          {steps.map((step, index) => (
            <Card
              key={step.title}
              className="bg-white border border-slate-200 text-slate-900 p-6 rounded-2xl shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="h-12 w-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                  <step.icon className="h-6 w-6" />
                </div>
                <span className="text-sm text-slate-500">Passo {index + 1}</span>
              </div>
              <h3 className="text-xl font-semibold mb-2">{step.title}</h3>
              <p className="text-slate-600 text-sm leading-relaxed">{step.description}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
