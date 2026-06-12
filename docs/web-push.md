# Web Push — recordatorios de pagos

Tercera capa de recordatorios (las dos primeras: panel "Próximos pagos" del dashboard y
el calendario .ics). Notificación push diaria a las 8 AM con los pagos que vencen hoy o mañana.

**Requisitos en iPhone:** iOS 16.4+, la PWA instalada en pantalla de inicio (no Safari),
y permiso de notificaciones concedido desde la app.

## Estado (2026-06-12) — activado, salvo secrets

| Pieza | Estado |
|---|---|
| Tabla `push_subscriptions` (migración 003) | ✅ aplicada |
| Edge function `payment-reminders` (v2, auth por `x-cron-key`) | ✅ desplegada |
| Extensiones `pg_cron` + `pg_net` | ✅ habilitadas |
| Cron `payment-reminders-daily` (`0 13 * * *` = 8 AM Bogotá) | ✅ programado |
| Cliente: handler push (`public/push-sw.js` vía `workbox.importScripts`) | ✅ |
| Cliente: botón "Activar notificaciones push" (sheet Calendario del dashboard) | ✅ |
| `VITE_VAPID_PUBLIC_KEY` en `.env` | ✅ |
| **Secrets de la edge function** (dashboard) | ⚠️ pendiente (manual) |
| **`VITE_VAPID_PUBLIC_KEY` en Vercel** + redeploy | ⚠️ pendiente (manual) |

## Secrets pendientes (Dashboard → Edge Functions → Secrets)

- `VAPID_PUBLIC_KEY` — la pública (misma que `VITE_VAPID_PUBLIC_KEY` del `.env`)
- `VAPID_PRIVATE_KEY` — la privada generada con `npx web-push generate-vapid-keys`
- `VAPID_SUBJECT` — `mailto:marloncano1997@gmail.com`
- `CRON_SECRET` — el mismo valor que envía el cron en el header `x-cron-key`
  (ver `select command from cron.job where jobname = 'payment-reminders-daily'`)

`SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` los inyecta Supabase automáticamente.

## Seguridad

La función se despliega con `verify_jwt = false` porque pg_cron no envía JWT; en su lugar
valida el header `x-cron-key` contra el secret `CRON_SECRET`. Si se rota el secret, cambiarlo
en ambos lados (secrets de la función y `cron.schedule`).

## Prueba manual

```bash
curl -X POST https://elavnpyuwccuwrgfbkzm.supabase.co/functions/v1/payment-reminders \
  -H "x-cron-key: <CRON_SECRET>"
```

Respuesta esperada: `{"sent":N,"messages":[...]}` (o `{"sent":0}` si nada vence hoy/mañana).

## Flujo en el dispositivo

1. Instalar la PWA en pantalla de inicio y abrirla.
2. Dashboard → botón "Calendario" → "Activar notificaciones push" → permitir.
3. La suscripción queda en `push_subscriptions`; la función la limpia sola si el
   dispositivo se desuscribe (404/410).
