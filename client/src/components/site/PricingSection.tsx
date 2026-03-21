import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, ArrowRight } from "lucide-react";
import { CHECKOUT_PLAN_OPTIONS } from "@/constants/checkout-plans";

export function PricingSection() {
  return (
    <section id="planos" className="border-t border-slate-200 bg-white py-16 text-slate-900">
      <div className="mx-auto max-w-6xl space-y-8 px-4">
        <div className="space-y-3 text-center">
          <Badge className="border-primary/20 bg-primary/10 text-primary">Planos</Badge>
          <h2 className="text-3xl font-poppins font-bold md:text-4xl">
            Compare Pro e Premium com preço e diferença clara
          </h2>
          <p className="mx-auto max-w-3xl text-slate-600">
            O Pro entrega controle essencial com IA básica. O Premium amplia a operação com WhatsApp, relatórios avançados e inteligência mais completa.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {CHECKOUT_PLAN_OPTIONS.map((plan) => (
            <Card
              key={plan.id}
              className={`relative overflow-hidden rounded-2xl border bg-white text-slate-900 ${
                plan.recommended ? "border-primary/40 shadow-lg ring-1 ring-primary/10" : "border-slate-200 shadow-sm"
              }`}
            >
              {plan.recommended ? (
                <div className="absolute right-4 top-4">
                  <Badge className="bg-primary text-white">{plan.badge || "Mais recomendado"}</Badge>
                </div>
              ) : null}

              <CardHeader className="space-y-3">
                <div>
                  <CardTitle className="font-poppins text-2xl">{plan.name}</CardTitle>
                  <CardDescription className="mt-2 text-slate-600">{plan.description}</CardDescription>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-sm uppercase tracking-[0.18em] text-slate-500">Preço mensal</p>
                  <p className="mt-2 text-4xl font-bold text-slate-900">{plan.price.replace("/mês", "")}</p>
                  <p className="text-sm text-slate-500">por mês</p>
                </div>
              </CardHeader>

              <CardContent className="space-y-6">
                <div className="rounded-xl border border-primary/10 bg-primary/[0.03] p-4">
                  <p className="text-sm font-semibold text-slate-900">{plan.marketingHeadline}</p>
                  <p className="mt-1 text-sm text-slate-600">{plan.comparisonSummary}</p>
                </div>

                <div className="space-y-2">
                  {plan.features.map((feature) => (
                    <div key={feature} className="flex items-start gap-2 text-sm text-slate-700">
                      <Check className="mt-0.5 h-4 w-4 text-primary" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap gap-2 text-xs text-slate-600">
                  {plan.modalHighlights.map((highlight) => (
                    <span
                      key={highlight}
                      className="inline-flex items-center rounded-full border border-primary/10 bg-primary/5 px-3 py-1"
                    >
                      {highlight}
                    </span>
                  ))}
                </div>
              </CardContent>

              <CardFooter>
                <Link href="/signup" className="w-full">
                  <Button className="w-full" variant={plan.recommended ? "default" : "outline"}>
                    Escolher {plan.shortName}
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
