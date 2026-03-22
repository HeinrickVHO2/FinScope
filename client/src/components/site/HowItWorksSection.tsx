import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Link2, Sparkles, Gauge, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/lib/auth";

const steps = [
  {
    title: "Adicione suas contas e gastos",
    description: "Registre suas movimentacoes em poucos passos e mantenha tudo no mesmo lugar.",
    icon: Link2,
  },
  {
    title: "Organize por categorias",
    description: "Veja com clareza quanto voce gastou em cada tipo de despesa no mes.",
    icon: Sparkles,
  },
  {
    title: "Acompanhe seu mes com clareza",
    description: "Visualize saldo, metas e proximos compromissos para decidir melhor.",
    icon: Gauge,
  },
];

export function HowItWorksSection() {
  const { user } = useAuth();
  const ctaHref = user ? "/dashboard" : "/signup";
  const ctaLabel = user ? "Ir para o painel" : "Cadastre-se";

  return (
    <section className="bg-white py-16 text-slate-900">
      <div className="mx-auto max-w-6xl space-y-8 px-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-3">
            <p className="text-sm uppercase tracking-[0.2em] text-slate-500">Como funciona</p>
            <h2 className="font-poppins text-3xl font-bold md:text-4xl">
              Clareza total em tres passos simples
            </h2>
            <p className="max-w-2xl text-slate-600">
              Um fluxo simples para voce entender seu dinheiro e manter uma rotina financeira mais organizada.
            </p>
          </div>
          <Link href={ctaHref}>
            <Button className="bg-primary text-white hover:bg-primary/90">
              {ctaLabel}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {steps.map((step, index) => (
            <Card
              key={step.title}
              className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-900 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="mb-4 flex items-center justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-primary">
                  <step.icon className="h-6 w-6" />
                </div>
                <span className="text-sm text-slate-500">Passo {index + 1}</span>
              </div>
              <h3 className="mb-2 text-xl font-semibold">{step.title}</h3>
              <p className="text-sm leading-relaxed text-slate-600">{step.description}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
