import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function checkTypes() {
  console.log("Checking existing investment types...");
  
  const { data, error } = await supabase
    .from("investments")
    .select("type");
  
  if (error) {
    console.error("❌ Error:", error);
    return;
  }
  
  const uniqueTypes = [...new Set(data.map((inv: any) => inv.type))];
  console.log("📊 Unique types found:", uniqueTypes);
  console.log("\nSQL to use:");
  console.log(`ALTER TABLE investments DROP CONSTRAINT IF EXISTS investments_type_check;`);
  console.log(`ALTER TABLE investments ADD CONSTRAINT investments_type_check CHECK (type IN (${uniqueTypes.map(t => `'${t}'`).join(', ')}));`);
  console.log(`SELECT reload_postgrest_schema();`);
}

checkTypes();
