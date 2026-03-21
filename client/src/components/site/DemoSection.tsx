import type { ReactNode } from "react";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, Bot, CalendarClock, CheckCircle2, LayoutDashboard, MessageCircleMore } from "lucide-react";

type ShowcaseItem = {
  title: string;
  eyebrow: string;
  description: string;
  bullets: string[];
  reverse?: boolean;
  render: () => ReactNode;
  icon: typeof Bot;
};

function Frame({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
      {children}
    </div>
  );
}

function ProductImage({
  src,
  alt,
  className = "",
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  return (
    <Frame>
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Produto em contexto real</p>
          <p className="text-sm font-medium text-slate-800">Captura da plataforma</p>
        </div>
        <div className="rounded-full border border-primary/15 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
          FinScope
        </div>
      </div>
      <div className="bg-slate-50">
        <img src={src} alt={alt} className={className} />
      </div>
    </Frame>
  );
}

function AiAssistantPreview() {
  return (
    <Frame>
      <div className="border-b border-slate-200 px-5 py-4">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Assistente com IA</p>
        <p className="mt-1 text-sm text-slate-600">Transforme mensagens naturais em registros e metas.</p>
      </div>

      <div className="space-y-4 bg-slate-50 p-5">
        <div className="max-w-[72%] rounded-2xl rounded-tl-md border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm">
          Perfeito! Meta registrada com o valor total e o que você já guardou.
        </div>

        <div className="ml-auto max-w-[78%] rounded-2xl rounded-tr-md bg-primary px-4 py-3 text-sm text-white shadow-sm">
          quero comprar uma geladeira de 8 mil reais, já guardei 580 reais.
        </div>

        <div className="max-w-[82%] rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            Meta criada com sucesso
          </div>

          <div className="mt-4 space-y-2 text-sm text-slate-700">
            <p>Geladeira</p>
            <p>Objetivo: R$ 8.000,00</p>
            <p>Guardado até agora: R$ 580,00</p>
            <p>Progresso: 7%</p>
          </div>

          <div className="mt-4 rounded-2xl border border-primary/15 bg-primary/[0.03] p-4">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-slate-900">Geladeira</p>
                <p className="text-xs text-slate-500">Acompanhe a evolução do objetivo</p>
              </div>
              <p className="text-3xl font-bold text-slate-900">7%</p>
            </div>
            <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-200">
              <div className="h-full w-[7%] rounded-full bg-gradient-to-r from-primary to-emerald-400" />
            </div>
          </div>
        </div>
      </div>
    </Frame>
  );
}

function WhatsAppPreview() {
  return (
    <Frame>
      <div className="border-b border-slate-200 px-5 py-4">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">WhatsApp</p>
        <p className="mt-1 text-sm text-slate-600">Receba resumos e contexto sem sair da conversa.</p>
      </div>

      <div className="space-y-4 bg-[#f7f1e7] p-5">
        <div className="ml-auto max-w-[72%] rounded-2xl rounded-tr-md bg-[#dcf8c6] px-4 py-3 text-sm text-slate-900 shadow-sm">
          faça um resumo dos meus últimos 7 dias
        </div>

        <div className="max-w-[80%] rounded-2xl rounded-tl-md border border-[#e7ded0] bg-white px-4 py-4 shadow-sm">
          <p className="text-sm font-semibold text-slate-900">Resumo dos últimos 7 dias</p>
          <div className="mt-3 space-y-3 text-sm text-slate-700">
            <div>
              <p className="font-medium text-slate-900">Visão geral</p>
              <p>Entradas: R$ 1.670,00</p>
              <p>Saídas: R$ 1.086,05</p>
              <p>Saldo: R$ 583,95</p>
            </div>
            <div>
              <p className="font-medium text-slate-900">Destaques</p>
              <p>Categoria com maior peso: Investimentos</p>
              <p>Maior gasto: Reserva de emergência</p>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-white p-3">
                <p className="text-[11px] uppercase tracking-wide text-slate-500">Entradas</p>
                <p className="mt-1 text-lg font-semibold text-emerald-600">R$ 1.670</p>
              </div>
              <div className="rounded-xl bg-white p-3">
                <p className="text-[11px] uppercase tracking-wide text-slate-500">Saídas</p>
                <p className="mt-1 text-lg font-semibold text-slate-900">R$ 1.086</p>
              </div>
            </div>
            <div className="mt-3 flex h-28 items-end gap-2">
              {[38, 24, 18, 16, 22, 28, 76].map((value, index) => (
                <div key={index} className="flex-1">
                  <div
                    className="w-full rounded-t-xl bg-gradient-to-t from-primary to-emerald-400"
                    style={{ height: `${value}%` }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Frame>
  );
}

const showcases: ShowcaseItem[] = [
  {
    eyebrow: "Assistente com IA",
    title: "Escreva do seu jeito e deixe a plataforma transformar isso em ação",
    description:
      "O FinScope entende pedidos naturais para registrar movimentações, criar metas e responder com contexto visual dentro da própria conversa.",
    bullets: [
      "Cria metas com valor total e progresso inicial",
      "Registra gastos, entradas e contas futuras sem fluxo travado",
      "Mantém a resposta clara, com contexto suficiente para você seguir",
    ],
    icon: Bot,
    render: () => <AiAssistantPreview />,
  },
  {
    eyebrow: "WhatsApp com contexto",
    title: "Peça um resumo no WhatsApp e receba leitura prática do período",
    description:
      "Quando você precisa de uma visão rápida, o resumo chega pronto com entradas, saídas, saldo e destaques do que puxou o resultado.",
    bullets: [
      "Resumo dos últimos dias em linguagem direta",
      "Destaques de categoria e maior gasto no mesmo retorno",
      "Ótimo para revisar o período sem abrir outra tela",
    ],
    icon: MessageCircleMore,
    reverse: true,
    render: () => <WhatsAppPreview />,
  },
  {
    eyebrow: "Visão geral",
    title: "Painel principal limpo, com os números que realmente importam",
    description:
      "A home da plataforma entrega saldo, receitas, despesas, fluxo de caixa e visão do mês sem excesso de elementos competindo pela atenção.",
    bullets: [
      "Leitura imediata do mês",
      "Área central para acompanhar movimentações recentes",
      "Estrutura clara para usar no desktop e no celular",
    ],
    icon: LayoutDashboard,
    render: () => (
      <ProductImage
        src="/landing/dashboard-overview.png"
        alt="Dashboard do FinScope com resumo financeiro e categorias"
        className="h-full w-full object-cover object-left-top"
      />
    ),
  },
  {
    eyebrow: "Planejamento do mês",
    title: "Contas previstas e comparativo do planejado versus realizado no mesmo fluxo",
    description:
      "Além do histórico, a plataforma mostra o que ainda precisa ser pago ou recebido e compara o plano com o que de fato aconteceu no mês.",
    bullets: [
      "Previsto a pagar, previsto a receber e saldo futuro estimado",
      "Comparação do planejado com o realizado",
      "Leitura mais previsível da rotina financeira",
    ],
    icon: CalendarClock,
    reverse: true,
    render: () => (
      <ProductImage
        src="/landing/planned-cashflow.png"
        alt="Tela do FinScope com valores previstos e comparação do mês"
        className="h-full w-full object-cover object-top"
      />
    ),
  },
];

export function DemoSection() {
  return (
    <section id="demo" className="border-t border-slate-200 bg-slate-50 py-16 text-slate-900">
      <div className="mx-auto max-w-6xl space-y-12 px-4">
        <div className="space-y-4 text-center">
          <Badge variant="outline" className="border-primary/20 bg-primary/5 text-primary">
            Plataforma em contexto real
          </Badge>
          <h2 className="font-poppins text-3xl font-bold md:text-4xl">
            Capturas distribuídas com a copy certa, sem poluição visual
          </h2>
          <p className="mx-auto max-w-3xl text-slate-600">
            Em vez de empilhar telas soltas, a landing agora apresenta cada parte do produto no ponto em que ela
            faz sentido: IA, WhatsApp, visão geral e planejamento do mês.
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

              <div className={item.reverse ? "lg:order-1" : ""}>{item.render()}</div>
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
