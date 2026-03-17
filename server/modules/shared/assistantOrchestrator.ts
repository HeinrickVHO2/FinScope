import type { IStorage } from "../../storage";
import { CategoryLimitService } from "./categoryLimitService";
import { buildFinancialSummaryPayload, formatFinancialSummaryText } from "./financialSummaryService";
import { GoalService } from "./goalService";
import { looksLikeAssistantOrchestratorMessage, parseAssistantRouteIntent } from "./intentRouter";

export type AssistantOrchestratorResult = {
  handled: boolean;
  reply?: string;
  payload?: Record<string, unknown>;
};

function formatCurrency(value: number) {
  return `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function toNumber(value: string | number | null | undefined) {
  return Number(Number(value || 0).toFixed(2));
}

function resolveNextDueDate(dayOfMonth: number, reference = new Date()) {
  const candidate = new Date(reference.getFullYear(), reference.getMonth(), dayOfMonth);
  if (candidate <= reference) {
    return new Date(reference.getFullYear(), reference.getMonth() + 1, dayOfMonth);
  }
  return candidate;
}

export class AssistantOrchestrator {
  private readonly goalService = new GoalService();
  private readonly limitService = new CategoryLimitService();

  constructor(private readonly storage: IStorage) {}

  canHandle(text: string) {
    return looksLikeAssistantOrchestratorMessage(text);
  }

  async handleMessage(params: {
    userId: string;
    text: string;
    channel: "whatsapp" | "internal_chat";
  }): Promise<AssistantOrchestratorResult> {
    const intent = parseAssistantRouteIntent(params.text);
    if (!intent) return { handled: false };

    if (intent.type === "summary") {
      const limits = await this.limitService.listByUser(params.userId).catch(() => []);
      const payload = await buildFinancialSummaryPayload({
        storage: this.storage,
        userId: params.userId,
        periodKey: intent.periodKey,
        limits,
      });

      if (intent.focus === "top_category") {
        if (!payload.topExpense) {
          return {
            handled: true,
            reply: "Ainda nao encontrei gastos suficientes nesse periodo para destacar uma categoria dominante.",
            payload,
          };
        }
        return {
          handled: true,
          reply: `No periodo de ${payload.period.label}, ${payload.topExpense.category} foi onde voce mais gastou: ${formatCurrency(payload.topExpense.amount)}.`,
          payload,
        };
      }

      return {
        handled: true,
        reply: formatFinancialSummaryText(payload, params.channel),
        payload,
      };
    }

    if (intent.type === "limits_status") {
      const statuses = await this.limitService.buildStatus({
        userId: params.userId,
        storage: this.storage,
      });

      if (!statuses.length) {
        return {
          handled: true,
          reply: "Voce ainda nao definiu limites por categoria. Se quiser, posso criar algo como 'crie um limite para Transporte de 500'.",
        };
      }

      const lines = ["Seus limites ativos:"];
      for (const item of statuses) {
        const percent = Math.round(item.utilization * 100);
        const statusLabel = item.status === "exceeded" ? "estourado" : item.status === "warning" ? "em alerta" : "controlado";
        lines.push(`- ${item.category}: ${formatCurrency(item.spent)} de ${formatCurrency(item.limit)} (${percent}%, ${statusLabel})`);
      }
      return {
        handled: true,
        reply: lines.join("\n"),
        payload: { limits: statuses },
      };
    }

    if (intent.type === "upsert_limit") {
      const limit = await this.limitService.upsert(params.userId, {
        userId: params.userId,
        category: intent.category,
        amount: intent.amount,
        scope: intent.scope,
        period: "monthly",
      });
      return {
        handled: true,
        reply: `Limite salvo para ${limit.category}: ${formatCurrency(toNumber(limit.amount))} por mes.`,
        payload: { limit },
      };
    }

    if (intent.type === "investments_summary") {
      const summary = await this.storage.getInvestmentsSummary(params.userId);
      if (!summary.byType.length) {
        return {
          handled: true,
          reply: "Voce ainda nao tem investimentos cadastrados. Se quiser, posso te levar para a visao de investimentos.",
          payload: {
            route: "/investments",
            view: "investments",
            summary,
          },
        };
      }

      const highlights = summary.byType
        .slice(0, 3)
        .map((item) => `${item.type}: ${formatCurrency(item.amount)}`)
        .join(", ");

      return {
        handled: true,
        reply: `Hoje voce tem ${formatCurrency(summary.totalInvested)} investidos. Maiores posicoes: ${highlights}.`,
        payload: {
          route: "/investments",
          view: "investments",
          summary,
        },
      };
    }

    if (intent.type === "switch_financial_view") {
      const route = intent.view === "goals" ? "/goals" : "/investments";
      const label = intent.view === "goals" ? "Metas" : "Investimentos";
      return {
        handled: true,
        reply: `Certo. A visao mais adequada para isso e ${label}.`,
        payload: {
          route,
          view: intent.view,
        },
      };
    }

    if (intent.type === "create_goal") {
      const goal = await this.goalService.createGoal(params.userId, {
        userId: params.userId,
        title: intent.title,
        targetValue: intent.targetValue,
        currentValue: 0,
        status: "active",
        metadata: { origin: "assistant" },
      });
      return {
        handled: true,
        reply: `Meta criada: ${goal.title} com objetivo de ${formatCurrency(toNumber(goal.targetValue))}. Quando quiser, me diga algo como 'ja guardei 500 hoje'.`,
        payload: { goal, route: "/goals", view: "goals" },
      };
    }

    if (intent.type === "add_goal_contribution") {
      const goal = await this.goalService.getLatestActiveGoal(params.userId);
      if (!goal) {
        return {
          handled: true,
          reply: "Nao encontrei uma meta ativa para receber esse aporte. Primeiro crie uma meta, por exemplo: 'crie uma meta para iPhone 16, preciso de 5399'.",
        };
      }

      const result = await this.goalService.addContribution({
        userId: params.userId,
        goalId: goal.id,
        amount: intent.amount,
        note: "Aporte via assistente",
      });
      const progress = toNumber(result.goal.currentValue) / Math.max(1, toNumber(result.goal.targetValue));
      return {
        handled: true,
        reply: `Aporte registrado em ${result.goal.title}: ${formatCurrency(intent.amount)}. Progresso atual: ${Math.round(progress * 100)}% (${formatCurrency(toNumber(result.goal.currentValue))} de ${formatCurrency(toNumber(result.goal.targetValue))}).`,
        payload: { ...result, route: "/goals", view: "goals" },
      };
    }

    if (intent.type === "list_goals" || intent.type === "goal_progress") {
      const goals = await this.goalService.listGoals(params.userId);
      if (!goals.length) {
        return {
          handled: true,
          reply: "Voce ainda nao tem metas cadastradas.",
          payload: { goals: [], route: "/goals", view: "goals" },
        };
      }

      const lines = ["Suas metas:"];
      for (const goal of goals.slice(0, 5)) {
        const progress = Math.round((toNumber(goal.currentValue) / Math.max(1, toNumber(goal.targetValue))) * 100);
        lines.push(`- ${goal.title}: ${formatCurrency(toNumber(goal.currentValue))} de ${formatCurrency(toNumber(goal.targetValue))} (${progress}%)`);
      }
      return {
        handled: true,
        reply: lines.join("\n"),
        payload: { goals, route: "/goals", view: "goals" },
      };
    }

    if (intent.type === "create_reminder") {
      const expense = await this.storage.createFutureExpense({
        userId: params.userId,
        title: intent.title,
        category: "Contas Fixas",
        amount: intent.amount,
        dueDate: resolveNextDueDate(intent.dayOfMonth),
        accountType: "PF",
        isRecurring: true,
        recurrenceType: "monthly",
        status: "pending",
      });

      return {
        handled: true,
        reply: `Lembrete criado para ${expense.title}: ${formatCurrency(intent.amount)} todo dia ${intent.dayOfMonth}.`,
        payload: { reminder: expense },
      };
    }

    if (intent.type === "mark_reminder_paid") {
      const reminders = await this.storage.getFutureExpenses(params.userId, "ALL", "pending");
      const candidate = [...reminders].sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())[0];
      if (!candidate) {
        return {
          handled: true,
          reply: "Nao encontrei nenhuma conta pendente recente para marcar como paga.",
        };
      }

      const updated = await this.storage.updateFutureExpenseStatus(candidate.id, params.userId, "paid");
      return {
        handled: true,
        reply: updated ? `Perfeito. Marquei ${updated.title} como paga.` : "Nao consegui atualizar essa conta agora.",
        payload: { reminder: updated },
      };
    }

    return { handled: false };
  }
}
