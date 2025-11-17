import { FinScopeHeader } from "@/components/site/FinScopeHeader";
import { FinScopeFooter } from "@/components/site/FinScopeFooter";
import { motion } from "framer-motion";
import { BarChart3, Wallet, Shield, Zap, TrendingUp } from "lucide-react";

export default function RecursosPage() {
  const recursos = [
    {
      icon: BarChart3,
      title: "Dashboard Inteligente",
      description:
        "Visualização completa das suas finanças com gráficos avançados e insights automáticos.",
    },
    {
      icon: Wallet,
      title: "Gestão de Contas",
      description:
        "Controle contas pessoais, contas empresariais e cartões em um só lugar.",
    },
    {
      icon: Shield,
      title: "Segurança AppSec",
      description:
        "Arquitetado com padrões de segurança e criptografia de nível corporativo.",
    },
    {
      icon: Zap,
      title: "Regras Automáticas",
      description:
        "Categorização automática e inteligente para economizar horas do seu mês.",
    },
    {
      icon: TrendingUp,
      title: "Gestão MEI Completa",
      description:
        "Separação total entre vida pessoal e CNPJ, com fluxo de caixa próprio.",
    },
  ];

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <FinScopeHeader />

      <main className="container py-24 max-w-6xl mx-auto space-y-16">

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
