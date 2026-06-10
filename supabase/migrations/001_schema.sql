-- Panorama — esquema completo
-- Ejecutar en el SQL Editor de Supabase (o via supabase db push)

create type category_type as enum ('expense', 'income');
create type debt_status as enum ('active', 'paid_off');
create type payment_kind as enum ('cuota', 'abono_capital');
create type recurring_frequency as enum ('monthly', 'once', 'yearly');

-- ---------------------------------------------------------------- categories
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  name text not null,
  icon text not null default '📦',
  type category_type not null,
  color text not null default '#71717a',
  is_frequent boolean not null default false,
  sort_order int not null default 0
);

-- -------------------------------------------------------------- transactions
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  amount bigint not null check (amount > 0), -- pesos COP enteros
  type category_type not null,
  category_id uuid references public.categories (id) on delete set null,
  note text,
  occurred_at date not null default current_date
);

create index transactions_occurred_at_idx on public.transactions (user_id, occurred_at desc);

-- --------------------------------------------------------------------- debts
create table public.debts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  name text not null,
  original_amount bigint,
  current_balance bigint not null default 0,
  interest_rate_ea numeric,
  monthly_payment bigint,
  payment_day int check (payment_day between 1 and 31),
  end_date date,
  status debt_status not null default 'active',
  notes text
);

-- ------------------------------------------------------------- debt_payments
create table public.debt_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  debt_id uuid not null references public.debts (id) on delete cascade,
  amount bigint not null check (amount > 0),
  kind payment_kind not null,
  paid_at date not null default current_date
);

create index debt_payments_debt_idx on public.debt_payments (debt_id, paid_at desc);

-- Trigger: descontar del saldo de la deuda y marcar paid_off al llegar a 0
create or replace function public.apply_debt_payment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.debts
  set current_balance = greatest(current_balance - new.amount, 0),
      status = case
        when current_balance - new.amount <= 0 then 'paid_off'::debt_status
        else status
      end
  where id = new.debt_id and user_id = new.user_id;
  return new;
end;
$$;

create trigger debt_payment_applied
after insert on public.debt_payments
for each row execute function public.apply_debt_payment();

-- Trigger inverso al eliminar un pago (corrige errores de registro)
create or replace function public.revert_debt_payment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.debts
  set current_balance = current_balance + old.amount,
      status = 'active'::debt_status
  where id = old.debt_id and user_id = old.user_id;
  return old;
end;
$$;

create trigger debt_payment_reverted
after delete on public.debt_payments
for each row execute function public.revert_debt_payment();

-- -------------------------------------------------------- recurring_payments
create table public.recurring_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  name text not null,
  amount bigint, -- null = monto variable (ej. TC)
  due_day int check (due_day between 1 and 31), -- para frequency monthly/yearly
  due_date date, -- para frequency once
  frequency recurring_frequency not null default 'monthly',
  debt_id uuid references public.debts (id) on delete set null,
  active boolean not null default true,
  category_id uuid references public.categories (id) on delete set null,
  constraint due_day_or_date check (
    (frequency = 'once' and due_date is not null)
    or (frequency in ('monthly', 'yearly') and due_day is not null)
  )
);

-- --------------------------------------------------------------------- goals
create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  name text not null,
  target_amount bigint not null check (target_amount > 0),
  current_amount bigint not null default 0,
  deadline date,
  icon text not null default '🎯',
  sort_order int not null default 0,
  is_debt_free_goal boolean not null default false -- se alimenta de debt_payments, no acepta aportes manuales
);

-- ---------------------------------------------------------- goal_contributions
create table public.goal_contributions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  goal_id uuid not null references public.goals (id) on delete cascade,
  amount bigint not null check (amount > 0),
  contributed_at date not null default current_date
);

create or replace function public.apply_goal_contribution()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.goals
  set current_amount = current_amount + new.amount
  where id = new.goal_id and user_id = new.user_id;
  return new;
end;
$$;

create trigger goal_contribution_applied
after insert on public.goal_contributions
for each row execute function public.apply_goal_contribution();

create or replace function public.revert_goal_contribution()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.goals
  set current_amount = greatest(current_amount - old.amount, 0)
  where id = old.goal_id and user_id = old.user_id;
  return old;
end;
$$;

create trigger goal_contribution_reverted
after delete on public.goal_contributions
for each row execute function public.revert_goal_contribution();

-- La meta "Deuda cero" se alimenta automáticamente de cada debt_payment
create or replace function public.feed_debt_free_goal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.goals
  set current_amount = current_amount + new.amount
  where user_id = new.user_id and is_debt_free_goal;
  return new;
end;
$$;

create trigger debt_free_goal_fed
after insert on public.debt_payments
for each row execute function public.feed_debt_free_goal();

create or replace function public.unfeed_debt_free_goal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.goals
  set current_amount = greatest(current_amount - old.amount, 0)
  where user_id = old.user_id and is_debt_free_goal;
  return old;
end;
$$;

create trigger debt_free_goal_unfed
after delete on public.debt_payments
for each row execute function public.unfeed_debt_free_goal();

-- ------------------------------------------------------------------ settings
create table public.settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  monthly_income_expected bigint not null default 0,
  monthly_essential_budget bigint not null default 0
);

-- ----------------------------------------------------------------------- RLS
alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.debts enable row level security;
alter table public.debt_payments enable row level security;
alter table public.recurring_payments enable row level security;
alter table public.goals enable row level security;
alter table public.goal_contributions enable row level security;
alter table public.settings enable row level security;

do $$
declare t text;
begin
  foreach t in array array[
    'categories', 'transactions', 'debts', 'debt_payments',
    'recurring_payments', 'goals', 'goal_contributions', 'settings'
  ]
  loop
    execute format(
      'create policy "owner_select" on public.%I for select using (user_id = auth.uid())', t);
    execute format(
      'create policy "owner_insert" on public.%I for insert with check (user_id = auth.uid())', t);
    execute format(
      'create policy "owner_update" on public.%I for update using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
    execute format(
      'create policy "owner_delete" on public.%I for delete using (user_id = auth.uid())', t);
  end loop;
end;
$$;
