import { Card } from "@/components/ui/card";
import { Star, Quote, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import CamilaImage from "@/Camila.png";
import RafaelImage from "@/Rafael.png";
import JulianaImage from "@/Juliana.png";

const testimonials = [
  {
    name: "Juliana, autônoma",
    quote:
      "Agora eu sei para onde meu dinheiro estava indo. No fim do mês, fico mais tranquila para decidir.",
    focus: "Mais clareza no dia a dia",
    image: JulianaImage,
  },
  {
    name: "Rafael, MEI",
    quote:
      "Consegui enxergar meus gastos do mês com clareza e separar melhor o que é pessoal e o que é do negócio.",
    focus: "Organização entre PF e negócio",
    image: RafaelImage,
  },
  {
    name: "Camila, marketing",
    quote:
      "Passei a planejar melhor e gastar com mais consciência. Minhas contas ficaram muito mais organizadas.",
    focus: "Planejamento mais leve",
    image: CamilaImage,
  },
];

export function SocialProofSection() {
  return (
    <section className="py-16 bg-gradient-to-b from-slate-50 via-white to-slate-50 text-slate-900 border-t border-slate-200">
      <div className="max-w-6xl mx-auto px-4 space-y-10">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-3">
            <p className="text-sm uppercase tracking-[0.2em] text-slate-500">Resultados reais</p>
            <h2 className="text-3xl md:text-4xl font-poppins font-bold">Quem usa, aprova</h2>
            <p className="text-slate-600 max-w-2xl">
              Histórias de quem ganhou mais clareza para acompanhar o mês e tomar decisões com calma.
            </p>
          </div>
          <Link href="/signup">
            <Button className="bg-primary text-white hover:bg-primary/90 shadow-sm">
              Cadastre-se
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>

        <div className="grid gap-5 md:gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card className="md:col-span-2 p-6 md:p-7 bg-white border border-slate-200 text-slate-900 rounded-2xl shadow-sm">
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1 text-amber-400">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <Star key={index} className="h-5 w-5 fill-current" />
                  ))}
                </div>
                <p className="text-lg font-semibold text-slate-900">Feedback positivo de usuários</p>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">
                O retorno mais comum é simples: mais controle da rotina e menos dúvidas sobre o dinheiro no fim do mês.
              </p>
              <div className="grid sm:grid-cols-2 gap-3 text-sm text-slate-700">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-base font-semibold text-slate-900">Mais clareza</p>
                  <p className="text-slate-600">Visão do que entrou, saiu e do que ainda precisa pagar.</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-base font-semibold text-slate-900">Mais organização</p>
                  <p className="text-slate-600">Planejamento mensal com prioridades mais definidas.</p>
                </div>
              </div>
            </div>
          </Card>

          {testimonials.map((testimonial) => (
            <Card
              key={testimonial.name}
              className="p-5 bg-white border border-slate-200 text-slate-900 rounded-2xl shadow-sm flex flex-col gap-3 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center gap-3">
                {testimonial.image ? (
                  <img
                    src={testimonial.image}
                    alt={testimonial.name}
                    className="h-10 w-10 rounded-full object-cover border border-slate-200"
                  />
                ) : (
                  <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold">
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
