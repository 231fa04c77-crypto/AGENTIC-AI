import React, { useEffect, useRef, useState, useCallback } from 'react'
import axios from 'axios'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

/**
 * GreenCorridorPage — Professional live ambulance tracking map.
 *
 * Mounted at: /live-track/:caseId  (public, no auth)
 *
 * Features:
 *  - Live ambulance tracking (polls every 8s + Socket.IO ready)
 *  - OSRM-powered route with traffic-aware alternatives
 *  - Route comparison: fastest vs alternative (colour-coded)
 *  - ETA countdown, status timeline, share link
 *  - Fully responsive, dark theme matching admin system
 */

// ── Leaflet icon fix (Vite bundling) ──────────────────────────────────────────
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const API = import.meta.env.VITE_BACKEND_URL || ''

// ── Icons ────────────────────────────────────────────────────────────────────
const AMB_ICON = L.divIcon({
  className: '',
  html: `<div style="font-size:36px;filter:drop-shadow(0 3px 8px rgba(0,0,0,0.6));animation:pulse 1.5s ease-in-out infinite">🚑</div>`,
  iconSize: [40, 40], iconAnchor: [20, 20], popupAnchor: [0, -20],
})
const PICKUP_ICON = L.divIcon({
  className: '',
  html: `<div style="font-size:30px;filter:drop-shadow(0 3px 8px rgba(0,0,0,0.6))">📍</div>`,
  iconSize: [30, 36], iconAnchor: [15, 36], popupAnchor: [0, -36],
})
const HOSPITAL_ICON = L.divIcon({
  className: '',
  html: `<div style="font-size:30px;filter:drop-shadow(0 3px 8px rgba(0,0,0,0.6))">🏥</div>`,
  iconSize: [30, 30], iconAnchor: [15, 30], popupAnchor: [0, -30],
})

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_META = {
  CASE_CREATED:       { label: 'Case Created',          color: '#94a3b8', emoji: '📋', pct: 10 },
  HOSPITAL_ASSIGNED:  { label: 'Hospital Assigned',     color: '#f59e0b', emoji: '🏥', pct: 20 },
  AMBULANCE_ASSIGNED: { label: 'Ambulance Dispatched',  color: '#f97316', emoji: '📞', pct: 35 },
  AMBULANCE_STARTED:  { label: 'En Route to You',       color: '#10b981', emoji: '🚑', pct: 55 },
  PATIENT_PICKED:     { label: 'You\'re On Board',      color: '#8b5cf6', emoji: '🛏️', pct: 70 },
  HOSPITAL_REACHED:   { label: 'Arrived at Hospital',   color: '#06b6d4', emoji: '🏥', pct: 85 },
  TREATMENT_STARTED:  { label: 'Under Treatment',       color: '#3b82f6', emoji: '💊', pct: 95 },
  COMPLETED:          { label: 'Trip Completed',        color: '#22c55e', emoji: '✅', pct: 100 },
}

const TRAFFIC_COLORS = {
  clear:    { line: '#10b981', label: 'Clear Roads',    badge: 'bg-emerald-600' },
  moderate: { line: '#f59e0b', label: 'Moderate Traffic', badge: 'bg-amber-600' },
  heavy:    { line: '#ef4444', label: 'Heavy Traffic',  badge: 'bg-red-600' },
}

// ── OSRM helpers ──────────────────────────────────────────────────────────────
async function fetchOSRMRoutes(fromLat, fromLon, toLat, toLon) {
  // OSRM public demo server — free, no key
  const url = `https://router.project-osrm.org/route/v1/driving/${fromLon},${fromLat};${toLon},${toLat}?alternatives=true&geometries=geojson&overview=full&annotations=true`
  const res = await fetch(url)
  const json = await res.json()
  if (!json.routes || json.routes.length === 0) return []
  return json.routes.map((r, i) => ({
    coords: r.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
    distance_m: r.distance,
    duration_s: r.duration,
    isPrimary: i === 0,
  }))
}

// Infer traffic level from speed ratio (vs free-flow estimate)
function inferTraffic(routes) {
  if (!routes || routes.length < 2) return 'clear'
  const best = routes[0]
  const freeFlowSpeedKmh = (best.distance_m / 1000) / (best.duration_s / 3600)
  if (freeFlowSpeedKmh < 20) return 'heavy'
  if (freeFlowSpeedKmh < 35) return 'moderate'
  return 'clear'
}

