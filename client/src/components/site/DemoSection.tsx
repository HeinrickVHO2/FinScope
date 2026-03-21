import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight, Bot, CalendarClock, CheckCircle2, LayoutDashboard, MessageCircleMore } from "lucide-react";

const showcases = [
  {
    eyebrow: "Assistente com IA",
    title: "Converse de forma natural e registre movimentos sem sair da tela",
    description:
      "O assistente entende gastos, investimentos e metas no mesmo fluxo, mantendo a conversa clara e a execução objetiva.",
    bullets: [
      "Registra movimentações do dia a dia com linguagem natural",
      "Entende metas com valor total e quanto já foi guardado",
      "Mantém a resposta curta, útil e contextual",
    ],
    icon: Bot,
    imageSrc: "/landing/ia-chat.png",
    imageAlt: "Tela do assistente com IA do FinScope registrando gastos, investimentos e metas",
    reverse: false,
  },
  {
    eyebrow: "WhatsApp",
    title: "Peça um resumo e receba a leitura do período direto no chat",
    description:
      "Quando você precisa de uma revisão rápida, o FinScope devolve visão geral, comparação e destaques no próprio WhatsApp.",
    bullets: [
      "Resumo de entradas, saídas e saldo no mesmo retorno",
      "Destaques de categoria e maior gasto do período",
      "Formato prático para revisar sem abrir outra tela",
    ],
    icon: MessageCircleMore,
    imageSrc: "/landing/ia-whats.png",
    imageAlt: "Resumo financeiro enviado pelo FinScope no WhatsApp",
    reverse: true,
  },
  {
    eyebrow: "Visão geral",
    title: "Painel principal com leitura clara do mês e contexto financeiro em um só lugar",
    description:
      "A visão geral combina saldo, receitas, despesas, fluxo e resumo inteligente do mês sem excesso visual nem navegação confusa.",
    bullets: [
      "Resumo do período com os números centrais do mês",
      "Resumo inteligente com foco configurável",
      "Leitura rápida para entender o que merece atenção",
    ],
    icon: LayoutDashboard,
    imageSrc: "/landing/dashboard-1.png",
    imageAlt: "Dashboard principal do FinScope com visão geral e resumo inteligente",
    reverse: false,
  },
  {
    eyebrow: "Planejamento do mês",
    title: "Compare planejado e realizado para enxergar o impacto das contas previstas",
    description:
      "A área de planejamento mostra o que estava previsto, o que realmente saiu e o efeito disso no saldo futuro do mês.",
    bullets: [
      "Comparação direta entre plano e resultado real",
      "Leitura visual da diferença entre receitas e despesas",
      "Previsão de caixa para acompanhar o mês com mais segurança",
    ],
    icon: CalendarClock,
    imageSrc: "/landing/dashboard-2.png",
    imageAlt: "Tela do FinScope com planejado versus realizado e previsão de caixa",
    reverse: true,
  },
];

function ShowcaseImage({
  src,
  alt,
}: {
  src: string;
  alt: string;
}) {
  return (
    <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
      <img src={src} alt={alt} className="h-full w-full object-cover object-left-top" />
    </div>
  );
}

export function DemoSection() {
  return (
    <section id="demo" className="border-t border-slate-200 bg-slate-50 py-16 text-slate-900">
      <div className="mx-auto max-w-6xl space-y-8 px-4">
        <div className="space-y-3 text-center">
          <h2 className="font-poppins text-3xl font-bold md:text-4xl">
            Veja como o FinScope aparece na prática ao longo da rotina
          </h2>
          <p className="mx-auto max-w-3xl text-slate-600">
            Da conversa com IA ao planejamento do mês, cada tela abaixo mostra uma parte real do produto no ponto certo da narrativa.
          </p>
        </div>

        <div className="space-y-8">
          {showcases.map((item) => (
            <div
              key={item.title}
              className={`grid items-center gap-6 lg:gap-10 ${item.reverse ? "lg:grid-cols-[1.05fr_0.95fr]" : "lg:grid-cols-[0.95fr_1.05fr]"}`}
            >
              <div className={item.reverse ? "lg:order-2" : ""}>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                      <item.icon className="h-5 w-5" />
                    </div>
                    <p className="text-sm uppercase tracking-[0.18em] text-slate-500">{item.eyebrow}</p>
                  </div>

                  <h3 className="font-poppins text-2xl font-bold leading-tight text-slate-900 md:text-3xl">
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

              <div className={item.reverse ? "lg:order-1" : ""}>
                <ShowcaseImage src={item.imageSrc} alt={item.imageAlt} />
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col items-center justify-center gap-3 rounded-[28px] border border-slate-200 bg-white px-6 py-8 text-center sm:flex-row sm:text-left">
          <div className="space-y-1">
            <p className="font-semibold text-slate-900">Quer ver tudo isso funcionando na sua rotina?</p>
            <p className="text-sm text-slate-600">Crie sua conta e avance para o plano que faz sentido para o seu uso.</p>
          </div>
          <Link href="/signup">
            <Button className="min-w-[180px]">
              Começar agora
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
