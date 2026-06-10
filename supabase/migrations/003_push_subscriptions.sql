-- Panorama — suscripciones Web Push (v2, opcional)
-- Ejecutar solo cuando actives los recordatorios push (ver docs/web-push.md).

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null
);

alter table public.push_subscriptions enable row level security;

create policy "owner_select" on public.push_subscriptions
  for select using (user_id = auth.uid());
create policy "owner_insert" on public.push_subscriptions
  for insert with check (user_id = auth.uid());
create policy "owner_delete" on public.push_subscriptions
  for delete using (user_id = auth.uid());

-- Programación diaria 8:00 AM Bogotá (13:00 UTC) con pg_cron + pg_net.
-- Requiere habilitar ambas extensiones (Dashboard → Database → Extensions)
-- y reemplazar <PROJECT_REF> y <SERVICE_ROLE_KEY> antes de ejecutar:
--
-- select cron.schedule(
--   'payment-reminders-daily',
--   '0 13 * * *',
--   $$
--   select net.http_post(
--     url := 'https://<PROJECT_REF>.functions.supabase.co/payment-reminders',
--     headers := jsonb_build_object(
--       'Authorization', 'Bearer <SERVICE_ROLE_KEY>',
--       'Content-Type', 'application/json'
--     ),
--     body := '{}'::jsonb
--   );
--   $$
-- );
