-- Demo user seed for FinScope
-- Login:
--   email: cristiano.silva.demo@finscope.test
--   senha: FinScopeDemo@2026
--
-- O script e idempotente para esse usuario de teste:
-- 1) cria/atualiza o usuario como Premium ativo
-- 2) remove os dados financeiros anteriores dele
-- 3) recria uma base recente com 1 mes de movimentacoes para demonstracao

begin;

create extension if not exists pgcrypto;

do $$
declare
  v_user_id text;
  v_account_id text;
  v_accounts_user_id_is_uuid boolean;
  v_transactions_user_id_is_uuid boolean;
  v_transactions_account_id_is_uuid boolean;
  v_future_expenses_user_id_is_uuid boolean;
  v_future_transactions_user_id_is_uuid boolean;
  v_recurring_transactions_user_id_is_uuid boolean;
  v_rules_user_id_is_uuid boolean;
  v_category_limits_user_id_is_uuid boolean;
  v_user_report_preferences_user_id_is_uuid boolean;
begin
  select coalesce(data_type = 'uuid', false) into v_accounts_user_id_is_uuid
  from information_schema.columns
  where table_schema = 'public' and table_name = 'accounts' and column_name = 'user_id';

  select coalesce(data_type = 'uuid', false) into v_transactions_user_id_is_uuid
  from information_schema.columns
  where table_schema = 'public' and table_name = 'transactions' and column_name = 'user_id';

  select coalesce(data_type = 'uuid', false) into v_transactions_account_id_is_uuid
  from information_schema.columns
  where table_schema = 'public' and table_name = 'transactions' and column_name = 'account_id';

  select coalesce(data_type = 'uuid', false) into v_future_expenses_user_id_is_uuid
  from information_schema.columns
  where table_schema = 'public' and table_name = 'future_expenses' and column_name = 'user_id';

  select coalesce(data_type = 'uuid', false) into v_future_transactions_user_id_is_uuid
  from information_schema.columns
  where table_schema = 'public' and table_name = 'future_transactions' and column_name = 'user_id';

  select coalesce(data_type = 'uuid', false) into v_recurring_transactions_user_id_is_uuid
  from information_schema.columns
  where table_schema = 'public' and table_name = 'recurring_transactions' and column_name = 'user_id';

  select coalesce(data_type = 'uuid', false) into v_rules_user_id_is_uuid
  from information_schema.columns
  where table_schema = 'public' and table_name = 'rules' and column_name = 'user_id';

  select coalesce(data_type = 'uuid', false) into v_category_limits_user_id_is_uuid
  from information_schema.columns
  where table_schema = 'public' and table_name = 'category_limits' and column_name = 'user_id';

  select coalesce(data_type = 'uuid', false) into v_user_report_preferences_user_id_is_uuid
  from information_schema.columns
  where table_schema = 'public' and table_name = 'user_report_preferences' and column_name = 'user_id';

  insert into users (
    email,
    password,
    full_name,
    plan,
    trial_start,
    trial_end,
    cakto_subscription_id,
    billing_status
  )
  values (
    'cristiano.silva.demo@finscope.test',
    crypt('FinScopeDemo@2026', gen_salt('bf')),
    'Cristiano Silva',
    'premium',
    null,
    null,
    'demo-premium-cristiano-silva',
    'active'
  )
  on conflict (email) do update
  set
    password = excluded.password,
    full_name = excluded.full_name,
    plan = 'premium',
    trial_start = null,
    trial_end = null,
    cakto_subscription_id = excluded.cakto_subscription_id,
    billing_status = 'active'
  returning id::text into v_user_id;

  execute case when v_transactions_user_id_is_uuid
    then 'delete from transactions where user_id = $1::uuid'
    else 'delete from transactions where user_id = $1'
  end using v_user_id;

  execute case when v_future_expenses_user_id_is_uuid
    then 'delete from future_expenses where user_id = $1::uuid'
    else 'delete from future_expenses where user_id = $1'
  end using v_user_id;

  execute case when v_future_transactions_user_id_is_uuid
    then 'delete from future_transactions where user_id = $1::uuid'
    else 'delete from future_transactions where user_id = $1'
  end using v_user_id;

  execute case when v_recurring_transactions_user_id_is_uuid
    then 'delete from recurring_transactions where user_id = $1::uuid'
    else 'delete from recurring_transactions where user_id = $1'
  end using v_user_id;

  execute case when v_rules_user_id_is_uuid
    then 'delete from rules where user_id = $1::uuid'
    else 'delete from rules where user_id = $1'
  end using v_user_id;

  execute case when v_category_limits_user_id_is_uuid
    then 'delete from category_limits where user_id = $1::uuid'
    else 'delete from category_limits where user_id = $1'
  end using v_user_id;

  execute case when v_user_report_preferences_user_id_is_uuid
    then 'delete from user_report_preferences where user_id = $1::uuid'
    else 'delete from user_report_preferences where user_id = $1'
  end using v_user_id;

  execute case when v_accounts_user_id_is_uuid
    then 'delete from accounts where user_id = $1::uuid'
    else 'delete from accounts where user_id = $1'
  end using v_user_id;

  execute format(
    'insert into accounts (
      user_id,
      name,
      type,
      business_category,
      initial_balance
    )
    values (
      %s,
      ''Conta Pessoal Cristiano'',
      ''pf'',
      null,
      3500.00
    )
    returning id::text',
    case when v_accounts_user_id_is_uuid then '$1::uuid' else '$1' end
  )
  into v_account_id
  using v_user_id;

  execute format(
    'insert into user_report_preferences (
      user_id,
      focus_saving,
      focus_debts,
      focus_investments,
      updated_at
    )
    values (
      %s,
      true,
      false,
      true,
      now()
    )',
    case when v_user_report_preferences_user_id_is_uuid then '$1::uuid' else '$1' end
  )
  using v_user_id;

  execute format(
    'insert into rules (
      user_id,
      rule_name,
      contains,
      category_result,
      is_active
    )
    values
      (%1$s, ''Uber vira Transporte'', ''uber'', ''Transporte'', true),
      (%1$s, ''iFood vira Alimentacao'', ''ifood'', ''Alimentacao'', true),
      (%1$s, ''Mercado vira Mercado'', ''mercado'', ''Mercado'', true)',
    case when v_rules_user_id_is_uuid then '$1::uuid' else '$1' end
  )
  using v_user_id;

  execute format(
    'insert into category_limits (
      user_id,
      category,
      scope,
      period,
      amount,
      created_at,
      updated_at
    )
    values
      (%1$s, ''Mercado'', ''PF'', ''monthly'', 900.00, now(), now()),
      (%1$s, ''Alimentacao'', ''PF'', ''monthly'', 650.00, now(), now()),
      (%1$s, ''Transporte'', ''PF'', ''monthly'', 450.00, now(), now())',
    case when v_category_limits_user_id_is_uuid then '$1::uuid' else '$1' end
  )
  using v_user_id;

  execute format(
    $sql$
    with demo_transactions(days_ago, description, type, amount, category) as (
      values
        (29, 'Salario mensal empresa Horizonte', 'entrada', 5200.00, 'Salario'),
        (28, 'Aluguel do apartamento', 'saida', 1450.00, 'Aluguel'),
        (27, 'Mercado Extra compras do mes', 'saida', 182.70, 'Mercado'),
        (26, 'Uber para o trabalho', 'saida', 22.90, 'Transporte'),
        (25, 'Padaria e cafe da manha', 'saida', 18.50, 'Alimentacao'),
        (24, 'Farmacia Sao Joao', 'saida', 46.30, 'Saude'),
        (23, 'Conta de energia', 'saida', 138.20, 'Luz / Agua'),
        (22, 'iFood jantar em casa', 'saida', 54.90, 'Alimentacao'),
        (21, 'Supermercado Bom Dia', 'saida', 96.40, 'Mercado'),
        (20, 'Assinatura Netflix', 'saida', 39.90, 'Streaming'),
        (19, 'Onibus e metro', 'saida', 24.00, 'Transporte'),
        (18, 'Almoco no trabalho', 'saida', 31.80, 'Alimentacao'),
        (17, 'Internet fibra residencial', 'saida', 99.90, 'Luz / Agua'),
        (16, 'Mercado de bairro', 'saida', 74.35, 'Mercado'),
        (15, 'Reembolso de amigo', 'entrada', 120.00, 'Outros'),
        (14, 'Posto de gasolina', 'saida', 120.00, 'Transporte'),
        (13, 'Restaurante em familia', 'saida', 68.70, 'Alimentacao'),
        (12, 'Academia mensal', 'saida', 89.90, 'Saude'),
        (11, 'Supermercado Bom Preco', 'saida', 148.20, 'Mercado'),
        (10, 'Assinatura Spotify', 'saida', 21.90, 'Streaming'),
        (9, 'Uber volta para casa', 'saida', 19.40, 'Transporte'),
        (8, 'Feira de hortifruti', 'saida', 42.80, 'Mercado'),
        (7, 'Lanche da tarde', 'saida', 17.50, 'Alimentacao'),
        (6, 'Conta de agua', 'saida', 67.15, 'Luz / Agua'),
        (5, 'Cinema no fim de semana', 'saida', 45.00, 'Lazer'),
        (4, 'Mercado atacado', 'saida', 210.55, 'Mercado'),
        (3, 'Consulta clinica', 'saida', 120.00, 'Saude'),
        (2, 'iFood almoco', 'saida', 36.90, 'Alimentacao'),
        (1, 'Recarga de celular', 'saida', 30.00, 'Outros'),
        (0, 'Farmacia e itens pessoais', 'saida', 58.60, 'Saude')
    )
    insert into transactions (
      user_id,
      account_id,
      description,
      type,
      amount,
      category,
      date,
      account_type,
      auto_rule_applied,
      source
    )
    select
      %s,
      %s,
      description,
      type,
      amount,
      category,
      ((current_date - days_ago) + time '12:00'),
      'PF',
      false,
      'manual'
    from demo_transactions
    order by days_ago desc
    $sql$,
    case when v_transactions_user_id_is_uuid then '$1::uuid' else '$1' end,
    case when v_transactions_account_id_is_uuid then '$2::uuid' else '$2' end
  )
  using v_user_id, v_account_id;

  execute format(
    'insert into recurring_transactions (
      user_id,
      type,
      description,
      amount,
      frequency,
      next_date,
      account_type
    )
    values
      (%1$s, ''expense'', ''Academia mensal'', 89.90, ''monthly'', ((current_date + 12) + time ''09:00''), ''PF''),
      (%1$s, ''expense'', ''Internet fibra residencial'', 99.90, ''monthly'', ((current_date + 8) + time ''09:00''), ''PF''),
      (%1$s, ''expense'', ''Assinatura Netflix'', 39.90, ''monthly'', ((current_date + 14) + time ''09:00''), ''PF'')',
    case when v_recurring_transactions_user_id_is_uuid then '$1::uuid' else '$1' end
  )
  using v_user_id;

  execute format(
    'insert into future_transactions (
      user_id,
      type,
      description,
      amount,
      expected_date,
      account_type,
      status,
      is_scheduled,
      due_date
    )
    values
      (%1$s, ''income'', ''Freelance de fim de mes'', 650.00, ((current_date + 6) + time ''10:00''), ''PF'', ''pending'', false, ((current_date + 6) + time ''10:00'')),
      (%1$s, ''expense'', ''Parcela notebook'', 320.00, ((current_date + 10) + time ''10:00''), ''PF'', ''pending'', true, ((current_date + 10) + time ''10:00''))',
    case when v_future_transactions_user_id_is_uuid then '$1::uuid' else '$1' end
  )
  using v_user_id;

  execute format(
    'insert into future_expenses (
      user_id,
      account_type,
      title,
      category,
      amount,
      due_date,
      is_recurring,
      recurrence_type,
      status
    )
    values
      (%1$s, ''PF'', ''Fatura do cartao'', ''Outros'', 780.00, ((current_date + 5) + time ''09:00''), false, null, ''pending''),
      (%1$s, ''PF'', ''Conta de energia proxima'', ''Luz / Agua'', 142.00, ((current_date + 7) + time ''09:00''), false, null, ''pending''),
      (%1$s, ''PF'', ''Seguro do carro'', ''Outros'', 215.00, ((current_date + 18) + time ''09:00''), false, null, ''pending'')',
    case when v_future_expenses_user_id_is_uuid then '$1::uuid' else '$1' end
  )
  using v_user_id;
end $$;

commit;
