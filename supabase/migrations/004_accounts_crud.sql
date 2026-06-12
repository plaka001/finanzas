-- Panorama — CR01: cuentas / medios de pago + soporte de CRUD
-- Aditiva y no destructiva: solo CREATE / ALTER ADD COLUMN. Ejecutar UNA sola vez.

create type account_type as enum ('ahorros', 'corriente', 'tarjeta_credito', 'efectivo', 'otro');

-- ------------------------------------------------------------------ accounts
create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  name text not null,
  type account_type not null default 'ahorros',
  icon text not null default '💳',
  color text not null default '#71717a',
  initial_balance bigint not null default 0,
  debt_id uuid references public.debts (id) on delete set null, -- solo TC vinculada a deuda
  is_default boolean not null default false,
  archived boolean not null default false
);

-- una sola cuenta default por usuario
create unique index accounts_one_default_idx on public.accounts (user_id) where is_default;

alter table public.accounts enable row level security;
create policy "owner_select" on public.accounts for select using (user_id = auth.uid());
create policy "owner_insert" on public.accounts for insert with check (user_id = auth.uid());
create policy "owner_update" on public.accounts for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "owner_delete" on public.accounts for delete using (user_id = auth.uid());

-- ------------------------------------------- ALTERs sobre tablas existentes
alter table public.transactions add column account_id uuid references public.accounts (id) on delete set null;
alter table public.transactions add column transfer_id uuid; -- par salida/entrada de una transferencia
alter table public.debt_payments add column account_id uuid references public.accounts (id) on delete set null;

create index transactions_transfer_idx on public.transactions (transfer_id) where transfer_id is not null;

-- archivado (CR cambio 2: archivar en vez de borrar)
alter table public.debts add column archived boolean not null default false;
alter table public.goals add column archived boolean not null default false;
alter table public.categories add column archived boolean not null default false;

-- --------------------------------------------------------- regla TC ↔ deuda
-- Un gasto con cuenta tarjeta_credito vinculada a deuda SUBE el saldo de esa
-- deuda; editarlo o borrarlo revierte el efecto. Las transferencias
-- (transfer_id) no aplican: el pago de TC se registra como debt_payment.
create or replace function public.apply_card_expense()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  old_debt uuid;
  new_debt uuid;
begin
  if tg_op in ('UPDATE', 'DELETE')
     and old.type = 'expense' and old.transfer_id is null and old.account_id is not null then
    select debt_id into old_debt from public.accounts where id = old.account_id;
    if old_debt is not null then
      update public.debts
      set current_balance = greatest(current_balance - old.amount, 0)
      where id = old_debt and user_id = old.user_id;
    end if;
  end if;

  if tg_op in ('INSERT', 'UPDATE')
     and new.type = 'expense' and new.transfer_id is null and new.account_id is not null then
    select debt_id into new_debt from public.accounts where id = new.account_id;
    if new_debt is not null then
      update public.debts
      set current_balance = current_balance + new.amount,
          status = 'active'::debt_status
      where id = new_debt and user_id = new.user_id;
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger card_expense_applied
after insert or update or delete on public.transactions
for each row execute function public.apply_card_expense();

-- ------------------------------------------------------------ seed + backfill
do $$
declare
  uid uuid;
  tc_debt uuid;
  default_acct uuid;
begin
  select id into uid from auth.users order by created_at limit 1;
  if uid is null then
    raise exception 'No hay usuario en auth.users. Crea la cuenta primero.';
  end if;

  if exists (select 1 from public.accounts where user_id = uid) then
    raise notice 'Ya existen cuentas: seed y backfill omitidos.';
    return;
  end if;

  insert into public.accounts (user_id, name, type, icon, color, is_default)
  values (uid, 'Cuenta Ahorros', 'ahorros', '🏦', '#34d399', true)
  returning id into default_acct;

  select id into tc_debt from public.debts
  where user_id = uid and name = 'TC Davivienda' limit 1;

  insert into public.accounts (user_id, name, type, icon, color, debt_id)
  values (uid, 'TC Davivienda', 'tarjeta_credito', '💳', '#60a5fa', tc_debt);

  insert into public.accounts (user_id, name, type, icon, color)
  values (uid, 'Efectivo', 'efectivo', '💵', '#facc15');

  -- Backfill: lo ya registrado queda en la cuenta default (Ahorros).
  -- No dispara la regla TC porque la cuenta default no tiene debt_id.
  update public.transactions set account_id = default_acct
  where user_id = uid and account_id is null;

  update public.debt_payments set account_id = default_acct
  where user_id = uid and account_id is null;
end;
$$;
