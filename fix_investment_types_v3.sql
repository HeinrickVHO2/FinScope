-- Step 1: Remove ALL constraints first
ALTER TABLE investments DROP CONSTRAINT IF EXISTS investments_type_check;

-- Step 2: Update existing data to use underscore format
UPDATE investments SET type = 'reserva_emergencia' WHERE type = 'reserva-emergencia';
UPDATE investments SET type = 'renda_fixa' WHERE type = 'renda-fixa';
UPDATE investments SET type = 'renda_variavel' WHERE type = 'renda-variavel';

-- Step 3: Add new constraint with underscore format only
ALTER TABLE investments 
ADD CONSTRAINT investments_type_check 
CHECK (type IN ('reserva_emergencia', 'cdb', 'renda_fixa', 'renda_variavel'));

-- Step 4: Reload PostgREST schema cache
SELECT reload_postgrest_schema();
