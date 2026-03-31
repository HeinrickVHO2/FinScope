import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Star, Quote, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import CamilaImage from "@/Camila.png";
import RafaelImage from "@/Rafael.png";
import JulianaImage from "@/Juliana.png";
import { useAuth } from "@/lib/auth";

const testimonials = [
  {
    name: "Juliana, autônoma",
    quote: "Antes eu só sentia culpa no fim do mês. Agora eu bato o olho e entendo o que realmente aconteceu.",
    focus: "Clareza para decidir sem ansiedade",
    image: JulianaImage,
  },
  {
    name: "Rafael, pequeno negócio",
    quote: "Consegui separar melhor o que era pessoal e o que era da empresa. Isso sozinho já tirou um peso enorme.",
    focus: "Menos mistura, mais controle",
    image: RafaelImage,
  },
  {
    name: "Camila, marketing",
    quote: "Passei a perceber meus excessos antes. Parei de descobrir o problema só quando o saldo apertava.",
    focus: "Correção mais rápida do mês",
    image: CamilaImage,
  },
];

const reassurancePoints = [
  "Leitura simples para quem não aguenta mais planilha",
  "Mais tranquilidade para enxergar o mês sem drama",
  "Mais clareza entre o que pesa e o que realmente importa",
];

export function SocialProofSection() {
  const { user } = useAuth();
  const ctaHref = user ? "/dashboard" : "/signup";
  const ctaLabel = user ? "Ir para meu painel" : "Começar meu controle agora";

  return (
    <section className="border-t border-slate-200 bg-[linear-gradient(180deg,#f8fafc_0%,#ffffff_100%)] py-16 text-slate-900 md:py-20">
      <div className="mx-auto max-w-6xl space-y-10 px-4">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-4">
            <Badge className="w-fit border-0 bg-emerald-100 text-emerald-900">Histórias de clientes</Badge>
            <h2 className="font-poppins text-3xl font-bold leading-tight md:text-4xl">
              Quando você finalmente enxerga, fica mais fácil mudar.
            </h2>
            <p className="max-w-2xl text-base leading-relaxed text-slate-600 md:text-lg">
              O benefício mais citado não é um gráfico bonito. É a sensação de parar de adivinhar o que aconteceu com o dinheiro.
            </p>
          </div>

          <Link href={ctaHref}>
            <Button className="min-h-12 rounded-xl bg-slate-950 px-6 text-white hover:bg-slate-900">
              {ctaLabel}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
          <Card className="rounded-[30px] border border-slate-200 bg-slate-950 p-7 text-white shadow-[0_22px_60px_rgba(15,23,42,0.18)]">
            <div className="flex items-center gap-2 text-amber-300">
              {Array.from({ length: 5 }).map((_, index) => (
                <Star key={index} className="h-5 w-5 fill-current" />
              ))}
            </div>

            <p className="mt-5 text-2xl font-semibold leading-snug md:text-3xl">
              "Eu preciso disso" acontece quando a pessoa percebe o quanto custa continuar no escuro.
            </p>

            <div className="mt-6 grid gap-3">
              {reassurancePoints.map((point) => (
                <div key={point} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-sm leading-relaxed text-slate-200">{point}</p>
                </div>
              ))}
            </div>
          </Card>

          <div className="grid gap-4">
            {testimonials.map((testimonial) => (
              <Card
                key={testimonial.name}
                className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_14px_36px_rgba(15,23,42,0.06)]"
              >
                <div className="flex items-center gap-3">
                  <img
                    src={testimonial.image}
                    alt={testimonial.name}
                    className="h-11 w-11 rounded-full border border-slate-200 object-cover"
                  />
                  <div>
                    <p className="text-sm font-semibold text-slate-950">{testimonial.name}</p>
                    <p className="text-xs text-slate-500">{testimonial.focus}</p>
                  </div>
                </div>
                <Quote className="mt-4 h-5 w-5 text-sky-700" />
                <p className="mt-3 text-sm leading-relaxed text-slate-700">{testimonial.quote}</p>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
