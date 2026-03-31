import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight, Bot, CheckCircle2, LayoutDashboard, MessageCircleMore } from "lucide-react";
import { useAuth } from "@/lib/auth";

const proofCards = [
  {
    eyebrow: "Painel principal",
    title: "Veja em segundos para onde o dinheiro foi e o que merece atencao agora",
    description:
      "O dashboard deixa claro o saldo, as categorias que mais pesam e a leitura do periodo sem obrigar voce a interpretar varios blocos soltos.",
    bullets: [
      "O que entrou, saiu e sobrou no mesmo contexto",
      "Resumo do mes para cortar confusao e acelerar decisao",
      "Visao rapida para revisar no celular sem cansaco",
    ],
    icon: LayoutDashboard,
    imageSrc: "/landing/dashboard-1.png",
    imageAlt: "Dashboard principal do FinScope com resumo financeiro e leitura do mes",
  },
  {
    eyebrow: "Assistente com IA",
    title: "Registre e entenda sua rotina sem digitar tudo do zero",
    description:
      "A IA ajuda a transformar informacao solta em registros e respostas mais objetivas para manter seu controle funcionando no mundo real.",
    bullets: [
      "Menos esforco manual no dia a dia",
      "Mais velocidade para organizar gastos e metas",
      "Leitura financeira mais facil de consultar",
    ],
    icon: Bot,
    imageSrc: "/landing/ia-chat.png",
    imageAlt: "Assistente do FinScope organizando gastos e metas com IA",
  },
  {
    eyebrow: "WhatsApp",
    title: "Receba a leitura do periodo no chat quando o dia estiver corrido",
    description:
      "Em vez de depender sempre de abrir outra tela, voce pode consultar resumo e continuar o fluxo direto no WhatsApp.",
    bullets: [
      "Resumo pratico no momento em que a duvida aparece",
      "Mais chance de manter o habito porque a friccao cai",
      "Ideal para quem veio do improviso e precisa de praticidade",
    ],
    icon: MessageCircleMore,
    imageSrc: "/landing/ia-whats.png",
    imageAlt: "Resumo financeiro enviado pelo FinScope no WhatsApp",
  },
];

function ProofImage({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
      <img src={src} alt={alt} className="h-full w-full object-cover object-left-top" />
    </div>
  );
}

export function DemoSection() {
  const { user } = useAuth();
  const ctaHref = user ? "/dashboard" : "/signup";

  return (
    <section id="prova" className="border-t border-slate-200 bg-white py-16 text-slate-900 md:py-20">
      <div className="mx-auto max-w-6xl space-y-10 px-4">
        <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-[30px] border border-slate-200 bg-slate-50 p-6 md:p-8">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Prova visual</p>
            <h2 className="mt-3 font-poppins text-3xl font-bold leading-tight md:text-4xl">
              Antes voce tenta adivinhar. Aqui voce enxerga.
            </h2>
            <p className="mt-4 text-base leading-relaxed text-slate-600 md:text-lg">
              A melhor forma de vender controle financeiro e mostrar a diferenca entre caos mental e visao clara.
              O FinScope deixa essa diferenca obvia logo nas primeiras telas.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-[28px] border border-rose-200 bg-rose-50 p-6">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-rose-600">Sem FinScope</p>
              <p className="mt-3 text-xl font-semibold text-slate-950">Dinheiro espalhado. Decisao no susto.</p>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">
                Conta aqui, anotacao ali, memoria falhando e o aperto chegando antes da explicacao.
              </p>
            </div>

            <div className="rounded-[28px] border border-emerald-200 bg-emerald-50 p-6">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">Com FinScope</p>
              <p className="mt-3 text-xl font-semibold text-slate-950">Visao clara. Acao mais rapida.</p>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">
                Tudo em um lugar, com IA ajudando a organizar e uma leitura que faz sentido em poucos segundos.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-8">
          {proofCards.map((item, index) => (
            <div key={item.title} className="grid items-center gap-6 lg:grid-cols-[1fr_1fr] lg:gap-10">
              <div className={index % 2 === 1 ? "lg:order-2" : ""}>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-100 text-sky-800">
                      <item.icon className="h-5 w-5" />
                    </div>
                    <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">{item.eyebrow}</p>
                  </div>

                  <h3 className="font-poppins text-2xl font-bold leading-tight text-slate-950 md:text-3xl">
                    {item.title}
                  </h3>

                  <p className="leading-relaxed text-slate-600">{item.description}</p>

                  <div className="space-y-3">
                    {item.bullets.map((bullet) => (
                      <div key={bullet} className="flex items-start gap-3">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                        <p className="text-sm leading-relaxed text-slate-700">{bullet}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className={index % 2 === 1 ? "lg:order-1" : ""}>
                <ProofImage src={item.imageSrc} alt={item.imageAlt} />
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col items-center justify-between gap-4 rounded-[28px] border border-slate-200 bg-slate-950 px-6 py-8 text-center text-white md:flex-row md:text-left">
          <div>
            <p className="text-xl font-semibold">Se a tela ja deixa o problema mais claro, imagine usando na sua rotina.</p>
            <p className="mt-1 text-sm text-slate-300">O objetivo nao e impressionar. E fazer voce agir mais rapido.</p>
          </div>
          <Link href={ctaHref}>
            <Button className="min-h-12 rounded-xl bg-white px-6 text-slate-950 hover:bg-slate-100">
              Quero testar isso na minha rotina
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
