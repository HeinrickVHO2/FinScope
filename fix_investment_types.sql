-- Update investment type check constraint to match application types
-- Current types used in app: reserva_emergencia, cdb, renda_fixa, renda_variavel

-- Drop existing constraint
ALTER TABLE investments DROP CONSTRAINT IF EXISTS investments_type_check;

-- Add new constraint with all valid types
ALTER TABLE investments 
ADD CONSTRAINT investments_type_check 
CHECK (type IN ('reserva_emergencia', 'cdb', 'renda_fixa', 'renda_variavel'));

-- Reload PostgREST schema cache
SELECT reload_postgrest_schema();
