import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();
console.log("ENV CHECK:", process.env.SUPABASE_URL, process.env.SUPABASE_KEY?.slice(0, 6));

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error("Missing Supabase environment variables");
}

export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
  db: {
    schema: 'public',
  },
  global: {
    headers: {
      'Prefer': 'return=representation',
    },
  },
});
