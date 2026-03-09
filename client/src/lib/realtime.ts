import { createClient, type RealtimeChannel } from "@supabase/supabase-js";
import type { Transaction } from "@shared/schema";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("[REALTIME] SUPABASE env vars ausentes. Eventos em tempo real desativados.");
}

export const supabaseClient =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: false,
        },
      })
    : null;

export type TransactionInsertHandler = (transaction: Transaction) => void;

export function subscribeToUserTransactions(
  userId: string,
  handler: TransactionInsertHandler
): RealtimeChannel | null {
  if (!supabaseClient) return null;

  const channel = supabaseClient
    .channel(`transactions-insert-${userId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "transactions",
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        const record = payload.new as any;
        if (!record) return;
        const transaction: Transaction = {
          id: record.id,
          userId: record.user_id,
          accountId: record.account_id,
          description: record.description,
          type: record.type,
          amount: String(record.amount),
          category: record.category,
          date: record.date,
          accountType: record.account_type ?? "PF",
          autoRuleApplied: Boolean(record.auto_rule_applied),
          source: record.source ?? "manual",
          createdAt: record.created_at,
        };
        handler(transaction);
      }
    )
    .subscribe();

  return channel;
}
