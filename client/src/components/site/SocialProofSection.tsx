import { Card } from "@/components/ui/card";
import { Star, Quote, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import CamilaImage from "@/Camila.png";
import RafaelImage from "@/Rafael.png";
import JulianaImage from "@/Juliana.png";
import { useAuth } from "@/lib/auth";

const testimonials = [
  {
    name: "Juliana, autonoma",
    quote:
      "Agora eu sei para onde meu dinheiro estava indo. No fim do mes, fico mais tranquila para decidir.",
    focus: "Mais clareza no dia a dia",
    image: JulianaImage,
  },
  {
    name: "Rafael, pequeno negocio",
    quote:
      "Consegui enxergar meus gastos do mes com clareza e separar melhor o que e pessoal e o que e do negocio.",
    focus: "Organizacao entre PF e negocio",
    image: RafaelImage,
  },
  {
    name: "Camila, marketing",
    quote:
      "Passei a planejar melhor e gastar com mais consciencia. Minhas contas ficaram muito mais organizadas.",
    focus: "Planejamento mais leve",
    image: CamilaImage,
  },
];

export function SocialProofSection() {
  const { user } = useAuth();
  const ctaHref = user ? "/dashboard" : "/signup";
  const ctaLabel = user ? "Ir para o painel" : "Cadastre-se";

  return (
    <section className="border-t border-slate-200 bg-gradient-to-b from-slate-50 via-white to-slate-50 py-16 text-slate-900">
      <div className="mx-auto max-w-6xl space-y-10 px-4">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="space-y-3">
            <p className="text-sm uppercase tracking-[0.2em] text-slate-500">Resultados reais</p>
            <h2 className="font-poppins text-3xl font-bold md:text-4xl">Quem usa, aprova</h2>
            <p className="max-w-2xl text-slate-600">
              Historias de quem ganhou mais clareza para acompanhar o mes e tomar decisoes com calma.
            </p>
          </div>
          <Link href={ctaHref}>
            <Button className="bg-primary text-white shadow-sm hover:bg-primary/90">
              {ctaLabel}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>

        <div className="grid gap-5 md:grid-cols-2 md:gap-6 lg:grid-cols-3">
          <Card className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-900 shadow-sm md:col-span-2 md:p-7">
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1 text-amber-400">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <Star key={index} className="h-5 w-5 fill-current" />
                  ))}
                </div>
                <p className="text-lg font-semibold text-slate-900">Feedback positivo de usuarios</p>
              </div>
              <p className="text-sm leading-relaxed text-slate-600">
                O retorno mais comum e simples: mais controle da rotina e menos duvidas sobre o dinheiro no fim do mes.
              </p>
              <div className="grid gap-3 text-sm text-slate-700 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-base font-semibold text-slate-900">Mais clareza</p>
                  <p className="text-slate-600">Visao do que entrou, saiu e do que ainda precisa pagar.</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-base font-semibold text-slate-900">Mais organizacao</p>
                  <p className="text-slate-600">Planejamento mensal com prioridades mais definidas.</p>
                </div>
              </div>
            </div>
          </Card>

          {testimonials.map((testimonial) => (
            <Card
              key={testimonial.name}
              className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 text-slate-900 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex items-center gap-3">
                {testimonial.image ? (
                  <img
                    src={testimonial.image}
                    alt={testimonial.name}
                    className="h-10 w-10 rounded-full border border-slate-200 object-cover"
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary">
                    {testimonial.name[0]}
                  </div>
                )}
                <div>
                  <p className="text-sm font-semibold text-slate-900">{testimonial.name}</p>
                  <p className="text-xs text-slate-500">{testimonial.focus}</p>
                </div>
              </div>
              <Quote className="h-5 w-5 text-primary" />
              <p className="text-sm leading-relaxed text-slate-700">{testimonial.quote}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
