import { FinScopeHeader } from "@/components/site/FinScopeHeader";
import { FinScopeFooter } from "@/components/site/FinScopeFooter";
import { motion } from "framer-motion";
import { useState } from "react";
import { ChevronDown } from "lucide-react";

export default function FAQPage() {
  const faqs = [
    {
      q: "Tenho garantia ao contratar o FinScope?",
      a: "Sim. Você paga, usa sem limitações e tem 10 dias para pedir reembolso total se achar que o FinScope não faz sentido para você.",
    },
    {
      q: "Posso usar tanto para vida pessoal quanto para minha empresa?",
      a: "Sim, o FinScope separa sua conta pessoal da área Minha empresa dentro do mesmo painel.",
    },
    {
      q: "Como funciona o planejamento de contas futuras?",
      a: "Você cadastra cada despesa prevista, como boletos, assinaturas e impostos, e o FinScope mostra o impacto disso no saldo. Depois, basta marcar o que já foi pago ou o que atrasou para manter tudo em dia.",
    },
    {
      q: "O sistema calcula quanto dinheiro vai sobrar?",
      a: "Sim. A Previsão de Caixa considera saldo atual, receitas previstas e contas futuras para mostrar o dinheiro livre esperado e a economia recomendada.",
    },
    {
      q: "Existe integração com bancos?",
      a: "Estamos preparando o módulo de Open Finance. Enquanto isso, você importa CSV ou cadastra via automações Premium.",
    },
    {
      q: "Posso automatizar a categorização?",
      a: "No Premium você cria regras automáticas que identificam palavras-chave e classificam as transações sozinhas.",
    },
    {
      q: "O FinScope funciona no celular?",
      a: "Sim. A aplicação foi desenhada para ser responsiva e funcionar tanto no desktop quanto em smartphones, sem necessidade de download de app.",
    },
    {
      q: "Consigo testar os recursos antes de contratar?",
      a: "Todo novo cliente tem 10 dias de garantia. Nesse período, você pode explorar o plano contratado sem risco. No Premium, isso inclui a área Minha empresa, o Agent de WhatsApp e os relatórios avançados.",
    },
    {
      q: "Como o suporte funciona na prática?",
      a: "Além do e-mail contato@finscope.com.br, você recebe tutoriais dentro do app e atualizações constantes. Responderemos em até 6 horas úteis.",
    },
    {
      q: "O plano Premium vale a pena se eu já uso o Pro?",
      a: "Sim, principalmente se você quer menos trabalho manual, Agent de WhatsApp, relatórios mais completos e a área Minha empresa no mesmo fluxo. Hoje o Premium custa R$ 39,90/mês, ou menos de R$ 1,33 por dia.",
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
            Veja respostas para as dúvidas mais comuns sobre o FinScope.
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
