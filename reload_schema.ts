import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function reloadSchema() {
  console.log("🔄 Calling reload_postgrest_schema()...");
  
  const { data, error } = await supabase.rpc('reload_postgrest_schema');
  
  if (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
  
  console.log("✅ PostgREST schema cache reloaded successfully!");
  console.log("📊 Data:", data);
}

reloadSchema();
