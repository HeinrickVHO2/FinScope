import type { ReactNode } from "react";
import { Link } from "wouter";
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

function AiAssistantPreview() {
  return (
    <Frame>
      <div className="border-b border-slate-200 px-5 py-4">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Assistente com IA</p>
        <p className="mt-1 text-sm text-slate-600">Registros e metas sem sair da conversa.</p>
      </div>

      <div className="space-y-4 bg-slate-50 p-5">
        <div className="max-w-[46%] rounded-2xl rounded-tl-md border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm">
          Perfeito! Meta de R$ 60 mil para comprar o carro.
        </div>

        <div className="ml-auto max-w-[66%] rounded-2xl rounded-tr-md bg-primary px-4 py-3 text-sm text-white shadow-sm">
          quero comprar uma geladeira de 8 mil reais, já guardei 580 reais.
        </div>

        <div className="max-w-[48%] rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            Meta criada com sucesso
          </div>

          <div className="mt-4 space-y-2 text-sm text-slate-700">
            <p>Geladeira</p>
            <p>Objetivo: R$ 8.000,00</p>
            <p>Já deixei registrado que você já guardou R$ 580,00.</p>
            <p>Progresso: 7%</p>
          </div>

          <div className="mt-4 rounded-2xl border border-primary/15 bg-primary/[0.03] p-4">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-slate-900">geladeira</p>
                <p className="text-xs text-slate-500">Acompanhe a evolução do objetivo</p>
              </div>
              <p className="text-3xl font-bold text-slate-900">7%</p>
            </div>
            <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-200">
              <div className="h-full w-[7%] rounded-full bg-gradient-to-r from-primary to-emerald-400" />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-400">
          Ex.: Recebi 3.500 de salário
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
        <p className="mt-1 text-sm text-slate-600">Resumo prático sem abrir outra tela.</p>
      </div>

      <div className="space-y-4 bg-[#f7f1e7] p-5">
        <div className="ml-auto max-w-[42%] rounded-2xl rounded-tr-md bg-[#dcf8c6] px-4 py-3 text-sm text-slate-900 shadow-sm">
          faça um resumo dos meus últimos 7 dias
        </div>

        <div className="max-w-[64%] rounded-2xl rounded-tl-md border border-[#e7ded0] bg-white px-4 py-4 shadow-sm">
          <p className="text-sm font-semibold text-slate-900">Resumo de últimos 7 dias</p>

          <div className="mt-3 space-y-3 text-sm text-slate-700">
            <div>
              <p className="font-medium text-slate-900">Visão geral</p>
              <p>Entradas: R$ 1.670,00</p>
              <p>Saídas: R$ 1.086,05</p>
              <p>Saldo: R$ 583,95</p>
            </div>

            <div>
              <p className="font-medium text-slate-900">Comparação</p>
              <p>Despesas: +R$ 724,10</p>
              <p>Saldo: +R$ 945,90</p>
            </div>

            <div>
              <p className="font-medium text-slate-900">Destaques</p>
              <p>Categoria com maior peso: Investimentos</p>
              <p>Maior gasto: Reserva de emergência</p>
            </div>
          </div>

          <div className="mt-4 w-[220px] rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-white p-2.5">
                <p className="text-[11px] text-slate-500">Entradas</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">R$ 1.670,00</p>
              </div>
              <div className="rounded-xl bg-white p-2.5">
                <p className="text-[11px] text-slate-500">Saídas</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">R$ 1.086,05</p>
              </div>
            </div>
            <div className="mt-3 flex h-20 items-end gap-1.5">
              {[30, 24, 12, 16, 14, 10, 52].map((value, index) => (
                <div key={index} className="flex-1">
                  <div
                    className="w-full rounded-t-lg bg-gradient-to-t from-primary to-emerald-400"
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

function DashboardPreview() {
  return (
    <Frame>
      <div className="grid min-h-[440px] grid-cols-[108px_1fr] bg-slate-50">
        <aside className="border-r border-slate-200 bg-white px-3 py-5">
          <div className="mb-6 text-sm font-semibold text-primary">FINSCOPE</div>
          <div className="space-y-2 text-[11px] text-slate-500">
            {["Início", "Minha empresa", "Contas a pagar", "WhatsApp", "Assistente", "Metas", "Configurações"].map((item, index) => (
              <div
                key={item}
                className={`rounded-xl px-3 py-2 ${index === 0 ? "bg-slate-100 font-medium text-slate-900" : ""}`}
              >
                {item}
              </div>
            ))}
          </div>
        </aside>

        <div className="relative p-5">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Suas finanças em um só lugar</p>
              <h3 className="mt-2 font-poppins text-2xl font-bold text-slate-900">Visão geral</h3>
            </div>
            <div className="flex gap-2">
              {["Conta Pessoal", "Minha empresa", "Visão Total"].map((item) => (
                <div key={item} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] text-slate-700">
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[24px] border border-slate-200 bg-white p-4">
            <p className="text-sm text-slate-500">Resumo do período</p>
            <h4 className="mt-1 text-xl font-semibold text-slate-900">Finanças Pessoais</h4>
            <div className="mt-4 grid grid-cols-4 gap-3">
              {[
                ["Saldo", "R$ 2.945,01"],
                ["Receitas", "R$ 0,00"],
                ["Despesas", "R$ 4.040,00"],
                ["Fluxo", "R$ -4.040,00"],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs text-slate-500">{label}</p>
                  <p className="mt-2 text-xl font-semibold text-slate-900">{value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5 rounded-[24px] border border-primary/10 bg-primary/[0.03] p-4">
            <div className="flex items-center gap-2">
              <span className="text-primary">✦</span>
              <h4 className="text-xl font-semibold text-slate-900">Resumo inteligente do mês</h4>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3">
              {["Foco em economia", "Foco em dívidas", "Foco em investimentos"].map((item, index) => (
                <div key={item} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-sm font-medium text-slate-900">{item}</p>
                  <div className="mt-4 flex justify-end">
                    <div className={`h-7 w-14 rounded-full ${index === 1 ? "bg-primary" : "bg-slate-300"} p-1`}>
                      <div className={`h-5 w-5 rounded-full bg-white ${index === 1 ? "ml-auto" : ""}`} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="absolute bottom-5 right-5 w-[280px] rounded-[24px] border border-slate-200 bg-white shadow-2xl">
            <div className="border-b border-slate-200 px-4 py-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Finscope IA</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">Assistente com IA</p>
              <p className="mt-1 text-sm text-slate-500">Registre gastos, receitas e contas futuras sem sair da tela.</p>
            </div>
            <div className="space-y-3 px-4 py-4">
              <div className="rounded-2xl rounded-tl-md border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                Anotado! R$ 3.900,00 pela compra do relógio na conta pessoal.
              </div>
              <div className="ml-auto rounded-2xl rounded-tr-md bg-primary px-4 py-3 text-sm text-white">
                Recebi meu salário de 6200 reais
              </div>
              <div className="rounded-2xl rounded-tl-md border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                Isso é da sua conta pessoal ou da sua empresa?
              </div>
            </div>
          </div>
        </div>
      </div>
    </Frame>
  );
}

function AccountsPayablePreview() {
  return (
    <Frame>
      <div className="grid min-h-[430px] grid-cols-[108px_1fr] bg-slate-50">
        <aside className="border-r border-slate-200 bg-white px-3 py-5">
          <div className="mb-6 text-sm font-semibold text-primary">FINSCOPE</div>
          <div className="space-y-2 text-[11px] text-slate-500">
            {["Início", "Minha empresa", "Contas a pagar", "WhatsApp", "Transações", "Metas", "Configurações"].map((item, index) => (
              <div
                key={item}
                className={`rounded-xl px-3 py-2 ${index === 2 ? "bg-slate-100 font-medium text-slate-900" : ""}`}
              >
                {item}
              </div>
            ))}
          </div>
        </aside>

        <div className="p-5">
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Agenda financeira</p>
            <h3 className="mt-2 font-poppins text-2xl font-bold text-slate-900">Contas a pagar</h3>
            <p className="mt-2 text-sm text-slate-600">Tudo o que foi registrado como pagamentos e recebimentos futuros.</p>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-3">
            <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4">
              <p className="text-sm text-rose-500">Previsto a pagar</p>
              <p className="mt-2 text-3xl font-semibold text-rose-600">R$ 0,00</p>
            </div>
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
              <p className="text-sm text-emerald-600">Previsto a receber</p>
              <p className="mt-2 text-3xl font-semibold text-emerald-700">R$ 0,00</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-sm text-slate-500">Saldo futuro estimado</p>
              <p className="mt-2 text-3xl font-semibold text-slate-900">R$ 0,00</p>
            </div>
          </div>

          <div className="mt-6 rounded-[26px] border border-slate-200 bg-white p-5">
            <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Planejado vs realizado</p>
            <h4 className="mt-2 text-2xl font-semibold text-slate-900">Como suas contas estão indo no mês</h4>
            <p className="mt-2 text-sm text-slate-600">
              Comparamos o que estava previsto com o que realmente entrou e saiu neste mês.
            </p>

            <div className="mt-5 grid grid-cols-4 gap-3">
              {[
                ["Previsto para sair", "R$ 0,00"],
                ["Saiu de verdade", "R$ 4.040,00"],
                ["Diferença", "R$ 4.040,00"],
                ["Aderência ao plano", "100%"],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs text-slate-500">{label}</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
                </div>
              ))}
            </div>

            <div className="mt-5 grid grid-cols-[1.05fr_1fr] gap-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-2xl font-semibold text-slate-900">Você gastou 0% a mais que o planejado.</p>
                <p className="mt-3 text-lg text-slate-500">Você ultrapassou R$ 4.040,00 do previsto.</p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex h-[180px] items-end justify-between gap-3">
                  <div className="flex h-full flex-1 items-end">
                    <div className="w-full rounded-t-xl bg-slate-300" style={{ height: "4%" }} />
                  </div>
                  <div className="flex h-full flex-1 items-end">
                    <div className="w-full rounded-t-xl bg-primary" style={{ height: "72%" }} />
                  </div>
                </div>
                <div className="mt-3 flex justify-between text-sm text-slate-500">
                  <span>Receitas</span>
                  <span>Despesas</span>
                </div>
              </div>
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
    title: "Converse de forma natural e transforme isso em registro com contexto",
    description:
      "A plataforma entende pedidos do dia a dia para criar metas, registrar valores e devolver a resposta com contexto suficiente para você acompanhar a evolução.",
    bullets: [
      "Interpreta objetivo, valor total e quanto já foi guardado",
      "Mantém a conversa útil, sem te jogar em fluxo quebrado",
      "Mostra o progresso da meta logo na própria resposta",
    ],
    icon: Bot,
    render: () => <AiAssistantPreview />,
  },
  {
    eyebrow: "WhatsApp",
    title: "Peça um resumo e receba uma leitura prática do período no chat",
    description:
      "Para revisões rápidas, o FinScope entrega um resumo curto, com visão geral, comparação e destaques do que puxou o resultado.",
    bullets: [
      "Entradas, saídas e saldo no mesmo retorno",
      "Destaques de categoria e maior gasto",
      "Formato fácil de bater o olho e seguir",
    ],
    icon: MessageCircleMore,
    reverse: true,
    render: () => <WhatsAppPreview />,
  },
  {
    eyebrow: "Painel principal",
    title: "Veja o mês em um painel limpo, com IA presente sem poluir a leitura",
    description:
      "A visão geral combina saldo, receitas, despesas, fluxo e um resumo inteligente do mês, com o assistente disponível no mesmo contexto.",
    bullets: [
      "Resumo financeiro centralizado",
      "Preferências de leitura com foco por tema",
      "Assistente acessível sem tirar atenção do painel",
    ],
    icon: LayoutDashboard,
    render: () => <DashboardPreview />,
  },
  {
    eyebrow: "Contas previstas",
    title: "Acompanhe o planejado versus realizado e enxergue o impacto no mês",
    description:
      "A área de contas a pagar organiza previsões, mostra saldo futuro estimado e compara o plano com o que realmente saiu ou entrou.",
    bullets: [
      "Visão de previsto a pagar e a receber",
      "Comparação clara do planejado com o realizado",
      "Leitura mais previsível da rotina financeira",
    ],
    icon: CalendarClock,
    reverse: true,
    render: () => <AccountsPayablePreview />,
  },
];

export function DemoSection() {
  return (
    <section id="demo" className="border-t border-slate-200 bg-slate-50 py-16 text-slate-900">
      <div className="mx-auto max-w-6xl space-y-8 px-4">
        <div className="space-y-3 text-center">
          <h2 className="font-poppins text-3xl font-bold md:text-4xl">
            Veja como o FinScope aparece no uso real do dia a dia
          </h2>
          <p className="mx-auto max-w-3xl text-slate-600">
            Cada área abaixo mostra uma parte importante do produto sem empilhar telas soltas nem exagerar na apresentação.
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
