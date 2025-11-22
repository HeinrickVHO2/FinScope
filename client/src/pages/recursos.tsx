import { FinScopeHeader } from "@/components/site/FinScopeHeader";
import { FinScopeFooter } from "@/components/site/FinScopeFooter";
import { motion } from "framer-motion";
import { BarChart3, Wallet, Shield, Zap, TrendingUp, CalendarClock, FileText } from "lucide-react";

export default function RecursosPage() {
  const recursos = [
    {
      icon: BarChart3,
      title: "Dashboard com Previsões",
      description:
        "Saldo atual, histórico e projeções de caixa lado a lado para você decidir com antecedência.",
    },
    {
      icon: Wallet,
      title: "Contas PF e PJ integradas",
      description:
        "Controle o que já gastou e planeje o que vai gastar em contas pessoais ou empresariais.",
    },
    {
      icon: CalendarClock,
      title: "Planejamento de gastos futuros",
      description:
        "Cadastre boletos, assinaturas e impostos, receba lembretes e veja o impacto no saldo previsto.",
    },
    {
      icon: Zap,
      title: "Automação e alertas",
      description:
        "Regras inteligentes categorizam transações automaticamente e avisam sobre vencimentos.",
    },
    {
      icon: TrendingUp,
      title: "Previsão de saldo livre",
      description:
        "Mostramos quanto dinheiro vai sobrar depois de pagar as contas e quanto é ideal reservar.",
    },
    {
      icon: FileText,
      title: "Relatórios e PDFs",
      description:
        "Exporte relatórios PRO e Premium com comparativo entre despesas reais e previstas.",
    },
    {
      icon: Shield,
      title: "Segurança plena",
      description:
        "Backups, criptografia e isolamento de dados para você confiar seus números ao FinScope.",
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
            Todos os recursos para dominar suas finanças
          </h1>
          <p className="text-slate-600 max-w-2xl mx-auto">
            O FinScope entrega tecnologia, automação e simplicidade para você ter
            controle total do seu dinheiro — pessoal e empresarial.
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
