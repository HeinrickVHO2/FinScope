import { useEffect, useMemo, useState } from "react";
import { FormAlert } from "@/components/ui/FormAlert";
import { PasswordInput } from "@/components/auth/password-input";
import { PasswordStrengthChecklist } from "@/components/auth/password-strength-checklist";
import { validatePasswordStrength, type PasswordUserContext } from "@shared/password-policy";
import { apiFetch } from "@/lib/api";

export default function ResetPasswordPage() {
  const [status, setStatus] = useState<"checking" | "invalid" | "valid">("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [passwordContext, setPasswordContext] = useState<PasswordUserContext>({});

  const token = new URLSearchParams(window.location.search).get("token");
  const passwordValidation = useMemo(
    () => validatePasswordStrength(password, passwordContext),
    [password, passwordContext],
  );

  useEffect(() => {
    async function validate() {
      if (!token) {
        setStatus("invalid");
        setErrorMsg("Token inválido.");
        return;
      }

      try {
        const res = await apiFetch(`/api/auth/reset-password/validate?token=${token}`);
        const data = await res.json();

        if (res.ok && data.valid) {
          setPasswordContext(data.passwordContext || {});
          setStatus("valid");
          return;
        }

        setStatus("invalid");
        setErrorMsg(data.error || "Token inválido ou expirado.");
      } catch {
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

    if (!passwordValidation.isValid) {
      setErrorMsg(passwordValidation.errors[0] || "Sua senha ainda não atende aos critérios mínimos.");
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await apiFetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password, confirmPassword: confirm }),
      });

      const payload = await res.json();

      if (!res.ok) {
        setErrorMsg(payload.error || "Erro ao redefinir senha.");
        return;
      }

      setSuccessMsg("Senha alterada com sucesso. Redirecionando para o login...");

      setTimeout(() => {
        window.location.href = "/login";
      }, 1500);
    } catch {
      setErrorMsg("Erro ao redefinir senha.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f1f5f9] px-4">
      <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-8 shadow-xl">
        <h1 className="mb-2 text-2xl font-bold text-center text-gray-800">
          Redefinir senha
        </h1>
        <p className="mb-6 text-center text-sm text-gray-500">
          Crie uma nova senha forte para proteger sua conta.
        </p>

        {status === "checking" && (
          <p className="text-center text-gray-600">Validando link...</p>
        )}

        {status === "invalid" && <FormAlert type="error" message={errorMsg} />}

        {status === "valid" && (
          <div className="space-y-4">
            {errorMsg && <FormAlert type="error" message={errorMsg} />}
            {successMsg && <FormAlert type="success" message={successMsg} />}

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                Nova senha
              </label>
              <PasswordInput
                className="focus:ring-[#0066CC]"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Digite sua nova senha"
              />
            </div>

            <PasswordStrengthChecklist password={password} userContext={passwordContext} />

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                Confirmar senha
              </label>
              <PasswordInput
                className="focus:ring-[#0066CC]"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                placeholder="Repita a nova senha"
              />
            </div>

            <button
              onClick={submit}
              disabled={isSubmitting}
              className="w-full rounded-lg py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
              style={{ backgroundColor: "#0066CC" }}
            >
              {isSubmitting ? "Salvando..." : "Salvar nova senha"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
