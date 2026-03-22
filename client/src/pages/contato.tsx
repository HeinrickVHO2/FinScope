import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { FinScopeHeader } from "@/components/site/FinScopeHeader";
import { FinScopeFooter } from "@/components/site/FinScopeFooter";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const DEFAULT_SUPPORT_EMAIL = "contato@finscope.com.br";

function buildMailtoHref(email: string, name: string, senderEmail: string, message: string) {
  const subject = encodeURIComponent(`Contato FinScope - ${name || "Suporte"}`);
  const body = encodeURIComponent(
    [
      name ? `Nome: ${name}` : "",
      senderEmail ? `Email: ${senderEmail}` : "",
      "",
      message,
    ]
      .filter(Boolean)
      .join("\n"),
  );

  return `mailto:${email}?subject=${subject}&body=${body}`;
}

export default function ContatoPage() {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [fallbackEmail, setFallbackEmail] = useState(DEFAULT_SUPPORT_EMAIL);

  useEffect(() => {
    if (!user) return;
    setName((current) => current || user.fullName || "");
    setEmail((current) => current || user.email || "");
  }, [user]);

  const mailtoHref = useMemo(
    () => buildMailtoHref(fallbackEmail, name, email, message),
    [email, fallbackEmail, message, name],
  );

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
        const data = await response.json().catch(() => ({} as { error?: string; fallbackEmail?: string }));
        if (data.fallbackEmail) {
          setFallbackEmail(data.fallbackEmail);
        }
        throw new Error(data.error || "Nao foi possivel enviar sua mensagem.");
      }

      setStatus("success");
      setErrorMessage("");
      setMessage("");
    } catch (error) {
      setStatus("error");
      setErrorMessage((error as Error).message || "Erro inesperado ao enviar.");
    }
  }

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <FinScopeHeader />

      <main className="mx-auto max-w-4xl space-y-16 px-4 py-24">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4 text-center"
        >
          <h1 className="text-4xl font-poppins font-bold">Fale com a gente</h1>
          <p className="mx-auto max-w-lg text-slate-600">
            Tem duvidas, sugestoes ou precisa de ajuda? Nosso time esta pronto para te ouvir.
          </p>
        </motion.div>

        <div className="grid gap-10 md:grid-cols-2">
          <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border bg-white p-6 shadow-sm">
            <div>
              <label className="text-sm font-medium">Seu nome</label>
              <input
                className="mt-1 w-full rounded-lg border p-2"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="text-sm font-medium">Seu e-mail</label>
              <input
                type="email"
                className="mt-1 w-full rounded-lg border p-2"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="text-sm font-medium">Mensagem</label>
              <textarea
                className="mt-1 h-32 w-full rounded-lg border p-2"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
              />
            </div>

            {status === "success" && (
              <p className="text-sm text-green-600">Mensagem enviada! Vamos responder em breve.</p>
            )}

            {status === "error" && (
              <div className="space-y-3">
                <p className="text-sm text-red-600">
                  {errorMessage || "Ocorreu um erro ao enviar sua mensagem."}
                </p>
                <a href={mailtoHref}>
                  <Button type="button" variant="outline">
                    Enviar pelo seu e-mail
                  </Button>
                </a>
              </div>
            )}

            <button
              type="submit"
              disabled={status === "loading"}
              className="rounded-lg bg-primary px-4 py-2 text-white shadow transition hover:shadow-md disabled:opacity-60"
            >
              {status === "loading" ? "Enviando..." : "Enviar mensagem"}
            </button>
          </form>

          <div className="space-y-4 text-slate-700">
            <div className="rounded-xl border bg-muted/40 p-4">
              <p className="text-sm text-muted-foreground">Email</p>
              <a href={`mailto:${fallbackEmail}`} className="font-semibold hover:text-primary">
                {fallbackEmail}
              </a>
            </div>
            <div className="rounded-xl border bg-muted/40 p-4">
              <p className="text-sm text-muted-foreground">Tempo de resposta</p>
              <p className="font-semibold">Ate 6 horas uteis</p>
            </div>
            <p className="text-sm">
              Quer sugerir melhorias? Fale com a gente. O produto evolui com base no que os clientes mais precisam.
            </p>
          </div>
        </div>
      </main>

      <FinScopeFooter />
    </div>
  );
}
