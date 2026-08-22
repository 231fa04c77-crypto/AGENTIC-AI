import React, { useState, useCallback } from 'react'
import { triggerEmergency, getEmergencyStatus, cancelEmergency, clearActiveCase } from '@/lib/medclues'

/**
 * SOSButton — Drop-in emergency button for the SHAMS app.
 *
 * Props:
 *  - patientName   {string} User's display name
 *  - patientPhone  {string} User's phone number
 *  - locationText  {string} Human-readable location (e.g. pickup address)
 *  - additionalInfo {Object} Extra data (tripId, vehicleType, etc.)
 *
 * Usage:
 *  <SOSButton patientName={user.name} patientPhone={user.phone}
 *    locationText="Hitech City, Hyderabad" additionalInfo={{ tripId: trip.id }} />
 */

const STATUS_LABELS = {
  CREATED:             '🔵 Emergency Registered',
  HOSPITAL_ASSIGNED:   '🏥 Hospital Located',
  HOSPITAL_ACCEPTED:   '✅ Hospital Ready',
  AMBULANCE_ASSIGNED:  '🚑 Ambulance Assigned',
  AMBULANCE_STARTED:   '🚑 Ambulance On Way',
  PATIENT_PICKED:      '🛏 Patient Picked Up',
  HOSPITAL_REACHED:    '🏥 Reached Hospital',
  TREATMENT_STARTED:   '💊 Treatment Started',
  COMPLETED:           '✅ Emergency Resolved',
  CANCELLED:           '❌ Emergency Cancelled',
}

const STATUS_COLOURS = {
  CREATED:             'bg-blue-50   border-blue-300   text-blue-800',
  HOSPITAL_ASSIGNED:   'bg-indigo-50 border-indigo-300 text-indigo-800',
  HOSPITAL_ACCEPTED:   'bg-teal-50   border-teal-300   text-teal-800',
  AMBULANCE_ASSIGNED:  'bg-orange-50 border-orange-300 text-orange-800',
  AMBULANCE_STARTED:   'bg-orange-50 border-orange-300 text-orange-800',
  PATIENT_PICKED:      'bg-purple-50 border-purple-300 text-purple-800',
  HOSPITAL_REACHED:    'bg-purple-50 border-purple-300 text-purple-800',
  TREATMENT_STARTED:   'bg-emerald-50 border-emerald-300 text-emerald-800',
  COMPLETED:           'bg-green-50  border-green-300  text-green-800',
  CANCELLED:           'bg-red-50    border-red-300    text-red-800',
}

