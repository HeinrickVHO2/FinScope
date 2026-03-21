import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { BILLING_PLANS } from "@shared/plans";

export function FinalCTASection() {
  return (
    <section className="py-16 bg-white text-slate-900">
      <div className="max-w-5xl mx-auto px-4 text-center space-y-6 rounded-3xl border border-primary/10 bg-gradient-to-r from-white via-primary/5 to-white p-10 shadow-sm">
        <h2 className="text-3xl md:text-4xl font-poppins font-bold">
          Controle essencial no Pro. Operação completa no Premium.
        </h2>
        <p className="text-lg text-slate-600">
          Comece no Pro por {BILLING_PLANS.pro.priceLabel} ou vá de Premium por {BILLING_PLANS.premium.priceLabel} para liberar WhatsApp, relatórios avançados e IA mais rica.
        </p>
        <div className="flex flex-col sm:flex-row justify-center gap-3">
          <Link href="/signup">
            <Button size="lg" className="bg-primary hover:bg-primary/90 text-white">
              Ver planos e começar
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
        <p className="text-sm text-slate-500">Checkout com 10 dias de garantia total.</p>
      </div>
    </section>
  );
}
