import React, { useState, useEffect, useRef, useCallback } from 'react'
import axios from 'axios'

/**
 * AmbulanceDashboard — mobile-first portal for ambulance drivers.
 * Standalone page (not inside the admin shell) — opened via a direct URL.
 *
 * Mounts at: /ambulance-dashboard
 * Auth: operator username / password → JWT token stored in sessionStorage
 */

const API = import.meta.env.VITE_BACKEND_URL || ''

const TRANSITION_LABELS = {
  AMBULANCE_STARTED: '🚦 Start Journey',
  PATIENT_PICKED:    '🛏 Patient Picked Up',
  HOSPITAL_REACHED:  '🏥 Reached Hospital',
  TREATMENT_STARTED: '💊 Treatment Started',
  COMPLETED:         '✅ Mark Complete',
}

const AmbulanceDashboard = () => {
  const [screen, setScreen] = useState('login') // login | dashboard
  const [token, setToken] = useState(() => sessionStorage.getItem('op_token') || '')
  const [ambInfo, setAmbInfo] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('amb_info') || 'null') } catch { return null }
  })
  const [currentCase, setCurrentCase] = useState(null)
  const [loginForm, setLoginForm] = useState({ username: '', password: '' })
  const [loginError, setLoginError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [advancing, setAdvancing] = useState(false)
  const geoWatchRef = useRef(null)

  // ── On mount: if token exists, go to dashboard ────────────────────────────
  useEffect(() => {
    if (token) { setScreen('dashboard'); fetchCase() }
  }, [])

  // ── Login ─────────────────────────────────────────────────────────────────
  const handleLogin = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setLoginError('')
    try {
      const { data } = await axios.post(`${API}/api/dispatch/operator/login`, loginForm)
      if (data.success) {
        sessionStorage.setItem('op_token', data.token)
        sessionStorage.setItem('amb_info', JSON.stringify({
          ambulance_id: data.ambulance_id,
          vehicle_number: data.vehicle_number,
        }))
        setToken(data.token)
        setAmbInfo({ ambulance_id: data.ambulance_id, vehicle_number: data.vehicle_number })
        setScreen('dashboard')
        fetchCase(data.token)
      }
    } catch (err) {
      setLoginError(err?.response?.data?.detail || 'Login failed')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Fetch current assigned case ───────────────────────────────────────────
  const fetchCase = useCallback(async (tok = token) => {
    if (!tok) return
    try {
      const { data } = await axios.get(`${API}/api/dispatch/operator/case`, {
        headers: { Authorization: `Bearer ${tok}` }
      })
      setCurrentCase(data.data || null)
    } catch (err) {
      if (err.response?.status === 401) {
        handleLogout()
      }
    }
  }, [token])

  // Auto-poll every 12 seconds
  useEffect(() => {
    if (screen !== 'dashboard') return
    const interval = setInterval(() => fetchCase(), 12000)
    return () => clearInterval(interval)
  }, [screen, fetchCase])

  // ── GPS tracking ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (screen !== 'dashboard' || !token) return
    if (!navigator.geolocation) return

    geoWatchRef.current = navigator.geolocation.watchPosition(
      async (pos) => {
        try {
          await axios.post(
            `${API}/api/dispatch/operator/ping`,
            {
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              speed_kmh: pos.coords.speed ? pos.coords.speed * 3.6 : null,
              heading: pos.coords.heading,
              case_id: currentCase?.public_id || null,
            },
            { headers: { Authorization: `Bearer ${token}` } }
          )
        } catch { /* silent */ }
      },
      null,
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    )

    return () => {
      if (geoWatchRef.current !== null) {
        navigator.geolocation.clearWatch(geoWatchRef.current)
      }
    }
  }, [screen, token, currentCase])

  // ── Advance status ────────────────────────────────────────────────────────
  const advanceStatus = async (status) => {
    if (!currentCase) return
    setAdvancing(true)
    try {
      await axios.post(
        `${API}/api/dispatch/operator/status`,
        { case_id: currentCase.public_id, status },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      await fetchCase()
    } catch (err) {
      alert(err?.response?.data?.detail || 'Failed to update status')
    } finally {
      setAdvancing(false)
    }
  }

  const handleLogout = () => {
    sessionStorage.clear()
    setToken('')
    setScreen('login')
    setCurrentCase(null)
  }

  // ── What next status can the operator set? ────────────────────────────────
  const getNextActions = (status) => {
    const flow = ['AMBULANCE_STARTED', 'PATIENT_PICKED', 'HOSPITAL_REACHED', 'TREATMENT_STARTED', 'COMPLETED']
    const current_idx = flow.findIndex(s => s === status)
    if (current_idx === -1) return []
    return flow.slice(current_idx === -1 ? 0 : current_idx, current_idx + 2)
      .filter(s => s !== status)
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Render — Login
  // ─────────────────────────────────────────────────────────────────────────
  if (screen === 'login') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-600 to-rose-800 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8">
          <div className="text-center mb-8">
            <div className="text-6xl mb-3">🚑</div>
            <h1 className="text-2xl font-black text-gray-900">MEDCLUES</h1>
            <p className="text-sm text-gray-500 font-semibold mt-1">Ambulance Operator Portal</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-widest">Username</label>
              <input
                required
                value={loginForm.username}
                onChange={e => setLoginForm(p => ({ ...p, username: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-red-300 outline-none"
                placeholder="operator_username"
                autoComplete="username"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-widest">Password</label>
              <input
                required type="password"
                value={loginForm.password}
                onChange={e => setLoginForm(p => ({ ...p, password: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-red-300 outline-none"
                autoComplete="current-password"
              />
            </div>
            {loginError && (
              <p className="text-xs text-red-600 font-semibold text-center">{loginError}</p>
            )}
            <button
              type="submit" disabled={submitting}
              className="w-full py-4 bg-red-600 text-white rounded-2xl font-black text-base hover:bg-red-700 transition disabled:opacity-50"
            >
              {submitting ? 'Signing In…' : '🔐 Sign In'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Render — Dashboard
  // ─────────────────────────────────────────────────────────────────────────
  const nextActions = currentCase ? getNextActions(currentCase.status) : []

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-red-700">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🚑</span>
          <div>
            <p className="font-black text-sm">{ambInfo?.vehicle_number || 'Ambulance'}</p>
            <p className="text-[10px] text-red-200">MEDCLUES Operator</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" title="GPS Active" />
          <button onClick={handleLogout} className="text-red-200 text-xs hover:text-white">Sign Out</button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 p-4 space-y-4">
        {!currentCase ? (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">⏳</div>
            <p className="text-lg font-bold text-gray-300">No Case Assigned</p>
            <p className="text-sm text-gray-500 mt-2">Waiting for dispatch from MEDCLUES Control…</p>
            <button onClick={() => fetchCase()} className="mt-6 px-6 py-3 bg-gray-700 rounded-2xl text-sm font-bold hover:bg-gray-600 transition">
              🔄 Refresh
            </button>
          </div>
        ) : (
          <>
            {/* Case overview */}
            <div className="bg-gray-800 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-mono text-gray-400">{currentCase.public_id}</span>
                <span className="text-xs font-bold px-2 py-0.5 bg-red-900 text-red-300 rounded-full">
                  {currentCase.status?.replace(/_/g, ' ')}
                </span>
              </div>
              <h2 className="text-xl font-black">{currentCase.patient_name}</h2>
              <p className="text-gray-400 text-sm">{currentCase.patient_phone}</p>
              {currentCase.location_text && (
                <p className="text-gray-300 text-sm mt-2">📍 {currentCase.location_text}</p>
              )}
              {currentCase.hospital_name && (
                <div className="mt-3 pt-3 border-t border-gray-700">
                  <p className="text-xs text-gray-500 font-semibold uppercase tracking-widest">Destination</p>
                  <p className="font-bold text-white mt-1">{currentCase.hospital_name}</p>
                  {currentCase.hospital_address && (
                    <p className="text-sm text-gray-400">{currentCase.hospital_address}</p>
                  )}
                </div>
              )}
            </div>

            {/* Navigation */}
            <a
              href={`https://maps.google.com/?q=${currentCase.latitude},${currentCase.longitude}`}
              target="_blank" rel="noreferrer"
              className="block py-4 bg-blue-700 text-white rounded-2xl text-center font-black hover:bg-blue-600 transition"
            >
              🗺️ Navigate to Patient
            </a>

            {currentCase.hospital_name && (
              <a
                href={`https://maps.google.com/?q=${encodeURIComponent(currentCase.hospital_name + ' ' + (currentCase.hospital_address || ''))}`}
                target="_blank" rel="noreferrer"
                className="block py-4 bg-teal-700 text-white rounded-2xl text-center font-black hover:bg-teal-600 transition"
              >
                🏥 Navigate to Hospital
              </a>
            )}

            {/* Status buttons */}
            {nextActions.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs text-gray-500 uppercase tracking-widest font-bold">Update Status</p>
                {nextActions.map(status => (
                  <button
                    key={status}
                    onClick={() => advanceStatus(status)}
                    disabled={advancing}
                    className="w-full py-5 bg-emerald-600 text-white rounded-2xl text-base font-black hover:bg-emerald-500 transition disabled:opacity-50"
                  >
                    {advancing ? '…' : TRANSITION_LABELS[status] || status}
                  </button>
                ))}
              </div>
            )}

            {['COMPLETED', 'CANCELLED'].includes(currentCase.status) && (
              <div className="text-center py-8">
                <div className="text-5xl mb-3">{currentCase.status === 'COMPLETED' ? '✅' : '❌'}</div>
                <p className="font-bold text-lg">{currentCase.status === 'COMPLETED' ? 'Case Completed' : 'Case Cancelled'}</p>
                <p className="text-sm text-gray-400 mt-1">Waiting for next dispatch…</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default AmbulanceDashboard
