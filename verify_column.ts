import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function verifyColumn() {
  console.log("Checking if user_id column exists in investment_transactions...");
  
  // Try to query the table directly via SQL
  const { data, error } = await supabase
    .from("investment_transactions")
    .select("user_id")
    .limit(1);
  
  if (error) {
    console.error("❌ Error querying investment_transactions:", error);
    console.log("\nTrying to SELECT via alternative method...");
    
    // Try another approach - select all columns
    const { data: allData, error: allError } = await supabase
      .from("investment_transactions")
      .select("*")
      .limit(1);
    
    if (allError) {
      console.error("❌ Error with SELECT *:", allError);
    } else {
      console.log("✅ SELECT * worked! Sample row:", allData);
    }
  } else {
    console.log("✅ user_id column exists! Sample data:", data);
  }
}

verifyColumn();
