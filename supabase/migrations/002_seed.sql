-- Panorama — seed data (datos reales)
-- IMPORTANTE: crear primero el usuario en Supabase Auth (Dashboard → Authentication → Add user).
-- Este script toma el único usuario existente. Ejecutar UNA sola vez.

do $$
declare
  uid uuid;
  jfk_id uuid;
  tc_id uuid;
  alkomprar_id uuid;
  mueble_id uuid;
begin
  select id into uid from auth.users order by created_at limit 1;
  if uid is null then
    raise exception 'No hay usuario en auth.users. Crea la cuenta primero.';
  end if;

  -- ------------------------------------------------------ categorías de gasto
  insert into public.categories (user_id, name, icon, type, color, is_frequent, sort_order) values
    (uid, 'Mercado',            '🛒', 'expense', '#34d399', true,  1),
    (uid, 'Comida fuera/Rappi', '🍔', 'expense', '#fb923c', true,  2),
    (uid, 'Transporte/Gasolina','⛽', 'expense', '#60a5fa', true,  3),
    (uid, 'Moto',               '🏍️', 'expense', '#a78bfa', true,  4),
    (uid, 'Vivienda',           '🏠', 'expense', '#f472b6', false, 5),
    (uid, 'Suscripciones',      '📺', 'expense', '#e879f9', false, 6),
    (uid, 'Salud',              '💊', 'expense', '#2dd4bf', false, 7),
    (uid, 'Ocio',               '🎮', 'expense', '#facc15', false, 8),
    (uid, 'Ropa',               '👕', 'expense', '#94a3b8', false, 9),
    (uid, 'Regalos',            '🎁', 'expense', '#fb7185', false, 10),
    (uid, 'Universidad',        '🎓', 'expense', '#818cf8', false, 11),
    (uid, 'Otros',              '📦', 'expense', '#71717a', false, 12);

  -- ---------------------------------------------------- categorías de ingreso
  insert into public.categories (user_id, name, icon, type, color, is_frequent, sort_order) values
    (uid, 'Salario MeLi',   '💼', 'income', '#34d399', true,  1),
    (uid, 'Prima',          '💰', 'income', '#facc15', false, 2),
    (uid, 'Bono',           '🎉', 'income', '#60a5fa', false, 3),
    (uid, 'Negocio cerdos', '🐷', 'income', '#f472b6', false, 4),
    (uid, 'Otros',          '📦', 'income', '#71717a', false, 5);

  -- -------------------------------------------------------------------- deudas
  insert into public.debts (user_id, name, original_amount, current_balance, interest_rate_ea, monthly_payment, payment_day, end_date, status, notes)
  values (uid, 'JFK Cooperativa', 43100000, 38400000, 18.02, 1236529, 1, '2029-12-01', 'active',
          'Plan: matar feb-mar 2027 con abonos a capital.')
  returning id into jfk_id;

  insert into public.debts (user_id, name, original_amount, current_balance, interest_rate_ea, monthly_payment, payment_day, end_date, status, notes)
  values (uid, 'TC Davivienda', null, 6341000, 28.02, null, 15, null, 'active',
          'Plan: matar ago-sep 2026. Incluye diferidos: Amazon 24 cuotas (saldo ~1.823.390) y Preply 36 cuotas (~170K c/u) — RECOGER al cancelar.')
  returning id into tc_id;

  insert into public.debts (user_id, name, original_amount, current_balance, interest_rate_ea, monthly_payment, payment_day, end_date, status, notes)
  values (uid, 'Alkomprar', 1224384, 884940, null, 306096, 3, '2026-09-01', 'active',
          'Última cuota 2026-09-01.')
  returning id into alkomprar_id;

  insert into public.debts (user_id, name, original_amount, current_balance, interest_rate_ea, monthly_payment, payment_day, end_date, status, notes)
  values (uid, 'Mueble', null, 553491, null, 553491, null, '2026-07-25', 'active',
          'Única cuota 2026-07-25.')
  returning id into mueble_id;

  -- ------------------------------------------------------------ pagos recurrentes
  insert into public.recurring_payments (user_id, name, amount, due_day, due_date, frequency, debt_id, active) values
    (uid, 'Cuota JFK',                1236529, 1,    null,         'monthly', jfk_id,       true),
    (uid, 'Alkomprar cuota julio',    306096,  null, '2026-07-03', 'once',    alkomprar_id, true),
    (uid, 'Alkomprar cuota agosto',   306096,  null, '2026-08-02', 'once',    alkomprar_id, true),
    (uid, 'Alkomprar última cuota',   306096,  null, '2026-09-01', 'once',    alkomprar_id, true),
    (uid, 'Mueble última cuota',      553491,  null, '2026-07-25', 'once',    mueble_id,    true),
    (uid, 'Pago TC Davivienda',       null,    15,   null,         'monthly', tc_id,        true),
    (uid, 'Matrícula universidad',    2300000, null, '2026-07-15', 'once',    null,         true),
    (uid, 'Matrícula universidad',    2300000, null, '2027-01-15', 'once',    null,         true),
    (uid, 'SOAT moto',                600000,  1,    null,         'yearly',  null,         true),
    (uid, 'Tecnomecánica moto',       250000,  1,    null,         'yearly',  null,         true);

  -- --------------------------------------------------------------------- metas
  insert into public.goals (user_id, name, target_amount, current_amount, deadline, icon, sort_order, is_debt_free_goal) values
    (uid, 'Deuda cero',             46200000, 0, '2027-03-31', '🔥', 1, true),
    (uid, 'Fondo de emergencia',    15000000, 0, '2027-05-31', '🛟', 2, false),
    (uid, 'Cuenta Carro',           30000000, 0, null,         '🚗', 3, false),
    (uid, 'Cuota inicial inmueble', 60000000, 0, null,         '🏠', 4, false);

  -- ------------------------------------------------------------------ settings
  insert into public.settings (user_id, monthly_income_expected, monthly_essential_budget)
  values (uid, 10500000, 3000000);
end;
$$;
