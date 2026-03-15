import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, PlayCircle } from "lucide-react";

export function DemoSection() {
  return (
    <section id="demo" className="py-16 bg-slate-50 text-slate-900 border-t border-slate-200">
      <div className="max-w-6xl mx-auto px-4 grid md:grid-cols-2 gap-10 items-center">
        <div className="space-y-4">
          <p className="text-sm uppercase tracking-[0.2em] text-slate-500">Veja na prática</p>
          <h2 className="text-3xl md:text-4xl font-poppins font-bold">
            Um painel claro, pronto para usar
          </h2>
          <p className="text-slate-600 leading-relaxed">
            Visualize entradas e saídas, acompanhe metas e organize suas contas sem navegar por menus confusos.
            Tudo pensado para você se sentir no controle desde o primeiro acesso.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link href="/signup">
              <Button className="bg-primary text-white hover:bg-primary/90">
                Cadastre-se
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <a href="#planos" className="inline-flex items-center gap-2 text-primary hover:text-primary/80">
              Conhecer planos
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </div>

        <Card className="relative overflow-hidden border border-slate-200 shadow-md bg-white">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5" />
          <CardHeader className="relative flex flex-row items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
              <PlayCircle className="h-5 w-5" />
            </div>
            <CardTitle className="font-poppins">Prévia do painel</CardTitle>
          </CardHeader>
          <CardContent className="relative space-y-4 text-sm text-slate-700">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs uppercase text-slate-500">Resumo mensal (ilustrativo)</p>
              <div className="mt-2 grid grid-cols-3 gap-3">
                <div>
                  <p className="text-xs text-slate-500">Entradas</p>
                  <p className="text-lg font-semibold text-slate-900">Ex.: R$ 6.560</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Saídas</p>
                  <p className="text-lg font-semibold text-amber-600">Ex.: R$ 4.820</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Metas</p>
                  <p className="text-lg font-semibold text-emerald-600">Acompanhamento</p>
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase text-slate-500">Resumo do mês</p>
              <ul className="mt-2 space-y-2">
                <li className="flex items-center justify-between">
                  <span>Agora eu sei para onde meu dinheiro estava indo</span>
                  <span className="text-emerald-600 font-semibold">Clareza</span>
                </li>
                <li className="flex items-center justify-between">
                  <span>Passei a planejar melhor e gastar com mais consciência</span>
                  <span className="text-primary font-semibold">Controle</span>
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
