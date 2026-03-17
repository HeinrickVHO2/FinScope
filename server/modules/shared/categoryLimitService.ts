import type { CategoryLimit, InsertCategoryLimit } from "@shared/schema";
import type { IStorage } from "../../storage";
import { buildFinancialSummaryPayload, type SummaryPeriodKey } from "./financialSummaryService";

async function getSupabaseClient() {
  const module = await import("../../supabase");
  return module.supabase;
}

function mapCategoryLimit(row: any): CategoryLimit {
  return {
    id: row.id,
    userId: row.user_id,
    category: row.category,
    scope: row.scope,
    period: row.period,
    amount: row.amount,
    createdAt: row.created_at ? new Date(row.created_at) : new Date(),
    updatedAt: row.updated_at ? new Date(row.updated_at) : new Date(),
  };
}

export class CategoryLimitService {
  async listByUser(userId: string) {
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase
      .from("category_limits")
      .select("*")
      .eq("user_id", userId)
      .order("category", { ascending: true });

    if (error) throw new Error(error.message || "Nao foi possivel carregar os limites.");
    return (data || []).map(mapCategoryLimit);
  }

  async upsert(userId: string, payload: InsertCategoryLimit) {
    const supabase = await getSupabaseClient();
    const { data: existing } = await supabase
      .from("category_limits")
      .select("*")
      .eq("user_id", userId)
      .eq("category", payload.category)
      .eq("scope", payload.scope)
      .eq("period", payload.period)
      .maybeSingle();

    if (existing?.id) {
      const { data, error } = await supabase
        .from("category_limits")
        .update({
          amount: payload.amount,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .select()
        .single();

      if (error || !data) throw new Error(error?.message || "Nao foi possivel atualizar o limite.");
      return mapCategoryLimit(data);
    }

    const { data, error } = await supabase
      .from("category_limits")
      .insert({
        user_id: userId,
        category: payload.category,
        scope: payload.scope,
        period: payload.period,
        amount: payload.amount,
      })
      .select()
      .single();

    if (error || !data) throw new Error(error?.message || "Nao foi possivel criar o limite.");
    return mapCategoryLimit(data);
  }

  async buildStatus(params: {
    userId: string;
    storage: IStorage;
    scope?: "PF" | "PJ" | "ALL";
    periodKey?: SummaryPeriodKey;
  }) {
    const limits = await this.listByUser(params.userId);
    const effectivePeriodKey = params.periodKey || "current_month";
    const filtered = limits.filter((item) => !params.scope || params.scope === "ALL" || item.scope === "ALL" || item.scope === params.scope);
    const payload = await buildFinancialSummaryPayload({
      storage: params.storage,
      userId: params.userId,
      scope: params.scope,
      periodKey: effectivePeriodKey,
      limits: filtered,
    });

    return payload.limits;
  }
}
