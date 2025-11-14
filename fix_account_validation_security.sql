-- Fix critical security vulnerability: validate source_account_id belongs to user
-- This prevents users from debiting other users' accounts

CREATE OR REPLACE FUNCTION public.create_investment_transaction(
  p_user_id UUID,
  p_investment_id UUID,
  p_source_account_id UUID,
  p_amount NUMERIC(10,2),
  p_type TEXT,
  p_date TIMESTAMPTZ,
  p_note TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_transaction_id UUID;
  v_investment_name TEXT;
  v_current_amount NUMERIC(10,2);
  v_new_amount NUMERIC(10,2);
  v_account_owner UUID;
  v_result JSON;
BEGIN
  -- Validate type
  IF p_type NOT IN ('deposit', 'withdrawal') THEN
    RAISE EXCEPTION 'Invalid transaction type: %', p_type;
  END IF;

  -- CRITICAL SECURITY: Validate source account belongs to user
  SELECT user_id INTO v_account_owner
  FROM accounts
  WHERE id = p_source_account_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Account not found';
  END IF;

  IF v_account_owner != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized: account does not belong to user';
  END IF;

  -- Get investment details and validate ownership
  SELECT name, current_amount 
  INTO v_investment_name, v_current_amount
  FROM investments 
  WHERE id = p_investment_id AND user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Investment not found or unauthorized';
  END IF;

  -- Calculate new amount
  IF p_type = 'deposit' THEN
    v_new_amount := v_current_amount + p_amount;
  ELSE
    v_new_amount := v_current_amount - p_amount;
    IF v_new_amount < 0 THEN
      RAISE EXCEPTION 'Insufficient investment balance';
    END IF;
  END IF;

  -- Generate UUID for transaction
  v_transaction_id := gen_random_uuid();

  -- 1. Insert investment transaction
  INSERT INTO investment_transactions (
    id, user_id, investment_id, source_account_id, 
    amount, type, date, note
  ) VALUES (
    v_transaction_id, p_user_id, p_investment_id, p_source_account_id,
    p_amount, p_type, p_date, p_note
  );

  -- 2. Update investment current_amount
  UPDATE investments 
  SET current_amount = v_new_amount
  WHERE id = p_investment_id;

  -- 3. Create corresponding account transaction (only for deposits)
  IF p_type = 'deposit' THEN
    INSERT INTO transactions (
      user_id, account_id, description, type, 
      amount, category, date
    ) VALUES (
      p_user_id, 
      p_source_account_id,
      COALESCE(p_note, 'Investimento em ' || v_investment_name),
      'saida',
      p_amount,
      'Investimentos',
      p_date
    );
  END IF;

  -- Return the created transaction
  SELECT json_build_object(
    'id', v_transaction_id,
    'userId', p_user_id,
    'investmentId', p_investment_id,
    'sourceAccountId', p_source_account_id,
    'amount', p_amount,
    'type', p_type,
    'date', p_date,
    'note', p_note,
    'createdAt', NOW()
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- Reload schema cache
SELECT reload_postgrest_schema();
