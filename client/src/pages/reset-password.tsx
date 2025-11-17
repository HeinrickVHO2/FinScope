import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { FormAlert } from "@/components/ui/FormAlert";

export default function ResetPasswordPage() {
  const [, navigate] = useLocation();

  const [status, setStatus] = useState<"checking" | "invalid" | "valid">("checking");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const token = new URLSearchParams(window.location.search).get("token");

  useEffect(() => {
    async function validate() {
      if (!token) {
        setStatus("invalid");
        setErrorMsg("Token inválido.");
        return;
      }

      try {
        const res = await fetch(`/api/auth/reset-password/validate?token=${token}`);
        const data = await res.json();

        if (res.ok && data.valid) {
          setStatus("valid");
        } else {
          setStatus("invalid");
          setErrorMsg("Token inválido ou expirado.");
        }
      } catch (err) {
        setStatus("invalid");
        setErrorMsg("Erro ao validar token.");
      }
    }

    validate();
  }, [token]);

  async function submit() {
    setErrorMsg("");
    setSuccessMsg("");

    if (password !== confirm) {
      setErrorMsg("As senhas não coincidem.");
      return;
    }

    if (password.length < 8) {
      setErrorMsg("A senha deve ter pelo menos 8 caracteres.");
      return;
    }

    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password, confirmPassword: confirm }),
    });

    const j = await res.json();

    if (!res.ok) {
      setErrorMsg(j.error || "Erro ao redefinir senha.");
      return;
    }

    setSuccessMsg("Senha alterada com sucesso! Redirecionando...");

    setTimeout(() => {
      window.location.href = "/login";
    }, 1500);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f1f5f9] px-4">
      <div className="w-full max-w-md p-8 bg-white shadow-xl rounded-xl border border-gray-200">
        <div className="flex justify-center mb-6">
</div>

        <h1 className="text-2xl font-bold text-center mb-6 text-gray-800">
          Redefinir senha
        </h1>

        {status === "checking" && (
          <p className="text-center text-gray-600">Validando link...</p>
        )}

        {status === "invalid" && (
          <FormAlert type="error" message={errorMsg} />
        )}

        {status === "valid" && (
          <>
            {errorMsg && <FormAlert type="error" message={errorMsg} />}
            {successMsg && <FormAlert type="success" message={successMsg} />}

            <div className="mb-4">
              <label className="font-medium text-gray-700 text-sm">
                Nova senha
              </label>
              <input
                type="password"
                className="w-full border rounded-lg px-3 py-2 mt-1 focus:ring-2 focus:ring-[#0066CC]"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <div className="mb-6">
              <label className="font-medium text-gray-700 text-sm">
                Confirmar senha
              </label>
              <input
                type="password"
                className="w-full border rounded-lg px-3 py-2 mt-1 focus:ring-2 focus:ring-[#0066CC]"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </div>

            <button
              onClick={submit}
              className="w-full py-3 text-white font-semibold rounded-lg"
              style={{ backgroundColor: "#0066CC" }}
            >
              Salvar nova senha
            </button>
          </>
        )}

      </div>
    </div>
  );
}
