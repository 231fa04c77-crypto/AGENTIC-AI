/** True when appointment is an online / video consult (not in-clinic only). */
export function isOnlineVideoAppointment(apt) {
  if (!apt) return false
  const mode = String(apt.mode || apt.visitType || '').toLowerCase()
  const pm = String(apt.paymentMethod || apt.payment_method || '').toLowerCase()
  return (
    mode.includes('online') ||
    mode.includes('video') ||
    pm.includes('razorpay') ||
    pm.includes('onlinepayment') ||
    pm === 'online' ||
    apt.payment === true
  )
}
