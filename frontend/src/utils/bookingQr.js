/** Reception check-in QR must encode bare BK + 6 alphanumerics (same as Flutter). */

const BOOKING_ID_RE = /^BK[A-Z0-9]{6}$/i

export function normalizeBookingId(value) {
  return String(value || '').trim().toUpperCase()
}

export function isValidBookingId(value) {
  return BOOKING_ID_RE.test(String(value || '').trim())
}

/**
 * Prefer bookingId for reception scan; otherwise null (never invent verify/raw ids).
 */
export function checkInQrPayload(item) {
  const raw =
    item?.bookingId ||
    item?.booking_id ||
    item?.appointment?.bookingId ||
    item?.appointment?.booking_id ||
    ''
  const code = normalizeBookingId(raw)
  return isValidBookingId(code) ? code : null
}

/** Visit-summary QR when completed; otherwise bare BK for check-in. */
export function appointmentQrPayload(item) {
  const completed = !!(item?.isCompleted || item?.is_completed)
  const life = String(item?.lifecycleStatus || item?.lifecycle_status || '').toUpperCase()
  const summary =
    item?.summaryQrUrl || item?.summary_qr_url || item?.summaryUrl || ''
  if (completed || life === 'COMPLETED' || life === 'CLOSED') {
    if (summary && String(summary).startsWith('http')) return String(summary)
  }
  return checkInQrPayload(item)
}

export function verifyAppointmentUrl(appointmentId) {
  if (appointmentId == null || appointmentId === '') return null
  const base = typeof window !== 'undefined' ? window.location.origin : ''
  return `${base}/verify-appointment?id=${appointmentId}`
}
