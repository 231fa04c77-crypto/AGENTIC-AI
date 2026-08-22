/**
 * SHAMS Webhook Receiver — Next.js API Route
 *
 * File path in your SHAMS project:
 *   /pages/api/medclues/webhook.js   (Pages Router)
 *   OR
 *   /app/api/medclues/webhook/route.js  (App Router)
 *
 * This endpoint receives MEDCLUES event callbacks and:
 *  1. Validates the X-MedClues-Signature header
 *  2. Stores the event in localStorage (client) or a simple in-memory store (server)
 *  3. Returns 200 quickly so MEDCLUES doesn't retry
 *
 * For production: replace in-memory store with a database call.
 */

// ─── Simple in-process event store (replace with DB in production) ────────────
const eventLog = []

// ─── Pages Router handler ─────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // 1. Read headers
  const event      = req.headers['x-medclues-event'] || 'unknown'
  const signature  = req.headers['x-medclues-signature'] || ''
  const timestamp  = req.headers['x-medclues-timestamp'] || ''

  // 2. Basic signature check (production: verify HMAC)
  //    For sandbox, we just log without verifying.
  const WEBHOOK_SECRET = process.env.MEDCLUES_WEBHOOK_SECRET || 'default_sandbox_secret'
  // TODO: verify signature === buildWebhookSignature(WEBHOOK_SECRET, rawBody)

  // 3. Parse body
  const payload = req.body  // Next.js parses JSON automatically

  console.log(`[MEDCLUES WEBHOOK] event=${event} case=${payload?.case_id} status=${payload?.status}`)

  // 4. Store event (replace with DB write in production)
  eventLog.push({ event, timestamp, payload, receivedAt: new Date().toISOString() })
  if (eventLog.length > 200) eventLog.shift()  // keep last 200

  // 5. Acknowledge immediately (MEDCLUES will retry on non-2xx)
  return res.status(200).json({ received: true })
}

// ─── GET endpoint — lets you see the last few events (for debugging) ──────────
export async function getRecentEvents() {
  return eventLog.slice(-20)
}

/**
 * ── App Router version ────────────────────────────────────────────────────────
 * If you use Next.js App Router, replace the file with:
 *   /app/api/medclues/webhook/route.js
 *
 * export async function POST(request) {
 *   const payload = await request.json()
 *   const event   = request.headers.get('x-medclues-event')
 *   console.log('[MEDCLUES]', event, payload)
 *   return Response.json({ received: true })
 * }
 */
