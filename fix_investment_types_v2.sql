-- First, update existing data to use underscore format (matching application code)
UPDATE investments SET type = 'reserva_emergencia' WHERE type = 'reserva-emergencia';
UPDATE investments SET type = 'renda_fixa' WHERE type = 'renda-fixa';
UPDATE investments SET type = 'renda_variavel' WHERE type = 'renda-variavel';

-- Drop existing constraint
ALTER TABLE investments DROP CONSTRAINT IF EXISTS investments_type_check;

-- Add new constraint with all valid types (underscore format)
ALTER TABLE investments 
ADD CONSTRAINT investments_type_check 
CHECK (type IN ('reserva_emergencia', 'cdb', 'renda_fixa', 'renda_variavel'));

-- Reload PostgREST schema cache
SELECT reload_postgrest_schema();
