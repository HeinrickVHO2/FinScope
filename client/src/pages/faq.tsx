import { FinScopeFooter } from "@/components/site/FinScopeFooter";
import { FinScopeHeader } from "@/components/site/FinScopeHeader";
import { ChevronDown } from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";

export default function FAQPage() {
  const faqs = [
    {
      q: "Tenho garantia ao contratar o FinScope?",
      a: "Sim. Voce paga, usa sem limitacoes e tem 14 dias para pedir reembolso total se achar que o FinScope nao faz sentido para voce.",
    },
    {
      q: "Posso usar tanto para vida pessoal quanto para minha empresa?",
      a: "Sim. Por padrao, os lancamentos do assistente vao para a conta pessoal. Para registrar na empresa, voce precisa mencionar isso explicitamente e ja ter criado sua conta PJ na area Minha Empresa.",
    },
    {
      q: "Como o assistente decide entre conta pessoal e empresa?",
      a: "O padrao do FinScope e sempre a conta pessoal. O assistente so registra na empresa quando voce escreve algo como \"na empresa\" ou \"na conta PJ\". Se a conta PJ ainda nao existir, o lancamento empresarial e bloqueado ate voce criar essa conta na area PJ/Minha Empresa.",
    },
    {
      q: "Como funciona o planejamento de contas futuras?",
      a: "Voce cadastra cada despesa prevista, como boletos, assinaturas e impostos, e o FinScope mostra o impacto disso no saldo. Depois, basta marcar o que ja foi pago ou o que atrasou para manter tudo em dia.",
    },
    {
      q: "O sistema calcula quanto dinheiro vai sobrar?",
      a: "Sim. A Previsao de Caixa considera saldo atual, receitas previstas e contas futuras para mostrar o dinheiro livre esperado e a economia recomendada.",
    },
    {
      q: "Existe integracao com bancos?",
      a: "Estamos preparando o modulo de Open Finance. Enquanto isso, voce importa CSV ou cadastra via automacoes Premium.",
    },
    {
      q: "Posso automatizar a categorizacao?",
      a: "No Premium voce cria regras automaticas que identificam palavras-chave e classificam as transacoes sozinhas.",
    },
    {
      q: "O FinScope funciona no celular?",
      a: "Sim. A aplicacao foi desenhada para ser responsiva e funcionar tanto no desktop quanto em smartphones, sem necessidade de download de app.",
    },
    {
      q: "Consigo testar os recursos antes de contratar?",
      a: "Todo novo cliente tem 14 dias de garantia. Nesse periodo, voce pode explorar o plano contratado sem risco. No Premium, isso inclui a area Minha empresa, o Agent de WhatsApp e os relatorios avancados.",
    },
    {
      q: "Como o suporte funciona na pratica?",
      a: "Alem do e-mail contato@finscope.com.br, voce recebe tutoriais dentro do app e atualizacoes constantes. Responderemos em ate 6 horas uteis.",
    },
    {
      q: "O plano Premium vale a pena se eu ja uso o Pro?",
      a: "Sim, principalmente se voce quer menos trabalho manual, Agent de WhatsApp, relatorios mais completos e a area Minha empresa no mesmo fluxo. Hoje o Premium custa R$ 39,90/mes, ou menos de R$ 1,33 por dia.",
    },
  ];

  const [open, setOpen] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <FinScopeHeader />

      <main className="mx-auto max-w-4xl space-y-16 px-4 py-24">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4 text-center"
        >
          <h1 className="text-4xl font-poppins font-bold">Perguntas Frequentes</h1>
          <p className="mx-auto max-w-xl text-slate-600">
            Veja respostas para as duvidas mais comuns sobre o FinScope.
          </p>
        </motion.div>

        <div className="space-y-4">
          {faqs.map((faq, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="rounded-xl border bg-white p-5 shadow-sm"
            >
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="flex w-full items-center justify-between text-left"
              >
                <p className="text-lg font-medium">{faq.q}</p>
                <ChevronDown
                  className={`h-5 w-5 transition-transform ${
                    open === i ? "rotate-180" : ""
                  }`}
                />
              </button>

              <div
                className={`grid overflow-hidden transition-all duration-300 ${
                  open === i ? "grid-rows-[1fr] pt-3" : "grid-rows-[0fr]"
                }`}
              >
                <p className="overflow-hidden text-sm text-slate-600">{faq.a}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </main>

      <FinScopeFooter />
    </div>
  );
}
