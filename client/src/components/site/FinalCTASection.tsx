import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export function FinalCTASection() {
  return (
    <section className="py-16 bg-white text-slate-900">
      <div className="max-w-5xl mx-auto px-4 text-center space-y-6 rounded-3xl border border-primary/10 bg-gradient-to-r from-white via-primary/5 to-white p-10 shadow-sm">
        <h2 className="text-3xl md:text-4xl font-poppins font-bold">
          Organize sua vida financeira com mais clareza.
        </h2>
        <p className="text-lg text-slate-600">
          Cadastre-se e acompanhe seu mes com mais controle e menos correria.
        </p>
        <div className="flex flex-col sm:flex-row justify-center gap-3">
          <Link href="/signup">
            <Button size="lg" className="bg-primary hover:bg-primary/90 text-white">
              Cadastre-se
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
        <p className="text-sm text-slate-500">Cadastro rapido e simples.</p>
      </div>
    </section>
  );
}
