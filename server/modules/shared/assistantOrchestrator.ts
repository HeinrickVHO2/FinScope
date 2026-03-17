import type { IStorage } from "../../storage";
import { CategoryLimitService } from "./categoryLimitService";
import { buildStructuredFinancialSummary } from "./financialAssistant";
import { buildFinancialSummaryPayload, formatFinancialSummaryText, type FinancialSummaryPayload } from "./financialSummaryService";
import { GoalService } from "./goalService";
import { looksLikeAssistantOrchestratorMessage, parseAssistantRouteIntent, type SummaryIntentFocus } from "./intentRouter";
import { resolveModelForIntent, type ModelSelection } from "./modelRouter";

export type AgentUiPayload = {
  type: string;
  title?: string;
  subtitle?: string;
  chart?: Record<string, unknown>;
  cards?: Array<Record<string, unknown>>;
  progress?: Record<string, unknown>;
  limits?: Array<Record<string, unknown>>;
  route?: string;
  view?: string;
};

export type AssistantOrchestratorResult = {
  handled: boolean;
  intent?: string;
  action?: string;
  confidence?: number;
  reply?: string;
  payload?: Record<string, unknown>;
  ui_payload?: AgentUiPayload;
  model?: ModelSelection;
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

function buildGoalProgressUiPayload(goal: {
  title: string;
  currentValue: string | number | null | undefined;
  targetValue: string | number | null | undefined;
}): AgentUiPayload {
  const current = toNumber(goal.currentValue);
  const target = Math.max(1, toNumber(goal.targetValue));
  const remaining = Math.max(0, Number((target - current).toFixed(2)));
  const percentage = Number(((current / target) * 100).toFixed(2));

  return {
    type: "goal_progress",
    title: goal.title,
    route: "/goals",
    view: "goals",
    progress: {
      current,
      target,
      remaining,
      percentage,
    },
    chart: {
      type: "goal_ring",
      current,
      target,
      remaining,
      percentage,
    },
  };
}

function buildGoalsListUiPayload(goals: Array<{
  title: string;
  currentValue: string | number | null | undefined;
  targetValue: string | number | null | undefined;
}>) {
  const cards = goals.map((goal) => {
    const current = toNumber(goal.currentValue);
    const target = Math.max(1, toNumber(goal.targetValue));
    return {
      title: goal.title,
      current,
      target,
      remaining: Math.max(0, Number((target - current).toFixed(2))),
      percentage: Number(((current / target) * 100).toFixed(2)),
    };
  });

  return {
    type: "goals_list",
    title: "Metas",
    route: "/goals",
    view: "goals",
    cards,
    chart: {
      type: "goal_progress_bars",
      series: cards.slice(0, 5).map((goal) => ({
        label: goal.title,
        current: goal.current,
        target: goal.target,
        remaining: goal.remaining,
        percentage: goal.percentage,
      })),
    },
  } satisfies AgentUiPayload;
}

function buildGuidanceUiPayload(summary: Awaited<ReturnType<typeof buildStructuredFinancialSummary>>): AgentUiPayload {
  return {
    type: "financial_guidance",
    title: "Dicas financeiras",
    subtitle: summary.periodLabel,
    cards: [
      { label: "Entradas", value: summary.totalEntries },
      { label: "Saidas", value: summary.totalExits },
      { label: "Saldo", value: summary.balance },
      { label: "Reserva sugerida", value: summary.savingsSuggestion },
    ],
    chart: {
      type: "guidance",
      breakdownSeries: summary.topCategories.map((item) => ({
        label: item.category,
        value: item.amount,
        share: item.share,
      })),
      tips: summary.tips,
      alerts: summary.alerts,
    },
  };
}

function buildSummaryUiPayload(payload: FinancialSummaryPayload, focus: SummaryIntentFocus): AgentUiPayload {
  const cards = [
    { label: "Entradas", value: payload.totals.income },
    { label: "Saidas", value: payload.totals.expenses },
    { label: "Saldo", value: payload.totals.balance },
    { label: "Variacao", value: payload.comparison.expensesDelta },
  ];

  if (focus === "category_breakdown") {
    return {
      type: "expense_breakdown",
      title: "Divisao de gastos",
      subtitle: payload.period.label,
      cards,
      chart: {
        type: "pie",
        series: payload.categories.map((item) => ({
          label: item.category,
          value: item.amount,
          share: item.share,
        })),
      },
    };
  }

  if (focus === "largest_expense") {
    return {
      type: "largest_expense",
      title: "Maior gasto",
      subtitle: payload.period.label,
      cards,
      chart: {
        type: "highlight",
        item: payload.largestExpense,
      },
    };
  }

  return {
    type: "financial_summary",
    title: "Resumo financeiro",
    subtitle: payload.period.label,
    cards,
    chart: {
      type: "bar",
      series: payload.dailyExpenses,
      breakdownSeries: payload.categories.map((item) => ({
        label: item.category,
        value: item.amount,
        share: item.share,
      })),
      largestExpense: payload.largestExpense,
      increaseExplanation: payload.increaseExplanation,
    },
  };
}

function buildResponse(params: {
  intent: string;
  action: string;
  message: string;
  data?: Record<string, unknown>;
  uiPayload?: AgentUiPayload;
  model: ModelSelection;
  confidence?: number;
}): AssistantOrchestratorResult {
  return {
    handled: true,
    intent: params.intent,
    action: params.action,
    confidence: params.confidence ?? 0.94,
    reply: params.message,
    ui_payload: params.uiPayload,
    model: params.model,
    payload: {
      intent: params.intent,
      action: params.action,
      confidence: params.confidence ?? 0.94,
      message: params.message,
      data: params.data ?? {},
      ui_payload: params.uiPayload,
      model: params.model,
    },
  };
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

    const modelSelection = resolveModelForIntent(intent);

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
          return buildResponse({
            intent: "summary.top_category",
            action: "explain_top_category",
            message: "Ainda nao encontrei gastos suficientes nesse periodo para destacar uma categoria dominante.",
            data: payload as unknown as Record<string, unknown>,
            uiPayload: buildSummaryUiPayload(payload, intent.focus),
            model: modelSelection,
            confidence: 0.89,
          });
        }

        return buildResponse({
          intent: "summary.top_category",
          action: "explain_top_category",
          message: `No periodo de ${payload.period.label}, ${payload.topExpense.category} foi onde voce mais gastou: ${formatCurrency(payload.topExpense.amount)}.`,
          data: payload as unknown as Record<string, unknown>,
          uiPayload: buildSummaryUiPayload(payload, intent.focus),
          model: modelSelection,
        });
      }

      if (intent.focus === "category_breakdown") {
        const ranked = payload.categories
          .slice(0, 4)
          .map((item) => `${item.category} ${Math.round(item.share * 100)}%`)
          .join(", ");

        return buildResponse({
          intent: "summary.category_breakdown",
          action: "show_category_breakdown",
          message: ranked
            ? `Segue a divisao dos seus gastos por categoria. As maiores fatias agora sao: ${ranked}.`
            : "Ainda nao encontrei gastos suficientes no periodo para montar a divisao por categoria.",
          data: payload as unknown as Record<string, unknown>,
          uiPayload: buildSummaryUiPayload(payload, intent.focus),
          model: modelSelection,
        });
      }

      if (intent.focus === "largest_expense") {
        return buildResponse({
          intent: "summary.largest_expense",
          action: "show_largest_expense",
          message: payload.largestExpense
            ? `Seu maior gasto no periodo foi ${payload.largestExpense.description}, em ${payload.largestExpense.category}, totalizando ${formatCurrency(payload.largestExpense.amount)}.`
            : "Ainda nao encontrei um maior gasto no periodo porque nao ha saidas suficientes registradas.",
          data: payload as unknown as Record<string, unknown>,
          uiPayload: buildSummaryUiPayload(payload, intent.focus),
          model: modelSelection,
        });
      }

      if (intent.focus === "increase_reason") {
        const explanation = payload.increaseExplanation
          || (payload.comparison.expensesDelta > 0
            ? `Seus gastos subiram ${formatCurrency(payload.comparison.expensesDelta)} no periodo, mas ainda nao houve uma categoria isolada com aumento dominante.`
            : "Nao houve aumento relevante de gastos em relacao ao periodo anterior.");

        return buildResponse({
          intent: "summary.increase_reason",
          action: "explain_spending_change",
          message: explanation,
          data: payload as unknown as Record<string, unknown>,
          uiPayload: buildSummaryUiPayload(payload, "general"),
          model: modelSelection,
        });
      }

      return buildResponse({
        intent: "summary.general",
        action: "show_summary",
        message: formatFinancialSummaryText(payload, params.channel),
        data: payload as unknown as Record<string, unknown>,
        uiPayload: buildSummaryUiPayload(payload, intent.focus),
        model: modelSelection,
      });
    }

    if (intent.type === "financial_guidance") {
      const summary = await buildStructuredFinancialSummary(this.storage, params.userId, "ALL");
      const topCategory = summary.topCategories[0] || null;
      const primaryTip = summary.tips[0]
        || "Acompanhe semanalmente as categorias com maior peso para evitar concentracao no fim do mes.";
      const supportTip = summary.tips[1] || null;
      const attentionPoint = summary.alerts[0] || summary.observations[0] || null;
      const normalizedText = params.text
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();

      if (/durante a semana|na semana|dia a dia|cotidiano|rotina/.test(normalizedText)) {
        const weeklyMessage = topCategory
          ? `Para economizar mais no dia a dia, comece criando um teto semanal para ${topCategory.category}, que hoje e a categoria com maior peso da sua conta. ${primaryTip}`
          : `Para economizar mais no dia a dia, monte um teto semanal simples para gastos variaveis e revise no fim da semana o que se repetiu.`;

        const followUps = [];
        if (summary.savingsSuggestion > 0) {
          followUps.push(`Se mantiver esse ajuste, voce consegue separar perto de ${formatCurrency(summary.savingsSuggestion)} neste mes.`);
        }
        if (attentionPoint) {
          followUps.push(`Ponto de atencao: ${attentionPoint}`);
        }

        return buildResponse({
          intent: "guidance.financial",
          action: "show_financial_guidance",
          message: [weeklyMessage, ...followUps].join(" "),
          data: { summary },
          uiPayload: buildGuidanceUiPayload(summary),
          model: modelSelection,
        });
      }

      const messageParts = [
        topCategory
          ? `Hoje o maior ponto de atencao da sua conta e ${topCategory.category}, com ${formatCurrency(topCategory.amount)} no periodo.`
          : `Revise primeiro as categorias com maior peso do mes para proteger seu caixa.`,
        primaryTip,
      ];

      if (summary.savingsSuggestion > 0) {
        messageParts.push(`Mantendo esse ritmo, voce pode separar perto de ${formatCurrency(summary.savingsSuggestion)} neste mes.`);
      }

      if (attentionPoint) {
        messageParts.push(`Ponto de atencao: ${attentionPoint}`);
      }

      if (supportTip) {
        messageParts.push(`Acao extra: ${supportTip}`);
      }

      return buildResponse({
        intent: "guidance.financial",
        action: "show_financial_guidance",
        message: messageParts.join(" "),
        data: { summary },
        uiPayload: buildGuidanceUiPayload(summary),
        model: modelSelection,
      });
    }

    if (intent.type === "limits_status") {
      const statuses = await this.limitService.buildStatus({
        userId: params.userId,
        storage: this.storage,
      });

      if (!statuses.length) {
        return buildResponse({
          intent: "limits.status",
          action: "show_limits_empty_state",
          message: "Voce ainda nao definiu limites por categoria. Se quiser, posso criar algo como 'crie um limite para Transporte de 500'.",
          data: { limits: [] },
          uiPayload: {
            type: "limits_overview",
            title: "Limites de gastos",
            limits: [],
          },
          model: modelSelection,
          confidence: 0.91,
        });
      }

      const lines = ["Seus limites ativos:"];
      for (const item of statuses) {
        const percent = Math.round(item.utilization * 100);
        const statusLabel = item.status === "exceeded" ? "estourado" : item.status === "warning" ? "em alerta" : "controlado";
        lines.push(`- ${item.category}: ${formatCurrency(item.spent)} de ${formatCurrency(item.limit)} (${percent}%, ${statusLabel})`);
      }

      return buildResponse({
        intent: "limits.status",
        action: "show_limits_status",
        message: lines.join("\n"),
        data: { limits: statuses },
        uiPayload: {
          type: "limits_overview",
          title: "Limites de gastos",
          limits: statuses.map((item) => ({
            category: item.category,
            spent: item.spent,
            limit: item.limit,
            utilization: item.utilization,
            status: item.status,
          })),
        },
        model: modelSelection,
      });
    }

    if (intent.type === "upsert_limit") {
      const limit = await this.limitService.upsert(params.userId, {
        userId: params.userId,
        category: intent.category,
        amount: intent.amount,
        scope: intent.scope,
        period: "monthly",
      });

      return buildResponse({
        intent: "limits.upsert",
        action: "save_limit",
        message: `Limite salvo para ${limit.category}: ${formatCurrency(toNumber(limit.amount))} por mes.`,
        data: { limit },
        uiPayload: {
          type: "limit_saved",
          title: "Limite definido",
          cards: [{ category: limit.category, amount: toNumber(limit.amount), scope: limit.scope }],
        },
        model: modelSelection,
      });
    }

    if (intent.type === "investments_summary") {
      const summary = await this.storage.getInvestmentsSummary(params.userId);
      if (!summary.byType.length) {
        return buildResponse({
          intent: "investments.summary",
          action: "show_investments_empty_state",
          message: "Voce ainda nao tem investimentos cadastrados. Se quiser, posso te levar para a visao de investimentos.",
          data: {
            route: "/investments",
            view: "investments",
            summary,
          },
          uiPayload: {
            type: "navigation",
            title: "Investimentos",
            route: "/investments",
            view: "investments",
          },
          model: modelSelection,
          confidence: 0.9,
        });
      }

      const highlights = summary.byType
        .slice(0, 3)
        .map((item) => `${item.type}: ${formatCurrency(item.amount)}`)
        .join(", ");

      return buildResponse({
        intent: "investments.summary",
        action: "show_investments_summary",
        message: `Hoje voce tem ${formatCurrency(summary.totalInvested)} investidos. Maiores posicoes: ${highlights}.`,
        data: {
          route: "/investments",
          view: "investments",
          summary,
        },
        uiPayload: {
          type: "investment_summary",
          title: "Investimentos",
          route: "/investments",
          view: "investments",
          cards: summary.byType.slice(0, 4).map((item) => ({
            label: item.type,
            value: item.amount,
            goal: item.goal ?? null,
          })),
        },
        model: modelSelection,
      });
    }

    if (intent.type === "switch_financial_view") {
      const route = intent.view === "goals" ? "/goals" : "/investments";
      const label = intent.view === "goals" ? "Metas" : "Investimentos";
      return buildResponse({
        intent: "navigation.switch_financial_view",
        action: "navigate_financial_view",
        message: `Certo. A visao mais adequada para isso e ${label}.`,
        data: {
          route,
          view: intent.view,
        },
        uiPayload: {
          type: "navigation",
          title: label,
          route,
          view: intent.view,
        },
        model: modelSelection,
      });
    }

    if (intent.type === "create_goal") {
      const createdGoal = await this.goalService.createGoal(params.userId, {
        userId: params.userId,
        title: intent.title,
        targetValue: intent.targetValue,
        currentValue: 0,
        status: "active",
        metadata: { origin: "assistant" },
      });
      const goalResult = intent.initialContribution && intent.initialContribution > 0
        ? await this.goalService.addContribution({
            userId: params.userId,
            goalId: createdGoal.id,
            amount: intent.initialContribution,
            note: "Aporte inicial via assistente",
          })
        : null;
      const goal = goalResult?.goal ?? createdGoal;
      const progress = toNumber(goal.currentValue) / Math.max(1, toNumber(goal.targetValue));
      const initialContributionMessage = intent.initialContribution && intent.initialContribution > 0
        ? ` Ja deixei registrado que voce ja guardou ${formatCurrency(intent.initialContribution)}.`
        : "";

      return buildResponse({
        intent: "goals.create",
        action: "create_goal",
        message: `Meta criada: ${goal.title} com objetivo de ${formatCurrency(toNumber(goal.targetValue))}.${initialContributionMessage} Progresso atual: ${Math.round(progress * 100)}% (${formatCurrency(toNumber(goal.currentValue))} de ${formatCurrency(toNumber(goal.targetValue))}).`,
        data: { goal, contribution: goalResult?.contribution ?? null, route: "/goals", view: "goals" },
        uiPayload: buildGoalProgressUiPayload(goal),
        model: modelSelection,
      });
    }

    if (intent.type === "add_goal_contribution") {
      const goal = await this.goalService.getLatestActiveGoal(params.userId);
      if (!goal) {
        return buildResponse({
          intent: "goals.contribution",
          action: "reject_goal_contribution_without_goal",
          message: "Nao encontrei uma meta ativa para receber esse aporte. Primeiro crie uma meta, por exemplo: 'crie uma meta para iPhone 16, preciso de 5399'.",
          data: { route: "/goals", view: "goals" },
          uiPayload: {
            type: "navigation",
            title: "Metas",
            route: "/goals",
            view: "goals",
          },
          model: modelSelection,
          confidence: 0.9,
        });
      }

      const result = await this.goalService.addContribution({
        userId: params.userId,
        goalId: goal.id,
        amount: intent.amount,
        note: "Aporte via assistente",
      });
      const progress = toNumber(result.goal.currentValue) / Math.max(1, toNumber(result.goal.targetValue));

      return buildResponse({
        intent: "goals.contribution",
        action: "add_goal_contribution",
        message: `Aporte registrado em ${result.goal.title}: ${formatCurrency(intent.amount)}. Progresso atual: ${Math.round(progress * 100)}% (${formatCurrency(toNumber(result.goal.currentValue))} de ${formatCurrency(toNumber(result.goal.targetValue))}).`,
        data: { ...result, route: "/goals", view: "goals" },
        uiPayload: buildGoalProgressUiPayload(result.goal),
        model: modelSelection,
      });
    }

    if (intent.type === "list_goals" || intent.type === "goal_progress") {
      const goals = await this.goalService.listGoals(params.userId);
      if (!goals.length) {
        return buildResponse({
          intent: intent.type === "list_goals" ? "goals.list" : "goals.progress",
          action: "show_goals_empty_state",
          message: "Voce ainda nao tem metas cadastradas.",
          data: { goals: [], route: "/goals", view: "goals" },
          uiPayload: {
            type: "goals_list",
            title: "Metas",
            route: "/goals",
            view: "goals",
            cards: [],
          },
          model: modelSelection,
          confidence: 0.91,
        });
      }

      const lines = ["Suas metas:"];
      for (const goal of goals.slice(0, 5)) {
        const progress = Math.round((toNumber(goal.currentValue) / Math.max(1, toNumber(goal.targetValue))) * 100);
        lines.push(`- ${goal.title}: ${formatCurrency(toNumber(goal.currentValue))} de ${formatCurrency(toNumber(goal.targetValue))} (${progress}%)`);
      }

      return buildResponse({
        intent: intent.type === "list_goals" ? "goals.list" : "goals.progress",
        action: "show_goals",
        message: lines.join("\n"),
        data: { goals, route: "/goals", view: "goals" },
        uiPayload: buildGoalsListUiPayload(goals),
        model: modelSelection,
      });
    }

    if (intent.type === "create_payable") {
      const expense = await this.storage.createFutureExpense({
        userId: params.userId,
        title: intent.title,
        category: "Contas Fixas",
        amount: intent.amount,
        dueDate: intent.dueDate,
        accountType: intent.accountType,
        isRecurring: false,
        recurrenceType: null,
        status: "pending",
      });

      return buildResponse({
        intent: "payables.create",
        action: "create_payable",
        message: `Conta a pagar criada: ${expense.title} com vencimento em ${expense.dueDate.toLocaleDateString("pt-BR")} no valor de ${formatCurrency(toNumber(expense.amount))}.`,
        data: { payable: expense, route: "/future-expenses" },
        uiPayload: {
          type: "reminder_created",
          title: expense.title,
          route: "/future-expenses",
          cards: [{
            amount: intent.amount,
            dueDate: expense.dueDate,
            status: expense.status,
            accountType: expense.accountType,
            recurrenceType: null,
          }],
        },
        model: modelSelection,
      });
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

      return buildResponse({
        intent: "reminders.create",
        action: "create_reminder",
        message: intent.amount > 0
          ? `Lembrete criado para ${expense.title}: ${formatCurrency(intent.amount)} todo dia ${intent.dayOfMonth}.`
          : `Lembrete criado para ${expense.title} todo dia ${intent.dayOfMonth}.`,
        data: { reminder: expense },
        uiPayload: {
          type: "reminder_created",
          title: expense.title,
          cards: [{
            amount: intent.amount,
            dayOfMonth: intent.dayOfMonth,
            recurrenceType: "monthly",
          }],
        },
        model: modelSelection,
      });
    }

    if (intent.type === "mark_reminder_paid") {
      const reminders = await this.storage.getFutureExpenses(params.userId, "ALL");
      const candidate = [...reminders]
        .filter((item) => item.status !== "paid")
        .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())[0];
      if (!candidate) {
        return buildResponse({
          intent: "reminders.mark_paid",
          action: "show_no_recent_reminder",
          message: "Nao encontrei nenhuma conta pendente recente para marcar como paga.",
          data: {},
          model: modelSelection,
          confidence: 0.9,
        });
      }

      const updated = await this.storage.updateFutureExpenseStatus(candidate.id, params.userId, "paid");
      return buildResponse({
        intent: "reminders.mark_paid",
        action: "mark_reminder_paid",
        message: updated ? `Perfeito. Marquei ${updated.title} como paga.` : "Nao consegui atualizar essa conta agora.",
        data: { reminder: updated },
        uiPayload: updated
          ? {
              type: "reminder_paid",
              title: updated.title,
              cards: [{ status: "paid" }],
            }
          : undefined,
        model: modelSelection,
        confidence: updated ? 0.95 : 0.82,
      });
    }

    return { handled: false };
  }
}
