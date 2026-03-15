import { FinScopeHeader } from "@/components/site/FinScopeHeader";
import { FinScopeFooter } from "@/components/site/FinScopeFooter";
import { motion } from "framer-motion";
import { Shield, TrendingUp, Users, CalendarClock, BarChart3 } from "lucide-react";

export default function SobrePage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <FinScopeHeader />

      <main className="relative">
        <div className="absolute inset-0 -z-10 pointer-events-none">
          <div className="absolute -top-24 right-10 h-72 w-72 bg-primary/25 blur-3xl rounded-full opacity-40" />
        </div>

        <section className="max-w-5xl mx-auto px-4 py-24 space-y-20">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center max-w-2xl mx-auto space-y-4"
          >
            <h1 className="text-4xl md:text-5xl font-poppins font-bold">
              Criado para quem quer mais clareza com o dinheiro
            </h1>
            <p className="text-slate-600">
              O FinScope nasceu para ajudar pessoas e pequenos negócios a organizar as finanças
              de forma simples, prática e sem complicação.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-12">
            <div className="text-center space-y-3">
              <TrendingUp className="h-10 w-10 text-primary mx-auto" />
              <h3 className="font-semibold text-lg">Foco no que importa</h3>
              <p className="text-slate-600 text-sm">
                Mais clareza para decidir melhor no dia a dia.
              </p>
            </div>

            <div className="text-center space-y-3">
              <Users className="h-10 w-10 text-primary mx-auto" />
              <h3 className="font-semibold text-lg">Feito para pessoas reais</h3>
              <p className="text-slate-600 text-sm">
                Do começo ao avançado, com uma experiência fácil de usar.
              </p>
            </div>

            <div className="text-center space-y-3">
              <Shield className="h-10 w-10 text-primary mx-auto" />
              <h3 className="font-semibold text-lg">Privacidade e segurança</h3>
              <p className="text-slate-600 text-sm">
                Seus dados são tratados com cuidado e privacidade desde o início.
              </p>
            </div>

            <div className="text-center space-y-3">
              <CalendarClock className="h-10 w-10 text-primary mx-auto" />
              <h3 className="font-semibold text-lg">Planejamento real</h3>
              <p className="text-slate-600 text-sm">
                Organize contas futuras e acompanhe melhor os próximos passos.
              </p>
            </div>

            <div className="text-center space-y-3">
              <BarChart3 className="h-10 w-10 text-primary mx-auto" />
              <h3 className="font-semibold text-lg">Visão de longo prazo</h3>
              <p className="text-slate-600 text-sm">
                Acompanhe sua evolução financeira ao longo do tempo com mais controle.
              </p>
            </div>
          </div>
        </section>
      </main>

      <FinScopeFooter />
    </div>
  );
}
