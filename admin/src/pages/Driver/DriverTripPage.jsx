import React, { useEffect, useRef, useState } from 'react'
import axios from 'axios'

/**
 * DriverTripPage — One-tap mobile-first interface for ambulance drivers.
 *
 * Mounted at: /driver-trip?token=<driver_trip_token>
 * NO LOGIN REQUIRED — the secure token from the SMS/WhatsApp link acts as the credential.
 *
 * Features:
 *  - Shows patient details, pickup location, emergency type
 *  - "Start Journey" button starts GPS tracking AND advances status to AMBULANCE_STARTED
 *  - Status action button advances case through full workflow via triptoken auth
 *  - Live GPS pings backend so patient can track the ambulance
 */

const API = import.meta.env.VITE_BACKEND_URL || ''

const STATUS_COLORS = {
  AMBULANCE_ASSIGNED: { bg: 'from-red-500 to-orange-500',     text: 'Dispatch Received — Please Respond' },
  AMBULANCE_STARTED:  { bg: 'from-indigo-600 to-violet-600',  text: 'En Route to Patient' },
  PATIENT_PICKED:     { bg: 'from-purple-600 to-pink-600',    text: 'Patient On Board — Drive to Hospital' },
  HOSPITAL_REACHED:   { bg: 'from-teal-600 to-emerald-600',   text: 'Arrived at Hospital' },
  TREATMENT_STARTED:  { bg: 'from-cyan-600 to-blue-600',      text: 'Treatment in Progress' },
  COMPLETED:          { bg: 'from-green-500 to-emerald-500',  text: 'Trip Completed ✓' },
}

// Maps each status to what the next action button should say and what status it transitions to
const NEXT_ACTION = {
  AMBULANCE_ASSIGNED: { label: '🚦 Start Journey',       next: 'AMBULANCE_STARTED', startGps: true },
  AMBULANCE_STARTED:  { label: '🛏️ Patient Picked Up',  next: 'PATIENT_PICKED' },
  PATIENT_PICKED:     { label: '🏥 Reached Hospital',    next: 'HOSPITAL_REACHED' },
  HOSPITAL_REACHED:   { label: '💊 Treatment Started',   next: 'TREATMENT_STARTED' },
  TREATMENT_STARTED:  { label: '✅ Mark Complete',        next: 'COMPLETED' },
}

