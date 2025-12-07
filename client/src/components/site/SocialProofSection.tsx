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
      "Saí da planilha e, em poucos minutos, vi exatamente onde meu dinheiro estava indo. Não fico mais no escuro no fim do mês.",
    focus: "Rotina de autônoma mais previsível",
    image: JulianaImage,
  },
  {
    name: "Rafael, MEI",
    quote:
      "Consigo separar o que é pessoal e o que é do MEI sem confusão. Sei quando posso tirar pró-labore sem travar o caixa.",
    focus: "Equilíbrio entre PF e MEI",
    image: RafaelImage,
  },
  {
    name: "Camila, marketing",
    quote:
      "O app me lembra antes de estourar o cartão e já deixa separado o que é da reserva. Fiquei mais tranquila com as contas.",
    focus: "Planejamento leve no dia a dia",
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
              Pessoas reais que simplificaram a vida financeira com o FinScope e hoje têm clareza sem esforço.
            </p>
          </div>
          <Link href="/signup">
            <Button className="bg-primary text-white hover:bg-primary/90 shadow-sm">
              Entrar para o FinScope
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
                <p className="text-lg font-semibold text-slate-900">Avaliação média 4,9/5</p>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">
                Já no primeiro mês, clientes relatam clareza sobre para onde o dinheiro vai e onde ajustar antes do aperto
                chegar.
              </p>
              <div className="grid sm:grid-cols-2 gap-3 text-sm text-slate-700">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-2xl font-bold text-slate-900">+1200</p>
                  <p className="text-slate-600">contas organizadas com metas claras</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-2xl font-bold text-slate-900">92%</p>
                  <p className="text-slate-600">batem metas com mais consistência</p>
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
