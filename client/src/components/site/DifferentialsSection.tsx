import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Zap, BellRing, Goal, LayoutDashboard, Briefcase } from "lucide-react";

const differentiators = [
  {
    title: "Visão clara do mês",
    description: "Entenda rapidamente o que entrou, o que saiu e o que ainda falta pagar.",
    icon: Sparkles,
  },
  {
    title: "Uso simples no dia a dia",
    description: "Uma experiência direta para você organizar as finanças sem complicação.",
    icon: Zap,
  },
  {
    title: "Lembretes importantes",
    description: "Acompanhe vencimentos e tarefas para não esquecer contas essenciais.",
    icon: BellRing,
  },
  {
    title: "Metas mais conscientes",
    description: "Defina objetivos e acompanhe sua evolução ao longo do mês.",
    icon: Goal,
  },
  {
    title: "Painel facil de acompanhar",
    description: "Tudo em um lugar para você tomar decisões com mais segurança.",
    icon: LayoutDashboard,
  },
  {
    title: "Pessoal e negócio no mesmo app",
    description: "Organize as duas rotinas sem perder contexto e sem confusão.",
    icon: Briefcase,
  },
];

export function DifferentialsSection() {
  return (
    <section className="py-16 bg-white text-slate-900">
      <div className="max-w-6xl mx-auto px-4 space-y-8">
        <div className="space-y-3 text-center">
          <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">Por que o FinScope</Badge>
          <h2 className="text-3xl md:text-4xl font-poppins font-bold">
            Mais clareza, menos confusão no dia a dia.
          </h2>
          <p className="text-slate-600 max-w-3xl mx-auto">
            O FinScope foi feito para ajudar você a manter o controle financeiro com uma rotina leve e organizada.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          {differentiators.map((item) => (
            <Card
              key={item.title}
              className="p-5 bg-white border border-slate-200 text-slate-900 rounded-2xl shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                  <item.icon className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-semibold">{item.title}</h3>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">{item.description}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
