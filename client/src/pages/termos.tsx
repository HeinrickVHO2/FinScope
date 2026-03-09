import { FinScopeHeader } from "@/components/site/FinScopeHeader";
import { FinScopeFooter } from "@/components/site/FinScopeFooter";
import { motion } from "framer-motion";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { FileText } from "lucide-react";

export default function TermosPage() {
  return (
    <div className="min-h-screen bg-white text-slate-700 flex flex-col">
      <FinScopeHeader />

      <main className="flex-1 relative">

        {/* Background claro premium */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-12 left-16 h-72 w-72 bg-blue-100 blur-[110px] opacity-50 rounded-full" />
          <div className="absolute bottom-12 right-16 h-72 w-72 bg-indigo-100 blur-[110px] opacity-50 rounded-full" />
        </div>

        <section className="container max-w-4xl mx-auto py-20">

          {/* HERO */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="text-center"
          >
            <FileText className="h-14 w-14 text-primary mx-auto mb-4" />
            <h1 className="text-4xl md:text-5xl font-poppins font-bold text-slate-900">
              Termos de Uso
            </h1>
            <p className="mt-4 text-slate-600 max-w-2xl mx-auto">
              Ao utilizar o FinScope, você concorda com os termos abaixo.
            </p>
          </motion.div>

          {/* Accordion */}
          <div className="mt-12">
            <Accordion type="single" collapsible className="space-y-4">

              <AccordionItem value="uso-plataforma">
                <AccordionTrigger className="text-lg font-semibold text-slate-900">
                  Uso permitido
                </AccordionTrigger>
                <AccordionContent className="text-slate-600 leading-relaxed">
                  O FinScope deve ser utilizado apenas para fins pessoais ou empresariais legítimos.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="assinaturas">
                <AccordionTrigger className="text-lg font-semibold text-slate-900">
                  Assinaturas e pagamentos
                </AccordionTrigger>
                <AccordionContent className="text-slate-600 leading-relaxed">
                  Assinaturas podem ser canceladas a qualquer momento, sem fidelidade.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="responsabilidade">
                <AccordionTrigger className="text-lg font-semibold text-slate-900">
                  Responsabilidades do usuário
                </AccordionTrigger>
                <AccordionContent className="text-slate-600 leading-relaxed">
                  Você é responsável pelas informações inseridas no sistema.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="alteracoes">
                <AccordionTrigger className="text-lg font-semibold text-slate-900">
                  Alterações nos termos
                </AccordionTrigger>
                <AccordionContent className="text-slate-600 leading-relaxed">
                  Mudanças serão comunicadas através do aplicativo e e-mail.
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