export default function SOSButton({ patientName, patientPhone, locationText, additionalInfo = {} }) {
  const [phase, setPhase] = useState('idle')   // idle | confirming | loading | active | error
  const [caseData, setCaseData] = useState(null)
  const [error, setError] = useState(null)
  const [polling, setPolling] = useState(false)

  // ── Get GPS ──────────────────────────────────────────────────────────────
  const getGPS = () =>
    new Promise((resolve, reject) =>
      navigator.geolocation.getCurrentPosition(
        p => resolve({ latitude: p.coords.latitude, longitude: p.coords.longitude }),
        err => reject(new Error(`GPS error: ${err.message}`)),
        { timeout: 8000, enableHighAccuracy: true }
      )
    )

  // ── Trigger SOS ──────────────────────────────────────────────────────────
  const handleSOS = useCallback(async () => {
    if (phase === 'confirming') {
      setPhase('loading')
      setError(null)
      try {
        const { latitude, longitude } = await getGPS()
        const data = await triggerEmergency({
          patientName, patientPhone, latitude, longitude,
          locationText, additionalInfo,
        })
        setCaseData(data)
        setPhase('active')
        startPolling(data.case_id)
      } catch (err) {
        setError(err.message)
        setPhase('error')
      }
    } else if (phase === 'idle') {
      setPhase('confirming')
    }
  }, [phase, patientName, patientPhone, locationText, additionalInfo])

  // ── Status polling ───────────────────────────────────────────────────────
  const startPolling = useCallback((caseId) => {
    if (polling) return
    setPolling(true)
    const interval = setInterval(async () => {
      try {
        const status = await getEmergencyStatus(caseId)
        setCaseData(status)
        if (['COMPLETED', 'CANCELLED'].includes(status.status)) {
          clearInterval(interval)
          setPolling(false)
          if (status.status === 'COMPLETED') {
            setTimeout(() => { clearActiveCase(); setPhase('idle') }, 5000)
          }
        }
      } catch { /* silent — keep polling */ }
    }, 8000)
  }, [polling])

  // ── Cancel ───────────────────────────────────────────────────────────────
  const handleCancel = useCallback(async () => {
    if (!caseData?.case_id) return
    try {
      await cancelEmergency(caseData.case_id, 'Cancelled by user via SHAMS app')
      setCaseData(p => ({ ...p, status: 'CANCELLED' }))
      setPhase('idle')
    } catch (err) {
      alert(`Cancel failed: ${err.message}`)
    }
  }, [caseData])

  // ── Render ───────────────────────────────────────────────────────────────
  if (phase === 'active' && caseData) {
    const statusLabel = STATUS_LABELS[caseData.status] || caseData.status
    const statusColour = STATUS_COLOURS[caseData.status] || 'bg-gray-50 border-gray-300 text-gray-800'
    return (
      <div className="fixed inset-x-4 bottom-20 z-50 bg-white rounded-2xl shadow-2xl border border-red-200 overflow-hidden">
        <div className="bg-red-600 px-4 py-3 flex items-center justify-between">
          <span className="text-white font-bold text-sm">🚨 MEDCLUES Emergency Active</span>
          <span className="text-red-200 text-xs font-mono">{caseData.case_id}</span>
        </div>
        <div className="p-4">
          <div className={`mb-3 px-3 py-2 rounded-xl border text-sm font-semibold ${statusColour}`}>
            {statusLabel}
          </div>
          {caseData.hospital_name && (
            <div className="mb-2 text-xs text-gray-600">
              <span className="font-semibold">Hospital: </span>{caseData.hospital_name}
              {caseData.ambulance_eta_minutes && (
                <span className="ml-2 text-orange-600 font-semibold">
                  ~{caseData.ambulance_eta_minutes} min ETA
                </span>
              )}
            </div>
          )}
          {caseData.tracking_url && (
            <a href={caseData.tracking_url} target="_blank" rel="noreferrer"
              className="block mb-3 text-xs text-blue-600 hover:underline font-mono truncate">
              {caseData.tracking_url}
            </a>
          )}
          {!['COMPLETED', 'CANCELLED', 'PATIENT_PICKED', 'HOSPITAL_REACHED', 'TREATMENT_STARTED'].includes(caseData.status) && (
            <button onClick={handleCancel}
              className="w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-semibold transition">
              Cancel Emergency
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="relative">
      {/* Confirmation overlay */}
      {phase === 'confirming' && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm pb-10">
          <div className="bg-white rounded-2xl shadow-2xl p-6 mx-4 w-full max-w-sm">
            <h3 className="text-lg font-bold text-gray-900 mb-2">🚨 Confirm Emergency</h3>
            <p className="text-sm text-gray-600 mb-4">
              MEDCLUES will immediately dispatch the nearest ambulance to your location.
              Only confirm if this is a real emergency.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setPhase('idle')}
                className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition">
                Cancel
              </button>
              <button onClick={handleSOS}
                className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition">
                🚨 YES, Emergency!
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SOS Button */}
      <button
        onClick={handleSOS}
        disabled={phase === 'loading'}
        className={`
          relative w-20 h-20 rounded-full font-bold text-white text-xs
          flex flex-col items-center justify-center gap-0.5
          shadow-lg transition-all duration-200
          ${phase === 'loading'
            ? 'bg-orange-400 animate-pulse cursor-not-allowed'
            : 'bg-red-600 hover:bg-red-700 active:scale-95 active:shadow-inner'
          }
        `}
        aria-label="Emergency SOS"
      >
        {phase === 'loading' ? (
          <>
            <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
            <span className="text-[10px] mt-1">Calling…</span>
          </>
        ) : (
          <>
            <span className="text-2xl">🆘</span>
            <span className="text-[10px] font-bold tracking-widest">SOS</span>
          </>
        )}
      </button>

      {/* Error toast */}
      {phase === 'error' && error && (
        <div className="fixed bottom-24 left-4 right-4 z-50 bg-red-50 border border-red-200 rounded-xl p-3 shadow-lg">
          <p className="text-sm font-bold text-red-700">Emergency failed: {error}</p>
          <button onClick={() => setPhase('idle')} className="text-xs text-red-500 hover:underline mt-1">Dismiss</button>
        </div>
      )}
    </div>
  )
}
