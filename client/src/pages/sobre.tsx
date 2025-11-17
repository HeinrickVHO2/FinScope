import { FinScopeHeader } from "@/components/site/FinScopeHeader";
import { FinScopeFooter } from "@/components/site/FinScopeFooter";
import { motion } from "framer-motion";
import { Shield, TrendingUp, Users } from "lucide-react";

export default function SobrePage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <FinScopeHeader />

      <main className="relative">
        <div className="absolute inset-0 -z-10 pointer-events-none">
          <div className="absolute -top-24 right-10 h-72 w-72 bg-primary/25 blur-3xl rounded-full opacity-40" />
        </div>

        <section className="container py-24 max-w-5xl mx-auto space-y-20">

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center max-w-2xl mx-auto space-y-4"
          >
            <h1 className="text-4xl md:text-5xl font-poppins font-bold">
              Criado para quem leva finanças a sério
            </h1>
            <p className="text-slate-600">
              O FinScope nasceu da necessidade real de separar, organizar e entender
              finanças pessoais e MEI de forma simples, moderna e intuitiva.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-12">
            <div className="text-center space-y-3">
              <TrendingUp className="h-10 w-10 text-primary mx-auto" />
              <h3 className="font-semibold text-lg">Foco em Resultado</h3>
              <p className="text-slate-600 text-sm">
                Clareza nos números para decisões financeiras mais inteligentes.
              </p>
            </div>

            <div className="text-center space-y-3">
              <Users className="h-10 w-10 text-primary mx-auto" />
              <h3 className="font-semibold text-lg">Feito para Pessoas Reais</h3>
              <p className="text-slate-600 text-sm">
                Do iniciante ao avançado: o FinScope evolui junto com você.
              </p>
            </div>

            <div className="text-center space-y-3">
              <Shield className="h-10 w-10 text-primary mx-auto" />
              <h3 className="font-semibold text-lg">Segurança Primeiro</h3>
              <p className="text-slate-600 text-sm">
                Construído com princípios de AppSec e proteção de dados desde o design.
              </p>
            </div>
          </div>

        </section>
      </main>

      <FinScopeFooter />
    </div>
  );
}
