/** Map GET /api/doctor/:id/slots response to Appointment.jsx docSlots shape. */

function parseSlotDate(slotDate) {
  const parts = String(slotDate).split('_')
  if (parts.length !== 3) return new Date()
  const day = parseInt(parts[0], 10)
  const month = parseInt(parts[1], 10) - 1
  const year = parseInt(parts[2], 10)
  return new Date(year, month, day)
}

export function mapScheduleToDocSlots(apiData, mode) {
  if (!apiData?.success || !apiData.days?.length) return []

  return apiData.days.map((day) => {
    const datetime = parseSlotDate(day.slotDate)
    if (mode === 'online') {
      return (day.slots || []).map((s) => ({
        datetime,
        time: s.display,
        display: s.display,
        slotDate: day.slotDate,
        slot_id: s.slot_id,
        slot_type: 'video',
        mode: 'online',
        available: s.available !== false,
      }))
    }
    return (day.blocks || []).map((b) => ({
      datetime,
      time: b.display,
      display: b.display,
      slotDate: day.slotDate,
      slot_id: b.slot_id || b.representative_slot_id,
      slot_type: b.slot_type,
      mode: 'offline',
      bookingsRemaining: b.available_count,
      totalCount: b.total_count,
      available: b.bookable !== false,
    }))
  })
}

export function consultationFee(docInfo, mode) {
  if (!docInfo) return 0
  if (mode === 'online') {
    return docInfo.videoConsultationFee ?? docInfo.video_consultation_fee ?? 450
  }
  return docInfo.fees ?? 600
}
