import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function testTransaction() {
  // Get existing user and account
  const { data: users } = await supabase.from("users").select("id").limit(1);
  if (!users || users.length === 0) {
    console.log("❌ No users found");
    return;
  }
  const userId = users[0].id;
  
  const { data: accounts } = await supabase.from("accounts").select("id").eq("user_id", userId).limit(1);
  if (!accounts || accounts.length === 0) {
    console.log("❌ No accounts found for user");
    return;
  }
  const accountId = accounts[0].id;
  
  // Create a test investment
  const testInvId = crypto.randomUUID();
  const { error: invError } = await supabase.from("investments").insert({
    id: testInvId,
    user_id: userId,
    name: "Test Investment Script",
    type: "reserva_emergencia",
    current_amount: "0",
  });
  
  if (invError) {
    console.error("❌ Error creating investment:", invError);
    return;
  }
  
  console.log("✅ Created investment:", testInvId);
  
  // Create a transaction
  const { data: txData, error: txError } = await supabase
    .from("investment_transactions")
    .insert({
      user_id: userId,
      investment_id: testInvId,
      source_account_id: accountId,
      amount: "500.00",
      type: "deposit",
      date: new Date().toISOString(),
    })
    .select()
    .single();
  
  if (txError) {
    console.error("❌ Error creating transaction:", txError);
    return;
  }
  
  console.log("✅ Created transaction:", txData);
  
  // Check investment current amount
  const { data: invData } = await supabase
    .from("investments")
    .select("current_amount")
    .eq("id", testInvId)
    .single();
  
  console.log("📊 Investment current_amount after transaction:", invData?.current_amount);
  console.log("Expected: 500.00, Actual:", invData?.current_amount);
  
  if (invData?.current_amount === "0" || invData?.current_amount === "0.00") {
    console.log("❌ PROBLEM: current_amount not updated by backend!");
  } else {
    console.log("✅ Backend updated current_amount correctly");
  }
  
  // Cleanup
  await supabase.from("investments").delete().eq("id", testInvId);
  console.log("🧹 Cleaned up test data");
}

testTransaction();
