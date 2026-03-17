import type { Goal, GoalContribution, InsertGoal, UpdateGoal } from "@shared/schema";

async function getSupabaseClient() {
  const module = await import("../../supabase");
  return module.supabase;
}

function mapGoal(row: any): Goal {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    targetValue: row.target_value,
    currentValue: row.current_value,
    targetDate: row.target_date ? new Date(row.target_date) : null,
    status: row.status,
    archivedAt: row.archived_at ? new Date(row.archived_at) : null,
    completedAt: row.completed_at ? new Date(row.completed_at) : null,
    metadata: row.metadata ?? null,
    createdAt: row.created_at ? new Date(row.created_at) : new Date(),
    updatedAt: row.updated_at ? new Date(row.updated_at) : new Date(),
  };
}

function mapContribution(row: any): GoalContribution {
  return {
    id: row.id,
    goalId: row.goal_id,
    userId: row.user_id,
    amount: row.amount,
    contributedAt: row.contributed_at ? new Date(row.contributed_at) : new Date(),
    note: row.note,
    createdAt: row.created_at ? new Date(row.created_at) : new Date(),
  };
}

function toNumber(value: string | number | null | undefined) {
  return Number(Number(value || 0).toFixed(2));
}

export class GoalService {
  async listGoals(userId: string, status?: "active" | "completed" | "archived") {
    const supabase = await getSupabaseClient();
    let query = supabase.from("goals").select("*").eq("user_id", userId).order("updated_at", { ascending: false });
    if (status) query = query.eq("status", status);

    const { data, error } = await query;
    if (error) throw new Error(error.message || "Nao foi possivel carregar as metas.");
    return (data || []).map(mapGoal);
  }

  async getGoal(userId: string, goalId: string) {
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase
      .from("goals")
      .select("*")
      .eq("user_id", userId)
      .eq("id", goalId)
      .maybeSingle();

    if (error) throw new Error(error.message || "Nao foi possivel carregar a meta.");
    return data ? mapGoal(data) : null;
  }

  async createGoal(userId: string, payload: InsertGoal) {
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase
      .from("goals")
      .insert({
        user_id: userId,
        title: payload.title,
        target_value: payload.targetValue,
        current_value: payload.currentValue ?? 0,
        target_date: payload.targetDate ? payload.targetDate.toISOString() : null,
        status: payload.status || "active",
        metadata: payload.metadata ?? null,
      })
      .select()
      .single();

    if (error || !data) throw new Error(error?.message || "Nao foi possivel criar a meta.");
    return mapGoal(data);
  }

  async updateGoal(userId: string, goalId: string, patch: UpdateGoal) {
    const supabase = await getSupabaseClient();
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (patch.title !== undefined) updateData.title = patch.title;
    if (patch.targetValue !== undefined) updateData.target_value = patch.targetValue;
    if (patch.currentValue !== undefined) updateData.current_value = patch.currentValue;
    if (patch.targetDate !== undefined) updateData.target_date = patch.targetDate ? patch.targetDate.toISOString() : null;
    if (patch.status !== undefined) updateData.status = patch.status;
    if (patch.archivedAt !== undefined) updateData.archived_at = patch.archivedAt ? patch.archivedAt.toISOString() : null;
    if (patch.completedAt !== undefined) updateData.completed_at = patch.completedAt ? patch.completedAt.toISOString() : null;
    if (patch.metadata !== undefined) updateData.metadata = patch.metadata;

    const { data, error } = await supabase
      .from("goals")
      .update(updateData)
      .eq("user_id", userId)
      .eq("id", goalId)
      .select()
      .single();

    if (error || !data) throw new Error(error?.message || "Nao foi possivel atualizar a meta.");
    return mapGoal(data);
  }

  async addContribution(params: {
    userId: string;
    goalId: string;
    amount: number;
    note?: string | null;
    contributedAt?: Date;
  }) {
    const supabase = await getSupabaseClient();
    const goal = await this.getGoal(params.userId, params.goalId);
    if (!goal) throw new Error("Meta nao encontrada.");

    const contributionDate = params.contributedAt || new Date();
    const { data: contributionRow, error: contributionError } = await supabase
      .from("goal_contributions")
      .insert({
        goal_id: params.goalId,
        user_id: params.userId,
        amount: params.amount,
        note: params.note ?? null,
        contributed_at: contributionDate.toISOString(),
      })
      .select()
      .single();

    if (contributionError || !contributionRow) {
      throw new Error(contributionError?.message || "Nao foi possivel registrar o aporte.");
    }

    const nextCurrentValue = toNumber(goal.currentValue) + params.amount;
    const targetValue = toNumber(goal.targetValue);
    const isCompleted = targetValue > 0 && nextCurrentValue >= targetValue;
    const updatedGoal = await this.updateGoal(params.userId, params.goalId, {
      currentValue: nextCurrentValue,
      status: isCompleted ? "completed" : (goal.status as "active" | "completed" | "archived"),
      completedAt: isCompleted ? contributionDate : goal.completedAt,
    });

    return {
      goal: updatedGoal,
      contribution: mapContribution(contributionRow),
    };
  }

  async listContributions(userId: string, goalId: string) {
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase
      .from("goal_contributions")
      .select("*")
      .eq("user_id", userId)
      .eq("goal_id", goalId)
      .order("contributed_at", { ascending: false });

    if (error) throw new Error(error.message || "Nao foi possivel carregar os aportes.");
    return (data || []).map(mapContribution);
  }

  async archiveGoal(userId: string, goalId: string) {
    return this.updateGoal(userId, goalId, { status: "archived", archivedAt: new Date() });
  }

  async completeGoal(userId: string, goalId: string) {
    return this.updateGoal(userId, goalId, { status: "completed", completedAt: new Date() });
  }

  async getLatestActiveGoal(userId: string) {
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase
      .from("goals")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "active")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(error.message || "Nao foi possivel consultar a meta ativa.");
    return data ? mapGoal(data) : null;
  }
}
