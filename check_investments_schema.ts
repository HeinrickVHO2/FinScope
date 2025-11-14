import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function checkSchema() {
  console.log("Checking investments table schema...");
  
  // Try SELECT *
  const { data, error } = await supabase
    .from("investments")
    .select("*")
    .limit(1);
  
  if (error) {
    console.error("❌ Error:", error);
  } else {
    console.log("✅ Sample investment row:", JSON.stringify(data, null, 2));
    if (data && data.length > 0) {
      console.log("📋 Columns present:", Object.keys(data[0]));
    }
  }
  
  // Try to select current_amount specifically
  const { data: amountData, error: amountError } = await supabase
    .from("investments")
    .select("current_amount")
    .limit(1);
  
  if (amountError) {
    console.error("❌ Error selecting current_amount:", amountError);
  } else {
    console.log("✅ current_amount column exists:", amountData);
  }
}

checkSchema();
