import { useState } from "react";
import { FinScopeHeader } from "@/components/site/FinScopeHeader";
import { FinScopeFooter } from "@/components/site/FinScopeFooter";
import { motion } from "framer-motion";
import { apiFetch } from "@/lib/api";

export default function ContatoPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!name || !email || !message) {
      setErrorMessage("Preencha todos os campos antes de enviar.");
      setStatus("error");
      return;
    }

    setStatus("loading");
    setErrorMessage("");
    try {
      const response = await apiFetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, message }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Não foi possível enviar sua mensagem.");
      }

      setStatus("success");
      setName("");
      setEmail("");
      setMessage("");
    } catch (error) {
      setStatus("error");
      setErrorMessage((error as Error).message || "Erro inesperado ao enviar.");
    }
  }

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <FinScopeHeader />

      <main className="max-w-4xl mx-auto px-4 py-24 space-y-16">
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
          <form onSubmit={handleSubmit} className="space-y-4 p-6 border rounded-2xl shadow-sm bg-white">
            <div>
              <label className="text-sm font-medium">Seu nome</label>
              <input
                className="w-full border rounded-lg p-2 mt-1"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="text-sm font-medium">Seu e-mail</label>
              <input
                type="email"
                className="w-full border rounded-lg p-2 mt-1"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="text-sm font-medium">Mensagem</label>
              <textarea
                className="w-full border rounded-lg p-2 mt-1 h-32"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
              />
            </div>

            {status === "success" && (
              <p className="text-sm text-green-600">Mensagem enviada! Responderemos em breve.</p>
            )}
            {status === "error" && (
              <p className="text-sm text-red-600">{errorMessage || "Ocorreu um erro ao enviar sua mensagem."}</p>
            )}

            <button
              type="submit"
              disabled={status === "loading"}
              className="px-4 py-2 bg-primary text-white rounded-lg shadow hover:shadow-md transition disabled:opacity-60"
            >
              {status === "loading" ? "Enviando..." : "Enviar Mensagem"}
            </button>
          </form>

          <div className="space-y-4 text-slate-700">
            <div className="p-4 rounded-xl border bg-muted/40">
              <p className="text-sm text-muted-foreground">Email</p>
              <p className="font-semibold">contato@finscope.com.br</p>
            </div>
            <div className="p-4 rounded-xl border bg-muted/40">
              <p className="text-sm text-muted-foreground">SLA de atendimento</p>
              <p className="font-semibold">Até 6 horas úteis</p>
            </div>
            <p className="text-sm">
              Tem sugestões para novos recursos de planejamento? Fale com a gente — o roadmap do FinScope é guiado pelos clientes.
            </p>
          </div>
        </div>
      </main>

      <FinScopeFooter />
    </div>
  );
}
