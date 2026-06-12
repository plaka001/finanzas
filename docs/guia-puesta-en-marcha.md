# Panorama — Guía de puesta en marcha completa

Cómo dejar el proyecto 100% funcional: base de datos, deploy a Vercel y las tres capas de
notificaciones. Proyecto Supabase: `elavnpyuwccuwrgfbkzm`.

## Checklist rápida

- [ ] Usuario único creado en Supabase Auth
- [ ] Migración `001_schema.sql` ejecutada (esquema + RLS)
- [ ] Migración `002_seed.sql` ejecutada (datos reales: deudas, categorías, metas)
- [ ] Migración `004_accounts_crud.sql` ejecutada (CR01: cuentas, transferencias, archivado)
- [ ] Signups públicos deshabilitados
- [ ] `.env` local con URL + publishable key
- [ ] Repo en GitHub e importado en Vercel con las 2 variables de entorno
- [ ] PWA instalada en el iPhone
- [ ] Calendario .ics importado (capa 2 de recordatorios)
- [ ] (Opcional v2) Web Push: migración `003`, Edge Function, VAPID y pg_cron

> **Estado de los archivos de BD:** las 4 migraciones de `supabase/migrations/` están al día
> con el código del cliente. `001` y `002` son la base, `004` es obligatoria desde el CR01
> (la app consulta `accounts` y `transfer_id`), y `003` solo se ejecuta si activas Web Push.

---

## Parte 1 — Base de datos (Supabase)

### 1.1 Crear el usuario único

Dashboard → **Authentication → Users → Add user**:
- Email y contraseña tuyos.
- Marca **Auto Confirm User** (sin esto el login pedirá verificación de correo).

Hazlo ANTES de las migraciones: `002` y `004` toman el primer usuario de `auth.users` y
fallan si no existe ninguno.

### 1.2 Ejecutar las migraciones (en orden, una sola vez cada una)

Dashboard → **SQL Editor** → pega el contenido del archivo → **Run**:

| Orden | Archivo | Qué hace | ¿Obligatoria? |
|---|---|---|---|
| 1 | `supabase/migrations/001_schema.sql` | Tablas, enums, triggers de deudas/metas, RLS en todo | Sí |
| 2 | `supabase/migrations/002_seed.sql` | Datos reales: 17 categorías, 4 deudas, 10 recurrentes, 4 metas, settings | Sí |
| 3 | `supabase/migrations/004_accounts_crud.sql` | Tabla `accounts` + RLS, `account_id`/`transfer_id`, columnas `archived`, trigger TC ↔ deuda, 3 cuentas seed, backfill | Sí (CR01) |
| 4 | `supabase/migrations/003_push_subscriptions.sql` | Tabla de suscripciones push | Solo para Web Push (Parte 4.3) |

Notas:
- `002` y `004` se protegen solas contra doble ejecución parcial, pero ejecútalas UNA vez.
- `004` asigna todo lo ya registrado a la cuenta "Cuenta Ahorros" (default). Los casos
  puntuales se corrigen luego editando el movimiento en la app.

### 1.3 Verificar que todo quedó bien

En el SQL Editor:

```sql
-- Debe devolver: accounts=3, categories=17, debts=4, goals=4, recurring=10
select
  (select count(*) from accounts)            as accounts,
  (select count(*) from categories)          as categories,
  (select count(*) from debts)               as debts,
  (select count(*) from goals)               as goals,
  (select count(*) from recurring_payments)  as recurring;

-- La TC debe quedar vinculada a su deuda (debt_id NO nulo)
select name, type, is_default, debt_id from accounts;

-- RLS activo en todas las tablas (todas deben decir true)
select tablename, rowsecurity from pg_tables where schemaname = 'public';
```

### 1.4 Cerrar la puerta

- **Authentication → Sign In / Up** → desactiva **Allow new users to sign up**
  (la app es de un solo usuario; sin esto cualquiera podría crearse una cuenta).
- **Project Settings → API**: copia el **Project URL** y la **publishable (anon) key**.
  La `service_role` key NUNCA va en el frontend ni en Vercel — solo se usa en el paso de
  Web Push (servidor).

---

## Parte 2 — Correr en local

```bash
cd panorama
cp .env.example .env    # en Windows: copy .env.example .env
```

