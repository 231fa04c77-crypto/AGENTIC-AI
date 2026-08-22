/**
 * EmergencyTrack — public patient-facing live tracking page.
 * URL: /track/:token   (served from MEDCLUES frontend)
 *
 * Connects to Socket.IO room "case:{casePublicId}" for live GPS updates.
 * Falls back to REST polling every 15 seconds.
 *
 * Dependencies (CDN or npm):
 *   - socket.io-client
 *   - leaflet (for the map)
 *   - leaflet CSS in index.html
 */

import React, { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import axios from 'axios'
import { io } from 'socket.io-client'

const API = import.meta.env.VITE_BACKEND_URL || ''

const STATUS_LABELS = {
  CREATED:             { text: 'Emergency Registered',    emoji: '🔵', colour: 'text-blue-600' },
  HOSPITAL_ASSIGNED:   { text: 'Nearest Hospital Located', emoji: '🏥', colour: 'text-indigo-600' },
  HOSPITAL_ACCEPTED:   { text: 'Hospital Ready',           emoji: '✅', colour: 'text-teal-600' },
  AMBULANCE_ASSIGNED:  { text: 'Ambulance Dispatched',     emoji: '🚑', colour: 'text-orange-600' },
  AMBULANCE_STARTED:   { text: 'Ambulance On The Way',     emoji: '🚑', colour: 'text-orange-600' },
  PATIENT_PICKED:      { text: 'Patient On Board',         emoji: '🛏', colour: 'text-purple-600' },
  HOSPITAL_REACHED:    { text: 'Arrived at Hospital',      emoji: '🏥', colour: 'text-purple-700' },
  TREATMENT_STARTED:   { text: 'Treatment Underway',       emoji: '💊', colour: 'text-emerald-600' },
  COMPLETED:           { text: 'Emergency Resolved',       emoji: '✅', colour: 'text-green-600' },
  CANCELLED:           { text: 'Emergency Cancelled',      emoji: '❌', colour: 'text-gray-500' },
}

const EmergencyTrack = () => {
  const { token } = useParams()
  const [caseData, setCaseData] = useState(null)
  const [ambulancePos, setAmbulancePos] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const mapRef = useRef(null)
  const leafletMap = useRef(null)
  const ambulanceMarker = useRef(null)
  const socketRef = useRef(null)
  const pollRef = useRef(null)

  // ── Fetch case by tracking token ─────────────────────────────────────────
  useEffect(() => {
    const fetchCase = async () => {
      try {
        const { data } = await axios.get(`${API}/api/partner/emergency/track/${token}`)
        if (data.success) {
          setCaseData(data.data)
          setLoading(false)
          // Connect to Socket.IO room
          connectSocket(data.data.public_id)
        } else {
          setError('Emergency case not found or tracking has expired.')
          setLoading(false)
        }
      } catch {
        setError('Could not load emergency tracking information.')
        setLoading(false)
      }
    }
    fetchCase()
    pollRef.current = setInterval(fetchCase, 15000)
    return () => { clearInterval(pollRef.current) }
  }, [token])

  // ── Socket.IO ─────────────────────────────────────────────────────────────
  const connectSocket = (casePublicId) => {
    if (socketRef.current) return
    const soc = io(API, { transports: ['websocket', 'polling'] })
    socketRef.current = soc

    soc.on('connect', () => {
      soc.emit('join_case_room', { case_id: casePublicId })
    })

    soc.on('ambulance_location', (payload) => {
      setAmbulancePos({ lat: payload.latitude, lon: payload.longitude })
    })

    soc.on('case_status', (payload) => {
      setCaseData(prev => prev ? { ...prev, status: payload.status } : prev)
    })
  }

  useEffect(() => {
    return () => {
      socketRef.current?.disconnect()
    }
  }, [])

  // ── Leaflet map ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!caseData || !mapRef.current) return
    if (leafletMap.current) return  // already initialized

    // Dynamically load Leaflet to avoid SSR issues
    import('leaflet').then(L => {
      const map = L.map(mapRef.current).setView(
        [caseData.latitude, caseData.longitude], 14
      )
      leafletMap.current = map

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
      }).addTo(map)

      // Patient location marker
      L.marker([caseData.latitude, caseData.longitude], {
        icon: L.divIcon({
          html: '<div style="font-size:28px">📍</div>',
          className: '', iconAnchor: [14, 28]
        })
      }).bindPopup(`<b>${caseData.patient_name}</b><br>Patient Location`).addTo(map)

      // Hospital marker
      if (caseData.hospital_name) {
        L.marker([caseData.latitude, caseData.longitude], {
          icon: L.divIcon({
            html: '<div style="font-size:28px">🏥</div>',
            className: '', iconAnchor: [14, 28]
          })
        }).bindPopup(`<b>${caseData.hospital_name}</b><br>${caseData.hospital_address || ''}`).addTo(map)
      }

      // Ambulance marker (updated via Socket.IO)
      ambulanceMarker.current = L.marker([caseData.latitude, caseData.longitude], {
        icon: L.divIcon({
          html: '<div style="font-size:32px">🚑</div>',
          className: '', iconAnchor: [16, 32]
        })
      }).addTo(map)
    }).catch(() => {/* Leaflet not installed */ })
  }, [caseData])

  // Update ambulance marker when position changes
  useEffect(() => {
    if (!ambulancePos || !leafletMap.current || !ambulanceMarker.current) return
    import('leaflet').then(L => {
      ambulanceMarker.current.setLatLng([ambulancePos.lat, ambulancePos.lon])
      leafletMap.current.panTo([ambulancePos.lat, ambulancePos.lon])
    })
  }, [ambulancePos])

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center text-white">
          <div className="text-6xl mb-4 animate-bounce">🚑</div>
          <p className="text-lg font-bold">Loading emergency tracker…</p>
        </div>
      </div>
    )
  }

  if (error || !caseData) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="text-center text-white max-w-sm">
          <div className="text-6xl mb-4">❌</div>
          <p className="text-lg font-bold">{error || 'Unable to load tracker'}</p>
          <p className="text-sm text-gray-400 mt-2">The tracking link may have expired or is invalid.</p>
        </div>
      </div>
    )
  }

  const statusInfo = STATUS_LABELS[caseData.status] || { text: caseData.status, emoji: '🔵', colour: 'text-gray-600' }
  const isResolved = ['COMPLETED', 'CANCELLED'].includes(caseData.status)

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Header */}
      <div className="bg-red-700 px-4 py-4">
        <div className="flex items-center gap-3 max-w-lg mx-auto">
          <span className="text-4xl">🚑</span>
          <div>
            <h1 className="font-black text-lg">MEDCLUES Emergency</h1>
            <p className="text-red-200 text-xs">{caseData.public_id}</p>
          </div>
        </div>
      </div>

      {/* Status banner */}
      <div className={`px-4 py-3 text-center font-bold text-lg ${isResolved ? 'bg-gray-800' : 'bg-orange-700 animate-pulse'}`}>
        {statusInfo.emoji} {statusInfo.text}
      </div>

      {/* Map */}
      <div ref={mapRef} style={{ height: '280px' }} className="bg-gray-800" />

      {/* Case details */}
      <div className="flex-1 p-4 max-w-lg mx-auto w-full space-y-4">
        <div className="bg-gray-800 rounded-2xl p-4 space-y-3">
          <div>
            <p className="text-xs text-gray-400 font-semibold uppercase tracking-widest">Patient</p>
            <p className="font-bold text-lg mt-0.5">{caseData.patient_name}</p>
          </div>
          {caseData.hospital_name && (
            <div>
              <p className="text-xs text-gray-400 font-semibold uppercase tracking-widest">Destination Hospital</p>
              <p className="font-bold mt-0.5">{caseData.hospital_name}</p>
              {caseData.hospital_address && <p className="text-sm text-gray-400">{caseData.hospital_address}</p>}
            </div>
          )}
          {caseData.ambulance_eta_minutes && !isResolved && (
            <div className="flex items-center gap-2 bg-orange-900/50 rounded-xl px-3 py-2">
              <span className="text-2xl">⏱</span>
              <div>
                <p className="text-xs text-orange-300 font-semibold">Estimated Arrival</p>
                <p className="font-black text-orange-200 text-lg">{caseData.ambulance_eta_minutes} minutes</p>
              </div>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-gray-500">
          Powered by MEDCLUES Emergency Platform • Tracking updates every 15s
        </p>
      </div>
    </div>
  )
}

export default EmergencyTrack
