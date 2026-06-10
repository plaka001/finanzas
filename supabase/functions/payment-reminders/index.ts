// Edge Function: recordatorios de pagos por Web Push.
// Se invoca a diario (pg_cron, 8 AM Bogotá) y notifica los pagos que vencen
// hoy o mañana a todas las suscripciones registradas.
// Setup completo en docs/web-push.md. Deploy: supabase functions deploy payment-reminders

import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3'

interface RecurringPayment {
  id: string
  name: string
  amount: number | null
  due_day: number | null
  due_date: string | null
  frequency: 'monthly' | 'once' | 'yearly'
  active: boolean
}

function formatCOP(amount: number): string {
  return `$${amount.toLocaleString('es-CO')}`
}

/** ¿El pago vence en la fecha dada? (misma convención que el cliente) */
function dueOn(p: RecurringPayment, date: Date): boolean {
  const iso = date.toISOString().slice(0, 10)
  if (p.frequency === 'once') return p.due_date === iso
  if (p.frequency === 'monthly' && p.due_day) {
    const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
    return date.getDate() === Math.min(p.due_day, lastDay)
  }
  if (p.frequency === 'yearly' && p.due_date) {
    const anchor = new Date(p.due_date)
    return date.getDate() === anchor.getDate() && date.getMonth() === anchor.getMonth()
  }
  return false
}

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  webpush.setVapidDetails(
    Deno.env.get('VAPID_SUBJECT') ?? 'mailto:notificaciones@panorama.app',
    Deno.env.get('VAPID_PUBLIC_KEY')!,
    Deno.env.get('VAPID_PRIVATE_KEY')!,
  )

  const { data: payments, error } = await supabase
    .from('recurring_payments')
    .select('id, name, amount, due_day, due_date, frequency, active')
    .eq('active', true)
  if (error) return new Response(error.message, { status: 500 })

  // Hoy en Bogotá (UTC-5, sin horario de verano)
  const now = new Date(Date.now() - 5 * 60 * 60 * 1000)
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)

  const messages: string[] = []
  for (const p of (payments ?? []) as RecurringPayment[]) {
    const monto = p.amount ? ` — ${formatCOP(p.amount)}` : ''
    if (dueOn(p, today)) messages.push(`Hoy vence: ${p.name}${monto}`)
    else if (dueOn(p, tomorrow)) messages.push(`Mañana vence: ${p.name}${monto}`)
  }

  if (messages.length === 0) {
    return new Response(JSON.stringify({ sent: 0 }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')

  let sent = 0
  for (const sub of subs ?? []) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify({
          title: 'Panorama — pagos próximos',
          body: messages.join('\n'),
        }),
      )
      sent++
    } catch (err) {
      // 404/410: la suscripción ya no existe (PWA desinstalada) — limpiarla
      const status = (err as { statusCode?: number }).statusCode
      if (status === 404 || status === 410) {
        await supabase.from('push_subscriptions').delete().eq('id', sub.id)
      }
    }
  }

  return new Response(JSON.stringify({ sent, messages }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
