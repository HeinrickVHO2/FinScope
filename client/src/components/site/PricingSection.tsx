import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Check, ShieldCheck } from "lucide-react";
import { CHECKOUT_PLAN_OPTIONS } from "@/constants/checkout-plans";
import { useAuth } from "@/lib/auth";

const planMatrix = [
  {
    id: "dashboard",
    label: "Painel financeiro claro para acompanhar o mes",
    plans: { pro: true, premium: true },
  },
  {
    id: "ai",
    label: "IA para reduzir trabalho manual no controle",
    plans: { pro: true, premium: true },
  },
  {
    id: "business",
    label: "Area de empresa para separar a operacao",
    plans: { pro: false, premium: true },
  },
  {
    id: "whatsapp",
    label: "WhatsApp para registrar e consultar pelo chat",
    plans: { pro: false, premium: true },
  },
  {
    id: "reports",
    label: "Relatorios mais avancados e leitura mais profunda",
    plans: { pro: false, premium: true },
  },
] as const;

const toDailyPrice = (priceLabel: string) => {
  const match = priceLabel.match(/R\$ ([\d,.]+)/);
  if (!match) return null;

  const monthlyPrice = Number(match[1].replace(".", "").replace(",", "."));
  if (Number.isNaN(monthlyPrice)) return null;

  return `Menos de R$ ${(monthlyPrice / 30).toFixed(2).replace(".", ",")} por dia`;
};

const toMonthlyDisplayPrice = (priceLabel: string) => {
  const match = priceLabel.match(/R\$ [\d,.]+/);
  return match ? match[0] : priceLabel;
};

export function PricingSection() {
  const { user } = useAuth();
  const checkoutMode = user?.billingStatus === "active" ? "upgrade" : "signup";

  const getPlanHref = (planId: string) => {
    if (!user) return "/signup";
    return `/settings?plan=${planId}&checkout=${checkoutMode}`;
  };

  return (
    <section id="planos" className="border-t border-slate-200 bg-[linear-gradient(180deg,#f8fafc_0%,#ffffff_100%)] py-16 text-slate-900 md:py-20">
      <div className="mx-auto max-w-6xl space-y-8 px-4">
        <div className="space-y-4 text-center">
          <Badge className="border-0 bg-amber-100 text-amber-900">Investimento pequeno. Impacto diario.</Badge>
          <h2 className="mx-auto max-w-3xl font-poppins text-3xl font-bold leading-tight md:text-4xl">
            Um gasto invisivel pode custar mais do que um mes inteiro de FinScope.
          </h2>
          <p className="mx-auto max-w-3xl text-base leading-relaxed text-slate-600 md:text-lg">
            Aqui o valor nao esta so no preco. Esta no quanto voce deixa de perder quando finalmente enxerga e age antes.
          </p>
        </div>

        <div className="rounded-[28px] border border-amber-200 bg-amber-50 p-5 text-center shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-700">Percepcao de valor</p>
          <p className="mt-2 text-lg font-semibold text-slate-950">
            Uma assinatura esquecida, uma taxa evitavel ou um excesso recorrente pode pagar esse investimento sozinho.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {CHECKOUT_PLAN_OPTIONS.map((plan) => {
            const dailyLabel = plan.commercialCopy.dailyPriceLabel ?? toDailyPrice(plan.price);
            const buttonLabel =
              plan.id === "premium" ? "Quero o controle completo" : "Comecar a enxergar meus gastos";

            return (
              <Card
                key={plan.id}
                className={`relative flex h-full flex-col overflow-hidden rounded-[30px] border bg-white ${
                  plan.recommended
                    ? "border-slate-950 shadow-[0_22px_60px_rgba(15,23,42,0.14)]"
                    : "border-slate-200 shadow-[0_14px_36px_rgba(15,23,42,0.06)]"
                }`}
              >
                {plan.recommended ? (
                  <div className="absolute right-5 top-5">
                    <Badge className="bg-slate-950 text-white">{plan.badge || "Mais escolhido"}</Badge>
                  </div>
                ) : null}

                <CardHeader className="space-y-4 p-6 md:p-7">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                      {plan.id === "premium" ? "Para automatizar sua rotina" : "Para sair do improviso"}
                    </p>
                    <CardTitle className="mt-2 font-poppins text-3xl text-slate-950">{plan.name}</CardTitle>
                    <p className="mt-3 text-sm leading-relaxed text-slate-600">{plan.description}</p>
                  </div>

                  <div className={`rounded-[26px] p-5 ${plan.recommended ? "bg-slate-950 text-white" : "bg-slate-50 text-slate-950"}`}>
                    <p className="text-sm uppercase tracking-[0.2em] opacity-70">Preco mensal</p>
                    <p className="mt-2 text-4xl font-bold">{toMonthlyDisplayPrice(plan.price)}</p>
                    <p className="mt-1 text-sm opacity-80">por mes</p>
                    {dailyLabel ? <p className="mt-4 text-sm font-semibold">{dailyLabel}</p> : null}
                    <p className="mt-2 text-sm opacity-80">{plan.commercialCopy.priceSupport}</p>
                  </div>
                </CardHeader>

                <CardContent className="flex flex-1 flex-col gap-6 px-6 pb-6 md:px-7">
                  <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">O que voce leva</p>
                    <div className="mt-4 space-y-3">
                      {planMatrix.map((item) => {
                        const enabled = item.plans[plan.id];
                        if (!enabled) return null;

                        return (
                          <div key={item.id} className="flex items-start gap-3 text-sm text-slate-700">
                            <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                              <Check className="h-3.5 w-3.5" />
                            </span>
                            <span>{item.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-sky-100 bg-sky-50 p-5">
                    <p className="text-sm font-semibold text-slate-950">{plan.marketingHeadline}</p>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600">{plan.comparisonSummary}</p>
                  </div>

                  <div className="mt-auto flex items-start gap-3 rounded-[22px] border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
                    <p>14 dias de garantia total para entrar sem medo de errar.</p>
                  </div>
                </CardContent>

                <CardFooter className="p-6 pt-0 md:px-7 md:pb-7">
                  <Link href={getPlanHref(plan.id)} className="w-full">
                    <Button
                      className={`min-h-12 w-full rounded-xl ${
                        plan.recommended
                          ? "bg-slate-950 text-white hover:bg-slate-900"
                          : "border-slate-300 text-slate-950"
                      }`}
                      variant={plan.recommended ? "default" : "outline"}
                    >
                      {buttonLabel}
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
