import type { AssistantRouteIntent } from "./intentRouter";

export type ModelTaskType =
  | "simple_transaction"
  | "summary"
  | "insight"
  | "goal"
  | "reminder"
  | "limit"
  | "investment"
  | "general_chat";

export type ModelSelection = {
  taskType: ModelTaskType;
  tier: "light" | "advanced";
  model: string;
  reason: string;
};

function lightModel() {
  return process.env.OPENAI_LIGHT_MODEL || process.env.WHATSAPP_OCR_OPENAI_MODEL || "gpt-4o-mini";
}

function advancedModel() {
  return process.env.OPENAI_ADVANCED_MODEL || process.env.OPENAI_MODEL || "gpt-4o";
}

export function resolveModel(taskType: ModelTaskType, context?: { ambiguous?: boolean; requiresNarrative?: boolean }): ModelSelection {
  const shouldEscalate = Boolean(context?.ambiguous || context?.requiresNarrative);

  if (taskType === "simple_transaction" && !shouldEscalate) {
    return {
      taskType,
      tier: "light",
      model: lightModel(),
      reason: "Transacao simples, previsivel e de baixa ambiguidade.",
    };
  }

  if (taskType === "reminder" && !shouldEscalate) {
    return {
      taskType,
      tier: "light",
      model: lightModel(),
      reason: "Lembrete simples com estrutura deterministica.",
    };
  }

  if (taskType === "limit" && !shouldEscalate) {
    return {
      taskType,
      tier: "light",
      model: lightModel(),
      reason: "Operacao objetiva de limite por categoria.",
    };
  }

  return {
    taskType,
    tier: "advanced",
    model: advancedModel(),
    reason: shouldEscalate
      ? "Escalonado por ambiguidade ou necessidade de explicacao contextual."
      : "Tarefa exige mais contexto, explicacao ou sintese financeira.",
  };
}

export function resolveModelForIntent(intent: AssistantRouteIntent): ModelSelection {
  if (intent.type === "summary") {
    return resolveModel(intent.focus === "general" ? "summary" : "insight", {
      requiresNarrative: intent.focus !== "general",
    });
  }

  if (intent.type === "financial_guidance") {
    return resolveModel("insight", { requiresNarrative: true });
  }

  if (intent.type === "create_goal" || intent.type === "add_goal_contribution" || intent.type === "list_goals" || intent.type === "goal_progress") {
    return resolveModel("goal", { requiresNarrative: true });
  }

  if (intent.type === "create_reminder" || intent.type === "mark_reminder_paid") {
    return resolveModel("reminder");
  }

  if (intent.type === "upsert_limit" || intent.type === "limits_status") {
    return resolveModel(intent.type === "upsert_limit" ? "limit" : "insight", {
      requiresNarrative: intent.type === "limits_status",
    });
  }

  if (intent.type === "investments_summary" || intent.type === "switch_financial_view") {
    return resolveModel("investment", { requiresNarrative: intent.type === "investments_summary" });
  }

  return resolveModel("general_chat", { requiresNarrative: true });
}

export function resolveModelForText(text: string): ModelSelection {
  const normalized = text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

  const simplePatterns = [
    /^[a-z\s]+\s+\d+(?:[.,]\d{1,2})?$/,
    /^(gastei|paguei|recebi|ganhei)\b.+\d/,
    /^boleto .+ dia \d{1,2}.+\d/,
  ];

  if (simplePatterns.some((pattern) => pattern.test(normalized))) {
    return resolveModel("simple_transaction");
  }

  if (/quanto eu gastei|por que|o que mudou|divisao|grafico|limites|meta|investimentos/.test(normalized)) {
    return resolveModel("insight", { requiresNarrative: true });
  }

  return resolveModel("general_chat", {
    ambiguous: normalized.split(" ").length > 10,
    requiresNarrative: /\?/.test(normalized),
  });
}
