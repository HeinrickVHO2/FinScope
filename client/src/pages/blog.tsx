import { FinScopeHeader } from "@/components/site/FinScopeHeader";
import { FinScopeFooter } from "@/components/site/FinScopeFooter";
import { motion } from "framer-motion";

export default function BlogPage() {
  const posts = [
    {
      title: "Como organizar suas finanças em 2025",
      excerpt: "Um guia prático para começar o ano com controle financeiro total.",
      date: "10 Jan 2025",
    },
    {
      title: "PF vs MEI: separação financeira sem dor de cabeça",
      excerpt:
        "Como separar vida pessoal e negócio sem bagunçar seu fluxo de caixa.",
      date: "02 Jan 2025",
    },
  ];

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <FinScopeHeader />

      <main className="container py-24 max-w-5xl mx-auto">
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
