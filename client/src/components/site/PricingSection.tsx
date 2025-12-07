import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, ArrowRight } from "lucide-react";

const plans = [
  {
    name: "Pro",
    highlight: false,
    description: "Para começar com clareza e cortar desperdícios.",
    value: "Rotina pessoal organizada",
    features: [
      "Controle PF completo",
      "Planejamento de contas futuras",
      "Alertas essenciais e lembretes",
      "Relatórios PDF básicos",
    ],
  },
  {
    name: "Premium",
    highlight: true,
    description: "IA destravada, PF + PJ, metas automáticas e dashboards avançados.",
    value: "Tudo do Pro + cockpit PF/PJ",
    features: [
      "PF + PJ no mesmo cockpit",
      "IA financeira completa e insights proativos",
      "Metas automáticas por categoria",
      "Exportação avançada e backups",
      "Suporte prioritário",
    ],
  },
];

export function PricingSection() {
  return (
    <section id="planos" className="py-16 bg-white text-slate-900 border-t border-slate-200">
      <div className="max-w-6xl mx-auto px-4 space-y-8">
        <div className="space-y-3 text-center">
          <Badge className="bg-primary/10 text-primary border-primary/20">Planos</Badge>
          <h2 className="text-3xl md:text-4xl font-poppins font-bold">
            Planos pensados para cada jornada
          </h2>
          <p className="text-slate-600 max-w-3xl mx-auto">
            Comece pelo cadastro e escolha o plano que fizer sentido dentro do app. Sem burocracia, com foco em clareza e ação.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {plans.map((plan) => (
            <Card
              key={plan.name}
              className={`relative rounded-2xl border ${
                plan.highlight ? "border-primary/40 shadow-lg" : "border-slate-200 shadow-sm"
              } text-slate-900 overflow-hidden bg-white`}
            >
              {plan.highlight && (
                <div className="absolute top-4 right-4">
                  <Badge className="bg-primary text-white">Mais escolhido</Badge>
                </div>
              )}
              <CardHeader>
                <CardTitle className="font-poppins text-2xl">{plan.name}</CardTitle>
                <CardDescription className="text-slate-600">{plan.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-baseline gap-2">
                  <span className="text-xl font-semibold text-slate-900">{plan.value}</span>
                </div>
                <div className="space-y-2">
                  {plan.features.map((feature) => (
                    <div key={feature} className="flex items-center gap-2 text-sm text-slate-700">
                      <Check className="h-4 w-4 text-primary" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-slate-600">
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-primary/5 border border-primary/10">
                    Onboarding guiado disponível
                  </span>
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-primary/5 border border-primary/10">
                    Acesso seguro e criptografado
                  </span>
                </div>
              </CardContent>
              <CardFooter>
                <Link href="/signup" className="w-full">
                  <Button
                    className="w-full"
                    variant={plan.highlight ? "default" : "outline"}
                  >
                    Começar pelo cadastro
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
