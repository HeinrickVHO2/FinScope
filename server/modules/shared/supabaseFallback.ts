import { supabase } from "../../supabase";

type Filter = {
  column: string;
  value: unknown;
  operator?: "eq" | "is";
};

type InsertOptions = {
  select?: boolean;
  single?: boolean;
};

const describePayload = (payload: Record<string, unknown>) => Object.keys(payload).sort().join(", ");

function applyFilters(query: any, filters: Filter[]) {
  return filters.reduce((current, filter) => {
    if (filter.operator === "is") {
      return current.is(filter.column, filter.value);
    }
    return current.eq(filter.column, filter.value);
  }, query);
}

export async function insertFirstSuccessful(
  table: string,
  payloadVariants: Array<Record<string, unknown>>,
  options: InsertOptions = {},
) {
  const select = options.select ?? true;
  const single = options.single ?? true;
  const failures: string[] = [];

  for (const payload of payloadVariants) {
    let query: any = supabase.from(table).insert(payload);
    if (select) {
      query = query.select("*");
      if (single) {
        query = query.single();
      }
    }

    const { data, error } = await query;
    if (!error) {
      return data;
    }

    failures.push(`${describePayload(payload)} => ${error.message}`);
  }

  throw new Error(`Falha ao inserir em ${table}: ${failures.join(" | ")}`);
}

export async function selectFirstMatch(
  table: string,
  filterGroups: Filter[][],
  orderBy?: { column: string; ascending?: boolean },
) {
  const failures: string[] = [];

  for (const filters of filterGroups) {
    let query: any = supabase.from(table).select("*");
    query = applyFilters(query, filters);
    if (orderBy) {
      query = query.order(orderBy.column, { ascending: orderBy.ascending ?? false });
    }

    const { data, error } = await query.limit(1);
    if (!error && data?.length) {
      return data[0];
    }

    if (error) {
      failures.push(error.message);
    }
  }

  if (failures.length) {
    throw new Error(`Falha ao consultar ${table}: ${failures.join(" | ")}`);
  }

  return null;
}