`.env`:

```
VITE_SUPABASE_URL=https://elavnpyuwccuwrgfbkzm.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<tu publishable/anon key>
```

```bash
npm install
npm run dev             # http://localhost:5173
```

Login con el usuario del paso 1.1. La sesión persiste (refresh token), solo se pide una vez.

---

## Parte 3 — Deploy a Vercel

### 3.1 Subir a GitHub

La carpeta `panorama/` aún no es repositorio git:

```bash
cd panorama
git init
git add .
git commit -m "Panorama PWA"
```

Crea un repo **privado** en GitHub (es tu información financiera) y:

```bash
git remote add origin https://github.com/<tu-usuario>/panorama.git
git branch -M main
git push -u origin main
```

`.gitignore` ya excluye `.env` — verifica que no aparezca en `git status` antes del push.

### 3.2 Importar en Vercel

1. [vercel.com](https://vercel.com) → **Add New → Project** → importa el repo.
2. Framework: detecta **Vite** solo. Build `npm run build`, output `dist` (defaults).
3. **Environment Variables** (las dos, para Production):
   - `VITE_SUPABASE_URL` = `https://elavnpyuwccuwrgfbkzm.supabase.co`
   - `VITE_SUPABASE_PUBLISHABLE_KEY` = la publishable key
4. **Deploy**.

El archivo `vercel.json` del repo ya trae el rewrite SPA (`/* → /index.html`); sin él,
abrir directo una ruta como `/cuentas` o recargar la PWA daría 404.

Cada `git push` a `main` redespliega automáticamente.

### 3.3 Instalar en el iPhone

1. Abre la URL de Vercel en **Safari** (no Chrome).
2. Compartir → **Agregar a pantalla de inicio**.
3. Abre desde el ícono: corre standalone, sin barra de Safari.

Esto importa para las notificaciones: en iOS, Web Push **solo** funciona en la PWA
instalada (iOS 16.4+), nunca en la pestaña de Safari.

---

## Parte 4 — Notificaciones (3 capas)

### Capa 1 — In-app (ya funciona, sin configuración)

El panel **Próximos pagos (7 días)** del inicio muestra lo que vence, con badge rojo para
hoy/mañana y botón «Pagar» que registra el pago en la cuenta default. Se alimenta de
`recurring_payments`; se gestiona desde **Inicio → Recordatorios**.

### Capa 2 — Calendario .ics (recomendada, 2 minutos)

Alertas **nativas** de iOS sin servidores ni permisos de push:

1. En la app: **Inicio → Calendario → Descargar .ics**.
2. En el iPhone: abre el archivo desde la app **Archivos** (Descargas).
3. Toca **Añadir todos** y elige tu calendario.

Cada pago activo queda como evento (los mensuales/anuales con repetición) con **dos
alarmas**: 8 AM del día anterior y 8 AM del día del pago.

**Regenerar:** el .ics se construye al momento de descargarlo, así que siempre refleja la
BD actual. Cuando cambies pagos (nueva deuda, fecha real del SOAT, etc.), descarga e
importa de nuevo. Los eventos usan UID estable por pago, así que reimportar actualiza en
vez de duplicar (si algún calendario duplicara, borra el calendario anterior e importa
limpio).

**Pendiente tuyo:** SOAT y tecnomecánica vienen del seed ancladas al 1 de enero. Ve a
**Recordatorios**, edítalas y ponles su fecha real (modo «Anual» pide la fecha completa).

### Capa 3 — Web Push (v2, opcional)

Notificación push diaria a las 8 AM (hora Bogotá) con los pagos que vencen hoy o mañana.

> **Estado actual:** el lado servidor está listo en el repo (Edge Function
> `supabase/functions/payment-reminders/index.ts` + migración `003`). El lado cliente
> (handler de push en el service worker + botón «Activar notificaciones») está documentado
> en `docs/web-push.md` pero **aún no implementado** — los pasos A–F dejan el servidor
> funcionando y el paso G describe lo que falta en el cliente.

**Requisitos iPhone:** iOS 16.4+, PWA instalada en pantalla de inicio, permiso concedido.

#### A. Generar llaves VAPID

```bash
npx web-push generate-vapid-keys
```

Guarda **Public Key** y **Private Key** (la privada jamás va al cliente ni al repo).

#### B. Crear la tabla de suscripciones

SQL Editor → ejecuta `supabase/migrations/003_push_subscriptions.sql`
(solo crea la tabla y sus policies; el bloque de cron comentado al final es para el paso E).

#### C. Instalar la CLI de Supabase y vincular el proyecto

```bash
npm install -g supabase
supabase login                                   # abre el navegador
cd panorama
supabase link --project-ref elavnpyuwccuwrgfbkzm
```

#### D. Configurar secretos y desplegar la función

```bash
supabase secrets set VAPID_PUBLIC_KEY=<publica> VAPID_PRIVATE_KEY=<privada> VAPID_SUBJECT=mailto:marloncanonotaloca@gmail.com
supabase functions deploy payment-reminders
```

Prueba manual (la `service_role` key está en Project Settings → API):

```bash
curl -X POST https://elavnpyuwccuwrgfbkzm.functions.supabase.co/payment-reminders -H "Authorization: Bearer <SERVICE_ROLE_KEY>"
```

Respuesta esperada: `{"sent":0}` si nada vence hoy/mañana (normal), o `{"sent":N,"messages":[...]}`.
`sent` será 0 hasta que exista al menos una suscripción (paso G).

#### E. Programar la ejecución diaria

1. Dashboard → **Database → Extensions** → habilita **pg_cron** y **pg_net**.
2. SQL Editor → ejecuta el bloque `cron.schedule` comentado al final de la migración `003`,
   reemplazando `<PROJECT_REF>` por `elavnpyuwccuwrgfbkzm` y `<SERVICE_ROLE_KEY>` por la tuya.

`'0 13 * * *'` = 13:00 UTC = **8:00 AM Bogotá** (Colombia no cambia de hora). Si quieres
otra hora, ajusta: hora Bogotá + 5 = hora UTC.

Verificar y administrar el job:

```sql
select jobid, jobname, schedule from cron.job;
select status, return_message, start_time from cron.job_run_details order by start_time desc limit 5;
-- para borrarlo: select cron.unschedule('payment-reminders-daily');
```

#### F. Qué hace la función cada día

Lee los `recurring_payments` activos, calcula cuáles vencen hoy/mañana (hora Bogotá),
envía la notificación a cada suscripción de `push_subscriptions` y elimina sola las
suscripciones muertas (404/410, ej. PWA desinstalada).

#### G. Lo que falta en el cliente (para cerrar el circuito)

Dos piezas, detalladas con código en `docs/web-push.md`:

1. Service worker con handler `push` — requiere pasar `vite-plugin-pwa` de `generateSW` a
   `injectManifest`.
2. Botón «Activar notificaciones» que pida permiso, se suscriba con la VAPID pública y
   guarde la suscripción en `push_subscriptions`.

Sin esto no llegan pushes, pero **las capas 1 y 2 cubren los recordatorios del MVP**.
Cuando quieras activarla, pide implementar el cliente de Web Push.

---

## Solución de problemas

| Síntoma | Causa probable | Arreglo |
|---|---|---|
| Login falla con credenciales correctas | Usuario sin confirmar | Authentication → Users → confirma el email |
| La app carga pero todo está vacío / errores en consola | Falta la migración `004` (la app pide `accounts` y `transfer_id`) | Ejecutar `004_accounts_crud.sql` |
| `002` o `004` fallan con "No hay usuario" | Migración antes de crear el usuario | Crear usuario y reejecutar |
| 404 al recargar `/cuentas` en Vercel | Falta el rewrite SPA | `vercel.json` debe estar en la raíz del repo desplegado |
| Cambié variables en Vercel y no aplica | Las env de Vite se inyectan al compilar | Redeploy (Deployments → ⋯ → Redeploy) |
| El gasto con TC no sube la deuda | La cuenta TC no tiene `debt_id` | Cuentas → editar TC → vincular deuda |
| El .ics no muestra el SOAT en su fecha | Sigue anclado al 1 de enero (seed) | Recordatorios → editar → fecha real → reimportar .ics |
| La PWA no se actualiza tras un deploy | Service worker con versión vieja | Cerrar la app del todo y reabrir (o esperar; el SW se actualiza solo) |
