import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { BILLING_PLANS } from "@shared/plans";

export function FinalCTASection() {
  return (
    <section className="bg-white py-16 text-slate-900">
      <div className="mx-auto max-w-5xl space-y-6 rounded-3xl border border-primary/10 bg-gradient-to-r from-white via-primary/5 to-white p-10 text-center shadow-sm">
        <h2 className="text-3xl font-poppins font-bold md:text-4xl">
          Controle essencial no Pro. Operação completa no Premium.
        </h2>
        <p className="text-lg text-slate-600">
          Comece no Pro por {BILLING_PLANS.pro.priceLabel} ou vá de Premium por {BILLING_PLANS.premium.priceLabel}
          para liberar WhatsApp, relatórios avançados e uma experiência mais inteligente.
        </p>
        <p className="text-sm text-slate-500">
          {BILLING_PLANS.premium.commercialCopy.dailyPriceLabel} para automatizar sua rotina financeira com menos esforço manual.
        </p>
        <div className="flex flex-col justify-center gap-3 sm:flex-row">
          <Link href="/signup">
            <Button size="lg" className="bg-primary text-white hover:bg-primary/90">
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
