/** Human-readable appointment ID (APT202600001). */
export function getAppointmentPublicId(item) {
  return item?.publicId || item?.public_id || null
}

/** Patient display name for doctor views. */
export function getPatientName(item) {
  if (!item) return 'Patient'
  const ap = item.actualPatient
  const userName = item.userData?.name
  if (ap && !ap.isSelf && ap.name) return ap.name
  if (userName) return userName
  if (ap?.name) return ap.name
  return 'Patient'
}

/** Patient age — never returns "N/A". */
export function getPatientAge(item, calculateAge) {
  if (!item) return '—'
  if (item.patientAge != null && item.patientAge !== '') {
    return String(item.patientAge)
  }
  const ap = item.actualPatient
  if (ap && !ap.isSelf && ap.age != null && ap.age !== '') {
    return String(ap.age)
  }
  if (item.userData?.age != null && item.userData.age !== '') {
    return String(item.userData.age)
  }
  const fromDob = calculateAge?.(item.userData?.dob)
  if (fromDob != null && fromDob !== '' && fromDob !== 'N/A') {
    return String(fromDob)
  }
  if (ap?.age != null && ap.age !== '') {
    return String(ap.age)
  }
  return '—'
}

export function getPatientImage(item) {
  const name = getPatientName(item)
  if (item?.userData?.image) return item.userData.image
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=667eea&color=fff`
}
