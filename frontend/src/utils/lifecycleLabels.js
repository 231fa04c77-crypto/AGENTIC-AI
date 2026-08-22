/**
 * Shared appointment lifecycle display labels (web + admin parity).
 * Prefer lifecycleStatus / lifecycle_status over legacy status.
 */

const LIFECYCLE_LABELS = {
  BOOKED: 'Booked',
  PENDING: 'Pending',
  CONFIRMED: 'Confirmed',
  CHECKED_IN: 'Checked in',
  IN_QUEUE: 'Checked in',
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
  FOLLOWUP_AVAILABLE: 'Follow-up available',
  FOLLOWUP_USED: 'Follow-up used',
  FOLLOWUP_EXPIRED: 'Follow-up expired',
  // Legacy aliases
  FOLLOWUP_PENDING: 'Follow-up available',
  FOLLOWUP_BOOKED: 'Follow-up used',
  FOLLOWUP_COMPLETED: 'Follow-up used',
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

export function labelForLifecycle(status) {
  if (status == null || status === '') return 'Unknown'
  const raw = String(status).trim()
  if (LIFECYCLE_LABELS[raw]) return LIFECYCLE_LABELS[raw]
  const upper = raw.toUpperCase().replace(/-/g, '_')
  if (LIFECYCLE_LABELS[upper]) return LIFECYCLE_LABELS[upper]
  if (upper.startsWith('REFUND_')) return 'Refund pending'
  return raw.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export function labelForAppointment(item) {
  if (!item) return 'Unknown'
  if (item.cancelled) return 'Cancelled'
  const life = item.lifecycleStatus || item.lifecycle_status
  if (life) return labelForLifecycle(life)
  if (item.isCompleted || item.is_completed) return 'Completed'
  if (item.status) return labelForLifecycle(item.status)
  return 'Active'
}
