import { FinScopeHeader } from "@/components/site/FinScopeHeader";
import { FinScopeFooter } from "@/components/site/FinScopeFooter";
import { motion } from "framer-motion";
import { useState } from "react";
import { ChevronDown } from "lucide-react";

export default function FAQPage() {
  const faqs = [
    {
      q: "O FinScope é realmente gratuito por 7 dias?",
      a: "Sim! Você cria sua conta e usa tudo sem limitações, durante os 7 dias de Free Trial.",
    },
    {
      q: "Posso usar tanto para vida pessoal quanto MEI?",
      a: "Sim, o FinScope possui separação completa entre PF e PJ dentro do painel.",
    },
    {
      q: "Existe integração com bancos?",
      a: "Está em desenvolvimento via Open Finance, planejado para próxima versão.",
    },
    {
      q: "Meus dados ficam seguros?",
      a: "O sistema foi construído com práticas de AppSec, criptografia e isolamento de dados.",
    },
  ];

  const [open, setOpen] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <FinScopeHeader />

      <main className="container py-24 max-w-4xl mx-auto space-y-16">
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
