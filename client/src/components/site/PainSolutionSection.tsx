import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowRight, AlertTriangle, Target } from "lucide-react";

const pains = [
  "No fim do mes, voce nao sabe para onde o dinheiro foi",
  "Dificuldade para equilibrar contas pessoais e do negocio",
  "Falta de rotina para planejar as proximas semanas",
  "Sensacao de estar sempre apagando incendio",
];

export function PainSolutionSection() {
  return (
    <section className="py-16 bg-slate-50 text-slate-900 border-t border-slate-200">
      <div className="max-w-6xl mx-auto px-4">
        <div className="grid lg:grid-cols-3 gap-10 items-start">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-2 rounded-full bg-primary/5 border border-primary/10 text-sm text-primary">
              <AlertTriangle className="h-4 w-4" />
              <span>Problemas que custam caro</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-poppins font-bold leading-tight">
              Se suas financas parecem um caos, nao e culpa sua.
            </h2>
            <p className="text-slate-600 leading-relaxed">
              Planilhas cansam. Apps complicados desanimam. O FinScope ajuda voce a organizar tudo de um jeito simples.
            </p>
          </div>

          <div className="lg:col-span-2 grid sm:grid-cols-2 gap-4">
            {pains.map((pain) => (
              <Card
                key={pain}
                className="bg-white border border-slate-200 text-slate-900 p-4 rounded-xl shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex gap-3 items-start">
                  <div className="h-8 w-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                    <Target className="h-4 w-4" />
                  </div>
                  <p className="font-medium text-slate-800">{pain}</p>
                </div>
              </Card>
            ))}
          </div>
        </div>

        <div className="mt-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4 rounded-2xl bg-gradient-to-r from-primary/5 via-white to-primary/5 border border-primary/10 p-6 shadow-sm">
          <div>
            <p className="text-lg font-semibold text-slate-900">
              Pare de adivinhar. Tenha uma visao clara do seu mes.
            </p>
            <p className="text-sm text-slate-600">
              Registre suas contas, acompanhe seus gastos e planeje melhor cada decisao.
            </p>
          </div>
          <Link href="/signup">
            <Button className="bg-primary text-white">
              Cadastre-se
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
