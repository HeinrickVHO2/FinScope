import { CheckCircle2, Circle, ShieldCheck } from "lucide-react";
import {
  RECOMMENDED_PASSWORD_LENGTH,
  validatePasswordStrength,
  type PasswordUserContext,
} from "@shared/password-policy";
import { cn } from "@/lib/utils";

type PasswordStrengthChecklistProps = {
  password: string;
  userContext?: PasswordUserContext;
  className?: string;
};

const strengthStyle: Record<ReturnType<typeof validatePasswordStrength>["label"], { label: string; color: string; bar: string }> = {
  weak: {
    label: "Fraca",
    color: "text-red-600",
    bar: "bg-red-500",
  },
  fair: {
    label: "Média",
    color: "text-amber-600",
    bar: "bg-amber-500",
  },
  good: {
    label: "Boa",
    color: "text-sky-600",
    bar: "bg-sky-500",
  },
  strong: {
    label: "Forte",
    color: "text-emerald-600",
    bar: "bg-emerald-500",
  },
};

const strengthMessage: Record<ReturnType<typeof validatePasswordStrength>["label"], string> = {
  weak: "Sua senha ainda está fraca. Continue ajustando os critérios abaixo.",
  fair: `A senha já melhorou. Se puder, chegue a ${RECOMMENDED_PASSWORD_LENGTH}+ caracteres.`,
  good: "Boa base. Um pouco mais de comprimento deixa a senha ainda mais resistente.",
  strong: "Senha segura para continuar.",
};

export function PasswordStrengthChecklist({
  password,
  userContext,
  className,
}: PasswordStrengthChecklistProps) {
  const result = validatePasswordStrength(password, userContext);
  const style = strengthStyle[result.label];
  const progress = password ? Math.max(16, Math.round((result.score / 6) * 100)) : 0;

  return (
    <div className={cn("space-y-3 rounded-lg border bg-muted/20 p-4", className)}>
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
            <span>Força da senha</span>
          </div>
          <span className={cn("text-sm font-semibold", style.color)}>{style.label}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-border">
          <div
            className={cn("h-full rounded-full transition-all duration-300", style.bar)}
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-sm text-muted-foreground">{strengthMessage[result.label]}</p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {result.requirements.map((requirement) => (
          <div
            key={requirement.key}
            className={cn(
              "flex items-center gap-2 text-sm",
              requirement.met ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {requirement.met ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            ) : (
              <Circle className="h-4 w-4" />
            )}
            <span>{requirement.label}</span>
          </div>
        ))}
      </div>

      {result.errors.length > 0 && (
        <p className="text-sm text-muted-foreground">{result.errors[0]}</p>
      )}
    </div>
  );
}
