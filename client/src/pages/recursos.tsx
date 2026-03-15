import { FinScopeHeader } from "@/components/site/FinScopeHeader";
import { FinScopeFooter } from "@/components/site/FinScopeFooter";
import { motion } from "framer-motion";
import { BarChart3, Wallet, Shield, Zap, TrendingUp, CalendarClock, FileText } from "lucide-react";

export default function RecursosPage() {
  const recursos = [
    {
      icon: BarChart3,
      title: "Painel do mês",
      description:
        "Veja entradas, saídas e saldo em um único lugar para acompanhar sua rotina com clareza.",
    },
    {
      icon: Wallet,
      title: "Controle pessoal e do negócio",
      description:
        "Organize suas contas sem misturar contextos e acompanhe melhor cada decisão.",
    },
    {
      icon: CalendarClock,
      title: "Planejamento de contas",
      description:
        "Registre vencimentos e compromissos para se preparar antes do aperto.",
    },
    {
      icon: Zap,
      title: "Lembretes importantes",
      description:
        "Receba avisos para não esquecer contas e manter o mês sob controle.",
    },
    {
      icon: TrendingUp,
      title: "Visão do que sobra",
      description:
        "Acompanhe quanto ainda está disponível para planejar melhor seus próximos passos.",
    },
    {
      icon: FileText,
      title: "Relatórios para acompanhar",
      description:
        "Use relatórios para revisar seu mês e entender sua evolução.",
    },
    {
      icon: Shield,
      title: "Privacidade e segurança",
      description:
        "Seus dados são tratados com cuidado para você usar o FinScope com tranquilidade.",
    },
  ];

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <FinScopeHeader />

      <main className="max-w-6xl mx-auto px-4 py-24 space-y-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-4"
        >
          <h1 className="text-4xl font-poppins font-bold">
            Recursos para organizar sua vida financeira
          </h1>
          <p className="text-slate-600 max-w-2xl mx-auto">
            O FinScope foi feito para você acompanhar seu dinheiro com mais clareza, controle e tranquilidade.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-10">
          {recursos.map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="p-6 rounded-2xl border shadow-sm hover:shadow-md transition-shadow bg-white"
            >
              <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center">
                <item.icon className="text-primary h-7 w-7" />
              </div>
              <h3 className="mt-4 font-semibold text-lg">{item.title}</h3>
              <p className="text-slate-600 text-sm mt-2">{item.description}</p>
            </motion.div>
          ))}
        </div>
      </main>

      <FinScopeFooter />
    </div>
  );
}
