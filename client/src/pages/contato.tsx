import { FinScopeHeader } from "@/components/site/FinScopeHeader";
import { FinScopeFooter } from "@/components/site/FinScopeFooter";
import { motion } from "framer-motion";

export default function ContatoPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <FinScopeHeader />

      <main className="container py-24 max-w-4xl mx-auto space-y-16">
        
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-4"
        >
          <h1 className="text-4xl font-poppins font-bold">Fale com a gente</h1>
          <p className="text-slate-600 max-w-lg mx-auto">
            Tem dúvidas, sugestões ou precisa de ajuda? Nosso time está pronto para te ouvir.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-10">
          <form className="space-y-4 p-6 border rounded-2xl shadow-sm bg-white">
            <div>
              <label className="text-sm font-medium">Seu nome</label>
              <input className="w-full border rounded-lg p-2 mt-1" />
            </div>

            <div>
              <label className="text-sm font-medium">Seu e-mail</label>
              <input className="w-full border rounded-lg p-2 mt-1" />
            </div>

            <div>
              <label className="text-sm font-medium">Mensagem</label>
              <textarea className="w-full border rounded-lg p-2 mt-1 h-32" />
            </div>

            <button className="px-4 py-2 bg-primary text-white rounded-lg shadow hover:shadow-md transition">
              Enviar Mensagem
            </button>
          </form>

          <div className="space-y-4 text-slate-700">
            <p>
              <strong>Email:</strong> contato@finscope.com
            </p>
            <p>
              <strong>Tempo médio de resposta:</strong> 6 horas úteis
            </p>
            <p>
              Estamos sempre trabalhando para melhorar sua experiência com o FinScope.
            </p>
          </div>
        </div>

      </main>

      <FinScopeFooter />
    </div>
  );
}
