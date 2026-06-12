# Panorama — PWA de Finanzas Personales

App personal de finanzas. React 18 + Vite + TypeScript + Tailwind + Supabase. Spec completa en `../panorama-spec.md`.

## Setup de Supabase (una sola vez)

1. Crea un proyecto en [supabase.com](https://supabase.com) (región más cercana, ej. `sa-east-1`).
2. **Crear tu usuario:** Dashboard → Authentication → Users → *Add user* → email + contraseña (marca *Auto Confirm*).
3. **Esquema:** Dashboard → SQL Editor → pega y ejecuta `supabase/migrations/001_schema.sql`.
4. **Seed:** ejecuta `supabase/migrations/002_seed.sql` (toma tu usuario automáticamente; ejecutar UNA sola vez).
5. **CR01 — cuentas y CRUD:** ejecuta `supabase/migrations/004_accounts_crud.sql` (crea `accounts`, agrega `account_id`/`transfer_id`, columnas `archived`, trigger TC ↔ deuda, 3 cuentas seed y backfill; UNA sola vez).
6. **Deshabilitar signups:** Authentication → Sign In / Up → desactiva *Allow new users to sign up*.
7. **Keys:** Project Settings → API → copia *Project URL* y *anon public key*.

## Setup local

```bash
cp .env.example .env   # y completa las dos variables
npm install
npm run dev
```

## Deploy (Vercel)

1. Importa el repo en Vercel.
2. Variables de entorno: `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
3. Build command: `npm run build`, output: `dist`.

## Instalar en iPhone

Abrir la URL en Safari → Compartir → **Agregar a pantalla de inicio**.

## Estructura

- `src/auth/` — sesión Supabase (login, provider)
- `src/components/` — layout, bottom nav
- `src/pages/` — Inicio · Movimientos · Agregar (quick add) · Deudas (+detalle) · Metas · Reportes · Cuentas · Recordatorios · Categorías
- `src/lib/` — cliente Supabase, formato COP, cola offline, .ics, CSV, series de deuda
- `supabase/migrations/` — esquema con RLS + triggers y seed con datos reales
- `supabase/functions/` — Edge Function de recordatorios push (opcional, ver `docs/web-push.md`)
