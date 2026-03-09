import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Zap, BellRing, Goal, LayoutDashboard, Briefcase } from "lucide-react";

const differentiators = [
  {
    title: "IA financeira integrada",
    description: "Detecta padrões, alerta sobre riscos e sugere cortes sem você pedir.",
    icon: Sparkles,
  },
  {
    title: "Zero complexidade",
    description: "Experiência guiada, sem planilhas escondidas e sem configurações confusas.",
    icon: Zap,
  },
  {
    title: "Alertas inteligentes personalizados",
    description: "Avisos sobre gastos fora da média e cobranças inesperadas na hora.",
    icon: BellRing,
  },
  {
    title: "Metas automáticas por categoria",
    description: "Criamos metas realistas com base no seu histórico e nas próximas contas.",
    icon: Goal,
  },
  {
    title: "Painéis minimalistas e claros",
    description: "PF e PJ lado a lado, com visão do que gastou, vai gastar e do que sobra.",
    icon: LayoutDashboard,
  },
  {
    title: "Investimentos e finanças no mesmo lugar",
    description: "Acompanhe aplicações, saldo e obrigações em um só cockpit.",
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
            Não é mais um app de planilha. É seu copiloto financeiro.
          </h2>
          <p className="text-slate-600 max-w-3xl mx-auto">
            100% seu assistente financeiro pessoal — criado para superar Organizze e Mobills com IA, automação e foco em ação.
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
