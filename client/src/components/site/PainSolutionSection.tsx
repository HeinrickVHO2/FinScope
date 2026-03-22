import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowRight, AlertTriangle, Target } from "lucide-react";
import { useAuth } from "@/lib/auth";

const pains = [
  "No fim do mes, voce nao sabe para onde o dinheiro foi",
  "Dificuldade para equilibrar contas pessoais e do negocio",
  "Falta de rotina para planejar as proximas semanas",
  "Sensacao de estar sempre apagando incendio",
];

export function PainSolutionSection() {
  const { user } = useAuth();
  const ctaHref = user ? "/dashboard" : "/signup";
  const ctaLabel = user ? "Ir para o painel" : "Cadastre-se";

  return (
    <section className="border-t border-slate-200 bg-slate-50 py-16 text-slate-900">
      <div className="mx-auto max-w-6xl px-4">
        <div className="grid items-start gap-10 lg:grid-cols-3">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/10 bg-primary/5 px-3 py-2 text-sm text-primary">
              <AlertTriangle className="h-4 w-4" />
              <span>Problemas que custam caro</span>
            </div>
            <h2 className="font-poppins text-3xl font-bold leading-tight md:text-4xl">
              Se suas financas parecem um caos, nao e culpa sua.
            </h2>
            <p className="leading-relaxed text-slate-600">
              Planilhas cansam. Apps complicados desanimam. O FinScope ajuda voce a organizar tudo de um jeito simples.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:col-span-2">
            {pains.map((pain) => (
              <Card
                key={pain}
                className="rounded-xl border border-slate-200 bg-white p-4 text-slate-900 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-primary">
                    <Target className="h-4 w-4" />
                  </div>
                  <p className="font-medium text-slate-800">{pain}</p>
                </div>
              </Card>
            ))}
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-4 rounded-2xl border border-primary/10 bg-gradient-to-r from-primary/5 via-white to-primary/5 p-6 shadow-sm md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-lg font-semibold text-slate-900">
              Pare de adivinhar. Tenha uma visao clara do seu mes.
            </p>
            <p className="text-sm text-slate-600">
              Registre suas contas, acompanhe seus gastos e planeje melhor cada decisao.
            </p>
          </div>
          <Link href={ctaHref}>
            <Button className="bg-primary text-white">
              {ctaLabel}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
