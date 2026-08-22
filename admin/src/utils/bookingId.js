/** Extract MedClues booking IDs (BK + 6 alphanumerics) from QR payloads. */

const BOOKING_ID_RE = /^BK[A-Z0-9]{6}$/i
const BOOKING_ID_FIND = /BK[A-Z0-9]{6}/i

export function normalizeBookingId(value) {
  return String(value || '').trim().toUpperCase()
}

export function isValidBookingId(value) {
  return BOOKING_ID_RE.test(String(value || '').trim())
}

export function looksLikeVisitSummaryPayload(raw) {
  const t = String(raw || '').trim().toLowerCase()
  if (!t) return false
  return (
    t.includes('appointment-summary') ||
    t.includes('/#/a/') ||
    t.includes('/a/bk') ||
    (t.includes('sig=') && t.includes('/a/'))
  )
}

/**
 * Pull BK…… from bare code, signed summary URL, or JSON.
 * @returns {string|null} normalized booking id
 */
export function extractBookingId(raw) {
  const text = String(raw || '').trim()
  if (!text) return null

  const direct = normalizeBookingId(text)
  if (isValidBookingId(direct)) return direct

  if (text.startsWith('{') || text.startsWith('[')) {
    try {
      const data = JSON.parse(text)
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        for (const key of ['bookingId', 'booking_id', 'code', 'id']) {
          if (data[key] != null) {
            const found = extractBookingId(String(data[key]))
            if (found) return found
          }
        }
      }
    } catch {
      /* fall through to regex */
    }
  }

  const match = text.match(BOOKING_ID_FIND)
  return match ? match[0].toUpperCase() : null
}
