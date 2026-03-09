-- Create a SECURITY DEFINER function to reload PostgREST schema cache
-- This is necessary because we cannot run NOTIFY directly on remote Supabase
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

-- Security: Only service_role can execute this
REVOKE ALL ON FUNCTION public.reload_postgrest_schema() FROM public;
GRANT EXECUTE ON FUNCTION public.reload_postgrest_schema() TO service_role;
