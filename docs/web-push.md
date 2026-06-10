# Web Push — recordatorios de pagos (v2, opcional)

Tercera capa de recordatorios (las dos primeras ya funcionan: panel "Próximos pagos" del
dashboard y el calendario .ics). Notificaciones push diarias a las 8 AM con los pagos que
vencen hoy o mañana.

**Requisitos en iPhone:** iOS 16.4+, la PWA instalada en pantalla de inicio (no Safari),
y permiso de notificaciones concedido desde la app.

## 1. Generar llaves VAPID

```bash
npx web-push generate-vapid-keys
```

Guarda la pública y la privada. La pública también va al cliente (paso 5).

## 2. Crear la tabla de suscripciones

Ejecuta `supabase/migrations/003_push_subscriptions.sql` en el SQL Editor
(solo la tabla y las policies; el bloque de cron va en el paso 4).

## 3. Desplegar la Edge Function

```bash
supabase secrets set VAPID_PUBLIC_KEY=<publica> VAPID_PRIVATE_KEY=<privada> VAPID_SUBJECT=mailto:marloncanonotaloca@gmail.com
supabase functions deploy payment-reminders
```

Prueba manual:

```bash
curl -X POST https://<PROJECT_REF>.functions.supabase.co/payment-reminders \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>"
```

## 4. Programar la ejecución diaria

Habilita las extensiones `pg_cron` y `pg_net` (Dashboard → Database → Extensions) y
ejecuta el bloque `cron.schedule` comentado al final de la migración 003
(reemplaza `<PROJECT_REF>` y `<SERVICE_ROLE_KEY>`). `0 13 * * *` = 8:00 AM Bogotá.

## 5. Cliente (pendiente de implementar)

Dos piezas cuando se decida activar esto:

1. **Service worker con handler de push.** `vite-plugin-pwa` debe pasar de `generateSW` a
   `injectManifest` para poder añadir:

   ```js
   self.addEventListener('push', (event) => {
     const { title, body } = event.data.json()
     event.waitUntil(self.registration.showNotification(title, { body, icon: '/pwa-192x192.png' }))
   })
   ```

2. **Botón "Activar notificaciones"** (en el sheet de Calendario del dashboard):

   ```ts
   const registration = await navigator.serviceWorker.ready
   const sub = await registration.pushManager.subscribe({
     userVisibleOnly: true,
     applicationServerKey: VAPID_PUBLIC_KEY, // la pública del paso 1
   })
   const { endpoint, keys } = sub.toJSON()
   await supabase.from('push_subscriptions').upsert(
     { user_id: session.user.id, endpoint, p256dh: keys.p256dh, auth: keys.auth },
     { onConflict: 'endpoint' },
   )
   ```

La spec marca esto como opcional y fuera del MVP; el servidor queda listo
(función + tabla + cron documentado) y el cliente se conecta cuando haga falta.