function fmtDuration(secs) {
  if (!secs) return '—'
  const m = Math.round(secs / 60)
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)}h ${m % 60}m`
}
function fmtDist(m) {
  if (!m) return '—'
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`
}

// ── Component ─────────────────────────────────────────────────────────────────
const GreenCorridorPage = () => {
  const caseId = window.location.pathname.replace(/^\/live-track\/?/, '') || ''

  const mapRef       = useRef(null)
  const mapInst      = useRef(null)
  const ambMarker    = useRef(null)
  const pickMarker   = useRef(null)
  const hospMarker   = useRef(null)
  const routeLayers  = useRef([])

  const [track,   setTrack]   = useState(null)
  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(true)
  const [routes,  setRoutes]  = useState([])     // OSRM route objects
  const [traffic, setTraffic] = useState('clear')
  const [copied,  setCopied]  = useState(false)
  const [lastPing,setLastPing]= useState(null)
  const [showAlt, setShowAlt] = useState(false)  // toggle alt route visibility

  // ── Fetch live data ─────────────────────────────────────────────────────────
  const fetchTrack = useCallback(async () => {
    if (!caseId) return
    try {
      const { data } = await axios.get(`${API}/api/dispatch/live-track/${caseId}`)
      if (data.success) {
        setTrack(data.data)
        if (data.data?.last_ping_at) setLastPing(new Date(data.data.last_ping_at))
        setLoading(false)
      }
    } catch (e) {
      setError(e?.response?.data?.detail || 'Could not load tracking data.')
      setLoading(false)
    }
  }, [caseId])

  // ── Init map ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || mapInst.current) return
    const map = L.map(mapRef.current, {
      center: [17.385, 78.4867],
      zoom: 13,
      zoomControl: false,
    })
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map)
    L.control.zoom({ position: 'bottomright' }).addTo(map)
    mapInst.current = map
    return () => { map.remove(); mapInst.current = null }
  }, [])

  // ── Draw routes on map ──────────────────────────────────────────────────────
  const drawRoutes = useCallback((newRoutes, trafficLevel) => {
    const map = mapInst.current
    if (!map) return
    // Remove old route layers
    routeLayers.current.forEach(l => { try { map.removeLayer(l) } catch {} })
    routeLayers.current = []

    const tc = TRAFFIC_COLORS[trafficLevel] || TRAFFIC_COLORS.clear

    newRoutes.forEach((r, i) => {
      const isMain = i === 0
      const color  = isMain ? tc.line : '#6366f1'
      const layer  = L.polyline(r.coords, {
        color,
        weight:    isMain ? 6 : 4,
        opacity:   isMain ? 0.92 : 0.55,
        dashArray: isMain ? null : '10 8',
      }).addTo(map)
      layer.bindTooltip(
        isMain
          ? `<b>Fastest:</b> ${fmtDist(r.distance_m)} · ${fmtDuration(r.duration_s)}`
          : `<b>Alt route:</b> ${fmtDist(r.distance_m)} · ${fmtDuration(r.duration_s)}`,
        { permanent: false, direction: 'center' }
      )
      routeLayers.current.push(layer)
    })

    // Fit map to primary route
    if (newRoutes[0]?.coords?.length) {
      map.fitBounds(L.polyline(newRoutes[0].coords).getBounds(), { padding: [48, 48] })
    }
  }, [])

  // ── Update markers ──────────────────────────────────────────────────────────
  const updateMarkers = useCallback((d) => {
    const map = mapInst.current
    if (!map) return

    // Ambulance
    if (d.current_lat && d.current_lon) {
      const pos = [d.current_lat, d.current_lon]
      if (ambMarker.current) {
        ambMarker.current.setLatLng(pos)
      } else {
        ambMarker.current = L.marker(pos, { icon: AMB_ICON })
          .addTo(map)
          .bindPopup(`<b>🚑 ${d.vehicle_number || 'Ambulance'}</b><br/>${d.driver_name || ''}`)
      }
    }
    // Pickup
    if (d.pickup_lat && d.pickup_lon && !pickMarker.current) {
      pickMarker.current = L.marker([d.pickup_lat, d.pickup_lon], { icon: PICKUP_ICON })
        .addTo(map)
        .bindPopup(`<b>📍 Patient Pickup</b><br/>${d.patient_name || ''}`)
    }
    // Hospital (if coords available)
    if (d.hospital_lat && d.hospital_lon && !hospMarker.current) {
      hospMarker.current = L.marker([d.hospital_lat, d.hospital_lon], { icon: HOSPITAL_ICON })
        .addTo(map)
        .bindPopup(`<b>🏥 ${d.hospital_name || 'Hospital'}</b>`)
    }
  }, [])

  // ── Fetch OSRM routes when ambulance position is known ──────────────────────
  useEffect(() => {
    if (!track?.current_lat || !track?.pickup_lat) return
    fetchOSRMRoutes(track.current_lat, track.current_lon, track.pickup_lat, track.pickup_lon)
      .then(r => {
        if (r.length > 0) {
          const tLevel = inferTraffic(r)
          setRoutes(r)
          setTraffic(tLevel)
          drawRoutes(showAlt ? r : [r[0]], tLevel)
        }
      })
      .catch(() => {})
  }, [track?.current_lat, track?.current_lon, track?.pickup_lat, track?.pickup_lon, showAlt, drawRoutes])

  // ── React to showAlt toggle ─────────────────────────────────────────────────
  useEffect(() => {
    if (routes.length > 0) drawRoutes(showAlt ? routes : [routes[0]], traffic)
  }, [showAlt, routes, traffic, drawRoutes])

  // ── Update markers whenever track changes ───────────────────────────────────
  useEffect(() => {
    if (track) updateMarkers(track)
  }, [track, updateMarkers])

  // ── Polling ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!caseId) { setError('No case ID in URL.'); setLoading(false); return }
    fetchTrack()
    const interval = setInterval(fetchTrack, 8000)
    return () => clearInterval(interval)
  }, [fetchTrack, caseId])

  // ── Copy share link ─────────────────────────────────────────────────────────
  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2500)
    })
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const statusMeta  = STATUS_META[track?.case_status] || STATUS_META['AMBULANCE_STARTED']
  const tc          = TRAFFIC_COLORS[traffic]
  const primaryRoute = routes[0] || null
  const altRoute     = routes[1] || null

  const timeSincePing = lastPing
    ? Math.round((Date.now() - lastPing.getTime()) / 1000)
    : null

  // ── Loading / Error states ──────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="w-14 h-14 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-gray-300 text-sm font-semibold">Loading live tracking…</p>
      </div>
    </div>
  )

  if (error) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
      <div className="text-center max-w-sm bg-gray-900 border border-gray-800 rounded-2xl p-8">
        <p className="text-5xl mb-4">🔗</p>
        <h2 className="text-white font-bold text-xl mb-2">Case Not Found</h2>
        <p className="text-gray-400 text-sm">{error}</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col" style={{ fontFamily: "'Outfit', sans-serif" }}>

      {/* ── Top header bar ──────────────────────────────────────────────────── */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center justify-between z-10 shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-xl">🚑</span>
          <div>
            <p className="text-white font-bold text-sm leading-none">MEDCLUES</p>
            <p className="text-emerald-400 text-xs font-semibold">Green Corridor · Live Tracking</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Live pulse */}
          <div className="flex items-center gap-1.5 bg-gray-800 rounded-full px-3 py-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-emerald-400 text-xs font-bold">LIVE</span>
          </div>
          <button
            onClick={copyLink}
            className="bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-xl px-3 py-1.5 text-xs font-semibold text-gray-300 transition"
          >
            {copied ? '✅ Copied' : '🔗 Share'}
          </button>
        </div>
      </div>

      {/* ── Status progress bar ─────────────────────────────────────────────── */}
      <div className="shrink-0 bg-gray-900 border-b border-gray-800 px-4 py-3">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xl">{statusMeta.emoji}</span>
              <span className="text-white font-bold text-sm">{statusMeta.label}</span>
            </div>
            <span className="text-xs text-gray-400 font-mono">{caseId}</span>
          </div>
          <div className="relative w-full bg-gray-800 rounded-full h-2 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${statusMeta.pct}%`, background: statusMeta.color }}
            />
          </div>
        </div>
      </div>

      {/* ── Main content: map + sidebar ─────────────────────────────────────── */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0">

        {/* MAP */}
        <div className="relative flex-1 min-h-64 lg:min-h-0">
          <div ref={mapRef} className="absolute inset-0" />

          {/* Traffic badge floating on map */}
          {primaryRoute && (
            <div className="absolute top-3 left-3 z-[999] flex flex-col gap-2">
              <div className={`${tc.badge} text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1.5`}>
                <span>🚦</span> {tc.label}
              </div>
              {altRoute && (
                <button
                  onClick={() => setShowAlt(s => !s)}
                  className={`${showAlt ? 'bg-indigo-600' : 'bg-gray-800 border border-gray-600'} text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1.5 transition`}
                >
                  <span>🔀</span> {showAlt ? 'Alt Route ON' : 'Show Alt Route'}
                </button>
              )}
            </div>
          )}

          {/* Last ping indicator */}
          {timeSincePing !== null && (
            <div className="absolute bottom-3 left-3 z-[999]">
              <div className={`text-xs font-semibold px-3 py-1.5 rounded-full shadow-lg ${timeSincePing < 20 ? 'bg-emerald-600/90 text-white' : 'bg-amber-600/90 text-white'}`}>
                📡 Updated {timeSincePing}s ago
              </div>
            </div>
          )}
        </div>

        {/* SIDEBAR PANEL */}
        <div className="w-full lg:w-80 bg-gray-900 border-t lg:border-t-0 lg:border-l border-gray-800 overflow-y-auto shrink-0">
          <div className="p-4 space-y-4">

            {/* ── Route Cards ──────────────────────────────────────────────── */}
            {primaryRoute && (
              <div>
                <p className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-2">Routes</p>
                <div className="space-y-2">
                  {/* Primary route */}
                  <div className="bg-gray-800 border border-gray-700 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ background: tc.line }} />
                        <span className="text-white text-xs font-bold">Fastest Route</span>
                      </div>
                      <span className="text-emerald-400 text-xs font-bold bg-emerald-950 px-2 py-0.5 rounded-full">Active</span>
                    </div>
                    <div className="flex gap-4 mt-1">
                      <div>
                        <p className="text-gray-500 text-xs">Distance</p>
                        <p className="text-white font-bold text-sm">{fmtDist(primaryRoute.distance_m)}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 text-xs">ETA</p>
                        <p className="text-white font-bold text-sm">{fmtDuration(primaryRoute.duration_s)}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 text-xs">Traffic</p>
                        <p className="font-bold text-sm capitalize" style={{ color: tc.line }}>{traffic}</p>
                      </div>
                    </div>
                  </div>

                  {/* Alt route */}
                  {altRoute && (
                    <div className={`border rounded-xl p-3 transition ${showAlt ? 'bg-indigo-950/50 border-indigo-700' : 'bg-gray-800/50 border-gray-700'}`}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-indigo-500" />
                          <span className="text-gray-300 text-xs font-bold">Alternative Route</span>
                        </div>
                        <button
                          onClick={() => setShowAlt(s => !s)}
                          className={`text-xs font-bold px-2 py-0.5 rounded-full transition ${showAlt ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-gray-400'}`}
                        >
                          {showAlt ? 'ON' : 'OFF'}
                        </button>
                      </div>
                      <div className="flex gap-4 mt-1">
                        <div>
                          <p className="text-gray-500 text-xs">Distance</p>
                          <p className="text-gray-300 font-bold text-sm">{fmtDist(altRoute.distance_m)}</p>
                        </div>
                        <div>
                          <p className="text-gray-500 text-xs">ETA</p>
                          <p className="text-gray-300 font-bold text-sm">{fmtDuration(altRoute.duration_s)}</p>
                        </div>
                        <div>
                          <p className="text-gray-500 text-xs">vs Fastest</p>
                          <p className={`font-bold text-sm ${altRoute.duration_s > primaryRoute.duration_s ? 'text-amber-400' : 'text-emerald-400'}`}>
                            {altRoute.duration_s > primaryRoute.duration_s
                              ? `+${fmtDuration(altRoute.duration_s - primaryRoute.duration_s)}`
                              : `−${fmtDuration(primaryRoute.duration_s - altRoute.duration_s)}`}
                          </p>
                        </div>
                      </div>
                      {traffic === 'heavy' && (
                        <p className="text-amber-400 text-xs mt-2 font-semibold">
                          ⚠️ Heavy traffic detected — consider alternative route
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── Patient & Case Info ───────────────────────────────────────── */}
            <div>
              <p className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-2">Case Details</p>
              <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-gray-500 text-xs">Patient</p>
                    <p className="text-white font-bold text-sm">{track?.patient_name || '—'}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs">Emergency</p>
                    <p className="text-white font-bold text-sm text-xs leading-tight">{track?.emergency_type || '—'}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-gray-500 text-xs">Destination Hospital</p>
                    <p className="text-white font-semibold text-sm">{track?.hospital_name || '—'}</p>
                  </div>
                  {track?.vehicle_number && (
                    <div>
                      <p className="text-gray-500 text-xs">Ambulance</p>
                      <p className="text-white font-bold text-sm">{track.vehicle_number}</p>
                    </div>
                  )}
                  {track?.eta_minutes && (
                    <div>
                      <p className="text-gray-500 text-xs">Original ETA</p>
                      <p className="text-emerald-400 font-bold text-sm">{track.eta_minutes} min</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ── Status Timeline ───────────────────────────────────────────── */}
            <div>
              <p className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-2">Journey Timeline</p>
              <div className="space-y-1">
                {Object.entries(STATUS_META).map(([key, meta]) => {
                  const currentPct = statusMeta.pct
                  const done = meta.pct <= currentPct
                  const active = key === track?.case_status
                  return (
                    <div key={key} className={`flex items-center gap-3 px-3 py-2 rounded-xl transition ${active ? 'bg-gray-800 border border-gray-600' : ''}`}>
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-sm ${done ? 'bg-emerald-600/30' : 'bg-gray-800'}`}>
                        {done ? (active ? meta.emoji : '✓') : '○'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-semibold truncate ${active ? 'text-white' : done ? 'text-gray-400' : 'text-gray-600'}`}>
                          {meta.label}
                        </p>
                      </div>
                      {active && (
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* ── Traffic Advisory ─────────────────────────────────────────── */}
            {traffic !== 'clear' && (
              <div className={`rounded-xl p-4 border ${traffic === 'heavy' ? 'bg-red-950/40 border-red-700' : 'bg-amber-950/40 border-amber-700'}`}>
                <div className="flex items-start gap-3">
                  <span className="text-2xl shrink-0">{traffic === 'heavy' ? '🚨' : '⚠️'}</span>
                  <div>
                    <p className={`font-bold text-sm mb-1 ${traffic === 'heavy' ? 'text-red-400' : 'text-amber-400'}`}>
                      {traffic === 'heavy' ? 'Heavy Traffic Detected' : 'Moderate Traffic'}
                    </p>
                    <p className="text-gray-400 text-xs leading-relaxed">
                      {traffic === 'heavy'
                        ? 'Significant congestion on primary route. Alternative route shown in purple — may be faster.'
                        : 'Some congestion on route. Ambulance is proceeding with emergency lights and siren.'}
                    </p>
                    {traffic === 'heavy' && altRoute && (
                      <button
                        onClick={() => setShowAlt(true)}
                        className="mt-2 text-xs font-bold text-indigo-400 hover:text-indigo-300 underline"
                      >
                        View alternative route →
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ── Actions ──────────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={copyLink}
                className="py-3 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-xl text-xs font-bold text-gray-300 transition flex flex-col items-center gap-1"
              >
                <span className="text-lg">{copied ? '✅' : '🔗'}</span>
                {copied ? 'Copied!' : 'Share Link'}
              </button>
              {track?.pickup_lat && (
                <a
                  href={`https://www.google.com/maps?q=${track.pickup_lat},${track.pickup_lon}`}
                  target="_blank" rel="noreferrer"
                  className="py-3 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-xl text-xs font-bold text-gray-300 transition flex flex-col items-center gap-1"
                >
                  <span className="text-lg">📍</span>
                  View in Maps
                </a>
              )}
            </div>

            {/* Footer */}
            <p className="text-center text-gray-700 text-xs pb-2">
              MEDCLUES Green Corridor · Emergency Response Network
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default GreenCorridorPage
