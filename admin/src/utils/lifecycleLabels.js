/**
 * Shared M3 appointment lifecycle display labels.
 * Maps canonical lifecycle / legacy status strings to UI copy.
 * Does not change API payloads — display only.
 */
const LIFECYCLE_LABELS = {
  BOOKED: 'Booked',
  PENDING: 'Pending',
  CONFIRMED: 'Confirmed',
  CHECKED_IN: 'Checked in',
  IN_QUEUE: 'Checked in', // desk alias of CHECKED_IN
  READY_FOR_DOCTOR: 'Ready for doctor',
  IN_PROGRESS: 'In progress',
  IN_CONSULTATION: 'In progress',
  COMPLETED: 'Completed',
  CLOSED: 'Closed',
  NO_SHOW: 'No show',
  CANCELLED: 'Cancelled',
  REFUND_PENDING: 'Refund pending',
  REFUNDED: 'Refunded',
  EXPIRED: 'Expired',
  MISSED: 'Missed',
  RESCHEDULED_ONCE: 'Rescheduled',
  // Canonical follow-up states (appointment_lifecycle_service)
  FOLLOWUP_AVAILABLE: 'Follow-up available',
  FOLLOWUP_USED: 'Follow-up used',
  FOLLOWUP_EXPIRED: 'Follow-up expired',
  // Legacy aliases (older UI / docs)
  FOLLOWUP_PENDING: 'Follow-up available',
  FOLLOWUP_BOOKED: 'Follow-up used',
  FOLLOWUP_COMPLETED: 'Follow-up used',
  // Legacy hyphenated / lowercase status values
  booked: 'Booked',
  pending: 'Pending',
  confirmed: 'Confirmed',
  'in-queue': 'Checked in',
  'in-consult': 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
  missed: 'Missed',
  'no-show': 'No show',
}

/**
 * @param {string | null | undefined} status
 * @returns {string}
 */
export function labelForLifecycle(status) {
  if (status == null || status === '') return 'Unknown'
  const raw = String(status).trim()
  if (LIFECYCLE_LABELS[raw]) return LIFECYCLE_LABELS[raw]
  const upper = raw.toUpperCase().replace(/-/g, '_')
  if (LIFECYCLE_LABELS[upper]) return LIFECYCLE_LABELS[upper]
  if (upper.startsWith('REFUND_')) return 'Refund pending'
  return raw.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

/** Display label for an appointment row (lifecycle preferred over cancelled/completed flags). */
export function labelForAppointment(item) {
  if (!item) return 'Unknown'
  if (item.cancelled) return 'Cancelled'
  const life = item.lifecycleStatus || item.lifecycle_status
  if (life) return labelForLifecycle(life)
  if (item.isCompleted) return 'Completed'
  if (item.status) return labelForLifecycle(item.status)
  return 'Active'
}

/**
 * Payment display — never map unpaid → "CASH".
 * Uses paymentMethod + payment / paidAtBooking flags.
 */
export function paymentLabelForAppointment(item) {
  if (!item) return 'Pending'
  const paid = !!(item.payment || item.paidAtBooking || item.paid_at_booking)
  const m = String(item.paymentMethod || item.payment_method || '').toLowerCase()
  if (paid) {
    if (m.includes('razor') || m.includes('online') || m.includes('upi')) return 'Online Paid'
    if (m.includes('cash')) return 'Cash Paid'
    if (m.includes('card')) return 'Card Paid'
    return 'Paid'
  }
  if (m.includes('visit') || m.includes('clinic') || m.includes('cash')) return 'Pay at Visit'
  if (m.includes('razor') || m.includes('online') || m.includes('upi')) return 'Online Pending'
  return 'Pending'
}
