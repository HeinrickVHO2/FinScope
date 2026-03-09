-- Add missing current_amount column to investments table
ALTER TABLE investments 
ADD COLUMN IF NOT EXISTS current_amount NUMERIC(10,2) NOT NULL DEFAULT 0;

-- Reload PostgREST schema cache
SELECT reload_postgrest_schema();
