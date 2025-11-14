import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function createReloadFunction() {
  console.log("Creating reload_postgrest_schema function...");
  
  // Try to create the function using a SQL execution method
  // Supabase doesn't expose exec_sql by default, so we'll use a workaround
  try {
    // First, try to check if we can call pg_notify directly
    const { data, error } = await supabase.rpc('reload_postgrest_schema');
    
    if (error && error.message.includes('function') && error.message.includes('does not exist')) {
      console.log("Function doesn't exist, need to create it via SQL Editor in Supabase Dashboard");
      console.log("Please run this SQL in your Supabase SQL Editor:");
      console.log(`
CREATE OR REPLACE FUNCTION public.reload_postgrest_schema()
RETURNS void 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public 
AS $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
END;
$$;

REVOKE ALL ON FUNCTION public.reload_postgrest_schema() FROM public;
GRANT EXECUTE ON FUNCTION public.reload_postgrest_schema() TO service_role;
      `);
      process.exit(1);
    } else if (!error) {
      console.log("✅ Function already exists and was called successfully!");
      process.exit(0);
    } else {
      console.error("Unexpected error:", error);
      process.exit(1);
    }
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
}

createReloadFunction();
