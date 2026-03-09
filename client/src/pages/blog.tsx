import { FinScopeHeader } from "@/components/site/FinScopeHeader";
import { FinScopeFooter } from "@/components/site/FinScopeFooter";
import { motion } from "framer-motion";

export default function BlogPage() {
  const posts = [
    {
      title: "Planejamento de gastos futuros na prática",
      excerpt: "Como usar o FinScope para cadastrar boletos e prever o saldo de cada semana.",
      date: "05 Fev 2025",
    },
    {
      title: "Relatórios PRO x Premium: qual escolher?",
      excerpt: "Diferenças entre o PDF simples e o premium com previsões avançadas.",
      date: "30 Jan 2025",
    },
    {
      title: "Economia recomendada: por que guardar parte do dinheiro livre?",
      excerpt: "Cálculo automático de reserva baseado na previsão de caixa.",
      date: "22 Jan 2025",
    },
  ];

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <FinScopeHeader />

      <main className="max-w-5xl mx-auto px-4 py-24">
        <h1 className="text-center text-4xl font-poppins font-bold mb-12">
          Blog FinScope
        </h1>

        <div className="grid gap-10 md:grid-cols-2">
          {posts.map((post, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="border rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow bg-white"
            >
              <p className="text-primary font-medium">{post.date}</p>
              <h3 className="text-xl font-semibold mt-2">{post.title}</h3>
              <p className="text-slate-600 text-sm mt-2">{post.excerpt}</p>

              <button className="mt-4 text-primary font-medium hover:underline">
                Ler mais →
              </button>
            </motion.div>
          ))}
        </div>
      </main>

      <FinScopeFooter />
    </div>
  );
}
