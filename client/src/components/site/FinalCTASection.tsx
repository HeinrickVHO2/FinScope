import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { BILLING_PLANS } from "@shared/plans";
import { useAuth } from "@/lib/auth";

const closingBullets = [
  "Veja o que está drenando seu dinheiro",
  "Ganhe clareza para agir hoje, não no fim do mês",
  "Troque improviso por um plano simples de seguir",
];

export function FinalCTASection() {
  const { user } = useAuth();
  const checkoutMode = user?.billingStatus === "active" ? "upgrade" : "signup";
  const primaryHref = user ? `/settings?plan=premium&checkout=${checkoutMode}` : "/signup";
  const secondaryHref = user ? "/dashboard" : "/login";

  return (
    <section className="bg-white py-16 text-slate-900 md:py-20">
      <div className="mx-auto max-w-5xl rounded-[34px] border border-slate-200 bg-[linear-gradient(135deg,#0f172a_0%,#111827_56%,#1d4ed8_100%)] p-8 text-white shadow-[0_28px_80px_rgba(15,23,42,0.22)] md:p-12">
        <div className="grid gap-8 lg:grid-cols-[1fr_0.8fr] lg:items-center">
          <div className="space-y-5">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-sky-200">Comece hoje</p>
            <h2 className="font-poppins text-3xl font-bold leading-tight md:text-5xl">
              Seu dinheiro não precisa continuar sumindo sem explicação.
            </h2>
            <p className="max-w-2xl text-base leading-relaxed text-slate-200 md:text-lg">
              Comece com o plano que faz sentido para você e transforme confusão em clareza. O Pro entrega
              controle essencial por {BILLING_PLANS.pro.priceLabel}. O Premium acelera a rotina com mais
              automação por {BILLING_PLANS.premium.priceLabel}.
            </p>

            <div className="grid gap-3">
              {closingBullets.map((bullet) => (
                <div key={bullet} className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                  <p className="text-sm leading-relaxed text-slate-200">{bullet}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[30px] border border-white/10 bg-white/10 p-6 backdrop-blur">
            <p className="text-lg font-semibold text-white">Comece agora e teste sem risco.</p>
            <p className="mt-2 text-sm leading-relaxed text-slate-200">
              {BILLING_PLANS.premium.commercialCopy.dailyPriceLabel} para automatizar sua rotina financeira com menos peso mental.
            </p>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">14 dias de garantia total no checkout.</p>

            <div className="mt-6 flex flex-col gap-3">
              <Link href={primaryHref}>
                <Button size="lg" className="min-h-12 w-full rounded-xl bg-white text-slate-950 hover:bg-slate-100">
                  Quero assumir o controle hoje
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>

              <Link href={secondaryHref}>
                <Button
                  size="lg"
                  variant="outline"
                  className="min-h-12 w-full rounded-xl border-white/20 bg-transparent text-white hover:bg-white/10"
                >
                  {user ? "Voltar ao meu painel" : "Já tenho conta"}
                </Button>
              </Link>
            </div>

            <p className="mt-4 text-xs leading-relaxed text-slate-300">
              Entre, veja seus números com clareza e decida com menos pressão.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
