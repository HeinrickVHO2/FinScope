import { FinScopeHeader } from "@/components/site/FinScopeHeader";
import { FinScopeFooter } from "@/components/site/FinScopeFooter";
import { motion } from "framer-motion";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Shield } from "lucide-react";

export default function PrivacidadePage() {
  return (
    <div className="min-h-screen bg-white text-slate-700 flex flex-col">
      <FinScopeHeader />

      <main className="flex-1 relative">
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-10 right-10 w-72 h-72 bg-blue-200/40 blur-[120px] rounded-full opacity-60" />
          <div className="absolute bottom-20 left-10 w-72 h-72 bg-indigo-200/40 blur-[120px] rounded-full opacity-60" />
        </div>

        <section className="container max-w-4xl mx-auto py-20">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="text-center"
          >
            <Shield className="h-14 w-14 text-primary mx-auto mb-4" />
            <h1 className="text-4xl md:text-5xl font-poppins font-bold text-slate-900">
              Política de Privacidade
            </h1>
            <p className="mt-4 text-slate-600 max-w-2xl mx-auto">
              Suas informações são tratadas com cuidado, privacidade e responsabilidade.
            </p>
          </motion.div>

          <div className="mt-12">
            <Accordion type="single" collapsible className="space-y-4">
              <AccordionItem value="dados">
                <AccordionTrigger className="text-lg font-semibold text-slate-900">
                  Quais dados coletamos?
                </AccordionTrigger>
                <AccordionContent className="text-slate-600 leading-relaxed">
                  Coletamos apenas informações essenciais:
                  <ul className="list-disc ml-6 mt-3">
                    <li>Nome e e-mail</li>
                    <li>Transações adicionadas por você</li>
                    <li>Dados de login</li>
                    <li>Métricas de uso para melhorias</li>
                  </ul>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="seguranca">
                <AccordionTrigger className="text-lg font-semibold text-slate-900">
                  Como protegemos seus dados?
                </AccordionTrigger>
                <AccordionContent className="text-slate-600 leading-relaxed">
                  Mantemos medidas de proteção como:
                  <ul className="list-disc ml-6 mt-3">
                    <li>Acesso protegido por login</li>
                    <li>Cópias de segurança regulares</li>
                    <li>Monitoramento para evitar acessos indevidos</li>
                    <li>Cuidados de privacidade desde o desenvolvimento</li>
                  </ul>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="compartilhamento">
                <AccordionTrigger className="text-lg font-semibold text-slate-900">
                  Compartilhamento de dados
                </AccordionTrigger>
                <AccordionContent className="text-slate-600 leading-relaxed">
                  Não vendemos seus dados.
                  Compartilhamos apenas quando necessário, como:
                  <ul className="list-disc ml-6 mt-3">
                    <li>Serviços essenciais para o funcionamento da plataforma</li>
                    <li>Fornecedores contratados (como e-mail)</li>
                    <li>Exigências legais</li>
                  </ul>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="direitos">
                <AccordionTrigger className="text-lg font-semibold text-slate-900">
                  Seus direitos segundo a LGPD
                </AccordionTrigger>
                <AccordionContent className="text-slate-600 leading-relaxed">
                  Você pode:
                  <ul className="list-disc ml-6 mt-3">
                    <li>Solicitar remoção dos dados</li>
                    <li>Solicitar cópia ou exportação</li>
                    <li>Corrigir informações</li>
                    <li>Encerrar conta a qualquer momento</li>
                  </ul>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </section>
      </main>

      <FinScopeFooter />
    </div>
  );
}
