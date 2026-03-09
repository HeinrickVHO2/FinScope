import { FinScopeHeader } from "@/components/site/FinScopeHeader";
import { FinScopeFooter } from "@/components/site/FinScopeFooter";
import { motion } from "framer-motion";
import { useState } from "react";
import { ChevronDown } from "lucide-react";

export default function FAQPage() {
  const faqs = [
    {
      q: "Tenho garantia ao contratar o FinScope?",
      a: "Sim! Você paga agora, usa sem limitações e tem 10 dias para pedir reembolso total caso não curta a experiência.",
    },
    {
      q: "Posso usar tanto para vida pessoal quanto para minha PJ?",
      a: "Sim, o FinScope possui separação completa entre contas PF e PJ, com categorias empresariais (incluindo MEI) dentro do mesmo painel.",
    },
    {
      q: "Como funciona o planejamento de contas futuras?",
      a: "Você cadastra cada despesa prevista (boletos, assinaturas, impostos) e o FinScope calcula o impacto no saldo. As ações “Aqui já foi pago” e “Marcar como atrasada” mantêm o planejamento atualizado.",
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
      a: "Todo novo cliente tem 10 dias de garantia. Aproveite esse período para explorar dashboards, cadastrar contas e testar o controle empresarial sem risco.",
    },
    {
      q: "Como o suporte funciona na prática?",
      a: "Além do e-mail contato@finscope.com.br, você recebe tutoriais dentro do app e atualizações constantes. Responderemos em até 6 horas úteis.",
    },
    {
      q: "O plano Premium vale a pena se eu já uso o Pro?",
      a: "Sim, especialmente se você precisa de automações, relatórios e controles empresariais completos. O upgrade é instantâneo e basta acessar as configurações para abrir o checkout novamente.",
    },
  ];

  const [open, setOpen] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <FinScopeHeader />

      <main className="max-w-4xl mx-auto px-4 py-24 space-y-16">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-4"
        >
          <h1 className="text-4xl font-poppins font-bold">Perguntas Frequentes</h1>
          <p className="text-slate-600 max-w-xl mx-auto">
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
              className="border rounded-xl p-5 bg-white shadow-sm"
            >
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="w-full flex items-center justify-between text-left"
              >
                <p className="font-medium text-lg">{faq.q}</p>
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
                <p className="text-slate-600 text-sm overflow-hidden">{faq.a}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </main>

      <FinScopeFooter />
    </div>
  );
}