const DriverTripPage = () => {
  const params = new URLSearchParams(window.location.search)
  const token = params.get('token') || ''

  const [trip, setTrip]             = useState(null)
  const [error, setError]           = useState('')
  const [loading, setLoading]       = useState(true)
  const [tracking, setTracking]     = useState(false)
  const [geoError, setGeoError]     = useState('')
  const [updating, setUpdating]     = useState(false)
  const [updateMsg, setUpdateMsg]   = useState('')
  const watchIdRef                  = useRef(null)

  const authHeader = { authorization: `triptoken ${token}` }

  useEffect(() => {
    if (!token) { setError('No trip token found. Please use the link sent to your phone.'); setLoading(false); return }
    axios.get(`${API}/api/dispatch/driver-trip/${token}`)
      .then(r => { setTrip(r.data.data); setLoading(false) })
      .catch(e => { setError(e?.response?.data?.detail || 'Trip not found or link expired.'); setLoading(false) })
  }, [token])

  // ── GPS Tracking ────────────────────────────────────────────────────────────
  const startTracking = (caseId) => {
    if (!navigator.geolocation) { setGeoError('GPS not available on this device.'); return }
    if (watchIdRef.current != null) return // already tracking
    setTracking(true)
    const id = navigator.geolocation.watchPosition(
      async (pos) => {
        try {
          await axios.post(`${API}/api/dispatch/operator/ping`, {
            latitude:  pos.coords.latitude,
            longitude: pos.coords.longitude,
            speed_kmh: pos.coords.speed != null ? pos.coords.speed * 3.6 : null,
            heading:   pos.coords.heading,
            case_id:   caseId || trip?.case_id,
          }, { headers: authHeader })
        } catch { /* silent — pings are best-effort */ }
      },
      (err) => setGeoError(err.message),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    )
    watchIdRef.current = id
  }

  // ── Status Update ────────────────────────────────────────────────────────────
  const handleStatusAction = async () => {
    if (!trip || updating) return
    const action = NEXT_ACTION[trip.case_status]
    if (!action) return

    setUpdating(true)
    setUpdateMsg('')
    try {
      await axios.post(
        `${API}/api/dispatch/operator/status`,
        { case_id: trip.case_id, status: action.next },
        { headers: authHeader }
      )
      // Auto-start GPS when journey begins
      if (action.startGps) startTracking(trip.case_id)
      // Refresh trip data
      const r = await axios.get(`${API}/api/dispatch/driver-trip/${token}`)
      setTrip(r.data.data)
      setUpdateMsg(`Status updated to ${action.next.replace(/_/g, ' ')}`)
    } catch (e) {
      setUpdateMsg(e?.response?.data?.detail || 'Failed to update status. Please try again.')
    } finally {
      setUpdating(false)
    }
  }

  // ── Navigation ───────────────────────────────────────────────────────────────
  const openNavigation = () => {
    if (!trip) return
    const url = trip.maps_nav_url ||
      `https://www.google.com/maps/dir/?api=1&destination=${trip.pickup_lat},${trip.pickup_lon}&travelmode=driving`
    window.open(url, '_blank')
  }

  const statusInfo = STATUS_COLORS[trip?.case_status] || STATUS_COLORS['AMBULANCE_ASSIGNED']
  const nextAction = trip ? NEXT_ACTION[trip.case_status] : null

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="text-center text-white space-y-4">
        <div className="w-12 h-12 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm font-semibold text-gray-300">Loading your trip…</p>
      </div>
    </div>
  )

  if (error) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
      <div className="text-center max-w-sm">
        <p className="text-5xl mb-4">🔗</p>
        <h2 className="text-white font-bold text-xl mb-2">Link Invalid</h2>
        <p className="text-gray-400 text-sm">{error}</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-950 text-white pb-8" style={{ fontFamily: "'Inter', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap" rel="stylesheet" />

      {/* Status Banner */}
      <div className={`bg-gradient-to-r ${statusInfo.bg} px-6 py-5 safe-area-top`}>
        <div className="max-w-md mx-auto">
          <div className="flex items-center gap-3 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-white animate-pulse" />
            <span className="text-white/80 text-xs font-bold uppercase tracking-widest">MEDCLUES DISPATCH</span>
          </div>
          <h1 className="text-white font-black text-2xl leading-tight">{statusInfo.text}</h1>
          <p className="text-white/70 text-xs mt-1 font-mono">{trip?.case_id}</p>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 space-y-4 mt-5">

        {/* Patient Info Card */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-3">
          <p className="text-gray-400 text-xs font-bold uppercase tracking-wider">Patient Details</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-gray-500 text-xs">Name</p>
              <p className="text-white font-bold text-sm">{trip?.patient_name || '—'}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs">Emergency</p>
              <p className="text-white font-bold text-sm">{trip?.emergency_type || '—'}</p>
            </div>
            <div className="col-span-2">
              <p className="text-gray-500 text-xs">Pickup Address</p>
              <p className="text-white font-semibold text-sm">{trip?.pickup_address || `${trip?.pickup_lat}, ${trip?.pickup_lon}`}</p>
            </div>
            {trip?.hospital_name && (
              <div className="col-span-2">
                <p className="text-gray-500 text-xs">Destination Hospital</p>
                <p className="text-white font-semibold text-sm">{trip.hospital_name}</p>
              </div>
            )}
          </div>
        </div>

        {/* ── Primary Action Button (status transition) ─────────────────────── */}
        {nextAction ? (
          <button
            onClick={handleStatusAction}
            disabled={updating}
            className={`w-full py-5 rounded-2xl font-black text-lg shadow-lg active:scale-95 transition-all flex items-center justify-center gap-3
              ${updating
                ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white shadow-emerald-900/30'
              }`}
          >
            {updating ? (
              <>
                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Updating…
              </>
            ) : (
              <>
                <span className="text-2xl">{nextAction.label.split(' ')[0]}</span>
                {nextAction.label.split(' ').slice(1).join(' ')}
              </>
            )}
          </button>
        ) : trip?.case_status === 'COMPLETED' ? (
          <div className="w-full py-5 bg-gradient-to-r from-green-600 to-emerald-600 rounded-2xl font-black text-lg text-white text-center shadow-lg">
            🎉 Trip Completed Successfully
          </div>
        ) : null}

        {/* Status feedback message */}
        {updateMsg && (
          <p className={`text-center text-sm font-semibold ${updateMsg.includes('Failed') ? 'text-red-400' : 'text-emerald-400'}`}>
            {updateMsg}
          </p>
        )}

        {/* Navigation Button */}
        <button
          onClick={openNavigation}
          className="w-full py-4 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-white rounded-2xl font-bold text-base shadow active:scale-95 transition-all flex items-center justify-center gap-3"
        >
          <span className="text-xl">🗺️</span>
          Open Navigation in Maps
        </button>

        {/* GPS Tracking Toggle */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white font-bold text-sm">Live GPS Tracking</p>
              <p className="text-gray-500 text-xs mt-0.5">
                {tracking ? 'Your location is being shared live' : 'Share your location with the patient & hospital'}
              </p>
            </div>
            {tracking ? (
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-emerald-400 text-xs font-bold">ACTIVE</span>
              </div>
            ) : (
              <button
                onClick={() => startTracking(trip?.case_id)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition active:scale-95"
              >
                Enable
              </button>
            )}
          </div>
          {geoError && <p className="text-red-400 text-xs mt-2">⚠️ {geoError}</p>}
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3">
          <a
            href={`https://www.google.com/maps?q=${trip?.pickup_lat},${trip?.pickup_lon}`}
            target="_blank" rel="noreferrer"
            className="py-4 bg-gray-900 border border-gray-800 hover:border-gray-600 rounded-2xl flex flex-col items-center justify-center gap-2 text-sm font-bold text-gray-300 transition active:scale-95"
          >
            <span className="text-2xl">📍</span>
            View Pickup
          </a>
          <a
            href={`tel:${trip?.patient_phone}`}
            className="py-4 bg-gray-900 border border-gray-800 hover:border-gray-600 rounded-2xl flex flex-col items-center justify-center gap-2 text-sm font-bold text-gray-300 transition active:scale-95"
          >
            <span className="text-2xl">📞</span>
            Call Patient
          </a>
        </div>

        {/* Footer */}
        <p className="text-center text-gray-600 text-xs pt-2">
          MEDCLUES Emergency Network · This link is single-use and secure
        </p>
      </div>
    </div>
  )
}

export default DriverTripPage
