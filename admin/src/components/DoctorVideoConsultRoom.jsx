import React, { useContext, useEffect, useRef, useState } from 'react'
import axios from 'axios'
import AgoraRTC from 'agora-rtc-sdk-ng'
import { AppContext } from '../context/AppContext'
import { toast } from 'react-toastify'
import { getPatientAge, getPatientImage, getPatientName } from '../utils/appointmentDisplay'

function formatCallDuration(totalSeconds) {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

async function createLocalTracks(wantCamera) {
  const audioTrack = await AgoraRTC.createMicrophoneAudioTrack()
  if (!wantCamera) {
    return { tracks: [audioTrack], videoTrack: null, cameraBlocked: false }
  }
  try {
    const videoTrack = await AgoraRTC.createCameraVideoTrack({
      encoderConfig: {
        width: 640,
        height: 360,
        frameRate: 15,
        bitrateMax: 800,
        bitrateMin: 400,
      },
    })
    return { tracks: [audioTrack, videoTrack], videoTrack, cameraBlocked: false }
  } catch (_) {
    return { tracks: [audioTrack], videoTrack: null, cameraBlocked: true }
  }
}

function RoundCtrl({ label, active, onClick, children }) {
  return (
    <button type="button" onClick={onClick} title={label} className="flex flex-col items-center gap-1 group">
      <span
        className={`w-11 h-11 rounded-full flex items-center justify-center transition-all ${
          active ? 'bg-white text-slate-900' : 'bg-white/15 hover:bg-white/30 text-white'
        }`}
      >
        {children}
      </span>
      <span className="text-[10px] font-medium text-white/80">{label}</span>
    </button>
  )
}

/**
 * Enterprise doctor telemedicine video room — patient full screen, doctor PIP, clinical sidebar.
 */
const DoctorVideoConsultRoom = ({
  appointmentId,
  authToken,
  appointment,
  scheduledTime,
  publishCameraInitial = false,
  onLeave,
}) => {
  const { backendUrl, calculateAge, currency } = useContext(AppContext)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [muted, setMuted] = useState(false)
  const [videoOff, setVideoOff] = useState(false)
  const [speakerOn, setSpeakerOn] = useState(true)
  const [remoteJoined, setRemoteJoined] = useState(false)
  const [remoteVideoActive, setRemoteVideoActive] = useState(false)
  const [tracksReady, setTracksReady] = useState(false)
  const [callSeconds, setCallSeconds] = useState(0)
  const [callStartedAtMs, setCallStartedAtMs] = useState(null)
  const [consultationId, setConsultationId] = useState(null)
  const [liveAppointment, setLiveAppointment] = useState(null)
  const [callActive, setCallActive] = useState(false)
  const [callEndedMessage, setCallEndedMessage] = useState(null)
  const [publishCamera, setPublishCamera] = useState(publishCameraInitial)
  const [showChat, setShowChat] = useState(false)
  const [sidebarTab, setSidebarTab] = useState('prescription')
  const [showMore, setShowMore] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [chatInput, setChatInput] = useState('')
  const [chatMessages, setChatMessages] = useState([])
  const [prescription, setPrescription] = useState('')
  const [diagnosis, setDiagnosis] = useState('')
  const [consultNotes, setConsultNotes] = useState('')
  const [advice, setAdvice] = useState('')
  const [followupDate, setFollowupDate] = useState('')
  const [saveState, setSaveState] = useState('idle') // idle | dirty | saving | saved
  const [lastSavedAt, setLastSavedAt] = useState(null)
  const [savingPrescription, setSavingPrescription] = useState(false)
  const lastSavedPayloadRef = useRef(null)
  const [cameraHint, setCameraHint] = useState(
    !publishCameraInitial
      ? 'Receive-only: your camera is off so the patient can use the webcam on this device.'
      : null
  )
  const [slotBanner, setSlotBanner] = useState(null)
  const [poorConnection, setPoorConnection] = useState(false)
  const poorStreakRef = useRef(0)

  const clientRef = useRef(null)
  const localTracksRef = useRef([])
  const localVideoRef = useRef(null)
  const remoteVideoRef = useRef(null)
  const videoPanelRef = useRef(null)
  const remoteUsersRef = useRef(new Map())
  const callEndedRef = useRef(false)
  const hadRemoteRef = useRef(false)
  const joinAttemptRef = useRef(0)
  const lastChatIdRef = useRef(0)

  const patientName = getPatientName(appointment)
  const patientAge = getPatientAge(appointment, calculateAge)
  const patientImage = getPatientImage(appointment)
  const patientGender =
    appointment?.actualPatient?.gender || appointment?.userData?.gender || '—'
  const patientEmail = appointment?.userData?.email || appointment?.actualPatient?.email || '—'
  const patientPhone =
    appointment?.userData?.phone || appointment?.actualPatient?.phone || appointment?.docData?.phone || '—'
  const rawAddr = appointment?.userData?.address
  const patientAddress =
    typeof rawAddr === 'string'
      ? rawAddr
      : [rawAddr?.line1, rawAddr?.line2].filter(Boolean).join(', ') || '—'
  // Prefer fresh data pulled at join time; fall back to the cached list prop.
  const appt = { ...(appointment || {}), ...(liveAppointment || {}) }
  const apSymptoms = appt?.actualPatient?.symptoms
  const rawSymptoms = [
    ...(appt?.selectedSymptoms || []),
    ...(typeof apSymptoms === 'string' && apSymptoms.trim()
      ? apSymptoms.split(',').map((s) => s.trim()).filter(Boolean)
      : []),
  ]
  const symptoms = rawSymptoms.filter((s) => !String(s).startsWith('Note:'))
  const bookingReportUrl =
    appt?.userData?.bookingReportUrl || appt?.actualPatient?.prescription || null
  const patientBookingNotes = [
    ...rawSymptoms
      .filter((s) => String(s).startsWith('Note:'))
      .map((s) => String(s).replace(/^Note:\s*/, '')),
    // Legacy Razorpay bookings stored free-text notes as the only "symptom".
    ...(symptoms.length === 0 && rawSymptoms.length === 1 && !String(rawSymptoms[0]).startsWith('Note:')
      ? [String(rawSymptoms[0])]
      : []),
  ]
  const bookingId = appointment?.bookingId || `APP-${appointmentId}`
  const apptLabel = bookingId.startsWith('APP') ? bookingId : `APP-${bookingId}`

  const playRemoteVideo = (user) => {
    if (!user?.videoTrack) return false
    const container = remoteVideoRef.current
    if (!container) return false
    try {
      user.videoTrack.play(container, { fit: 'cover' })
      setRemoteVideoActive(true)
      return true
    } catch (_) {
      return false
    }
  }

  const syncRemoteJoined = () => {
    const hasRemote = remoteUsersRef.current.size > 0
    setRemoteJoined(hasRemote)
    if (hasRemote) {
      hadRemoteRef.current = true
      setCallActive(true)
    }
    const hasVideo = [...remoteUsersRef.current.values()].some((u) => u.videoTrack)
    if (!hasVideo) setRemoteVideoActive(false)
  }

  const refreshRemoteStreams = async () => {
    const client = clientRef.current
    if (!client) return
    for (const user of client.remoteUsers) {
      remoteUsersRef.current.set(user.uid, user)
      if (user.hasAudio && !user.audioTrack) {
        try {
          await client.subscribe(user, 'audio')
        } catch (_) {}
      }
      if (user.hasVideo && !user.videoTrack) {
        try {
          await client.subscribe(user, 'video')
        } catch (_) {}
      }
    }
    requestAnimationFrame(() => {
      remoteUsersRef.current.forEach((user) => playRemoteVideo(user))
    })
    syncRemoteJoined()
  }

  const syncTimerFromServer = async () => {
    try {
      const { data } = await axios.post(
        `${backendUrl}/api/doctor/appointments/${appointmentId}/sync-call-timer`,
        {},
        { headers: { dToken: authToken } }
      )
      if (data?.callStartedAt) {
        setCallStartedAtMs(Number(data.callStartedAt))
      }
    } catch (_) {}
  }

  const buildConsultationPayload = () => ({
    consultationId,
    prescription,
    notes: consultNotes,
    diagnosis,
    advice,
    followupDate: followupDate || undefined,
  })

  const payloadSignature = () => JSON.stringify(buildConsultationPayload())

  useEffect(() => {
    if (saveState === 'saving') return
    const sig = payloadSignature()
    const hasDraftContent = Boolean(
      prescription.trim() || diagnosis.trim() || consultNotes.trim() || advice.trim() || followupDate
    )
    if (lastSavedPayloadRef.current === null) {
      if (hasDraftContent) setSaveState('dirty')
      return
    }
    if (sig !== lastSavedPayloadRef.current) setSaveState('dirty')
  }, [prescription, diagnosis, consultNotes, advice, followupDate, consultationId, saveState])

  const saveConsultationDraft = async ({ silent = false } = {}) => {
    setSavingPrescription(true)
    setSaveState('saving')
    try {
      const { data } = await axios.post(
        `${backendUrl}/api/doctor/appointments/${appointmentId}/save-consultation`,
        buildConsultationPayload(),
        { headers: { dToken: authToken } }
      )
      if (data?.success) {
        lastSavedPayloadRef.current = payloadSignature()
        setSaveState('saved')
        setLastSavedAt(new Date())
        if (!silent) toast.success(data.message || 'Prescription saved for patient')
        return true
      }
      setSaveState('dirty')
      if (!silent) toast.error(data?.message || 'Could not save prescription')
      return false
    } catch (err) {
      setSaveState('dirty')
      if (!silent) toast.error(err?.response?.data?.message || 'Could not save prescription')
      return false
    } finally {
      setSavingPrescription(false)
    }
  }

  const finalizeConsultationOnServer = async () => {
    try {
      const { data } = await axios.post(
        `${backendUrl}/api/doctor/appointments/${appointmentId}/end-video-call`,
        buildConsultationPayload(),
        { headers: { dToken: authToken } }
      )
      if (data?.success) {
        lastSavedPayloadRef.current = payloadSignature()
        setSaveState('saved')
        return true
      }
      toast.error(data?.message || 'Call ended but consultation could not be finalized')
      return false
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Call ended but consultation could not be finalized')
      return false
    }
  }

  const persistConsultationToServer = async () => {
    const hasUnsavedChanges = lastSavedPayloadRef.current !== payloadSignature()
    if (hasUnsavedChanges) {
      const saved = await saveConsultationDraft({ silent: true })
      if (!saved) {
        toast.error('Could not save prescription before ending call')
        return false
      }
    }
    const finalized = await finalizeConsultationOnServer()
    if (finalized) {
      toast.success('Consultation ended')
    }
    return finalized
  }

  const handleCallEnded = async (message, { notifyServer = true } = {}) => {
    if (callEndedRef.current) return
    callEndedRef.current = true
    setCallEndedMessage(message)
    setCallActive(false)

    if (notifyServer) {
      await persistConsultationToServer()
    }

    const client = clientRef.current
    if (client) {
      try {
        await client.leave()
      } catch (_) {}
    }

    setTimeout(() => onLeave?.(), 900)
  }

  const subscribeRemoteUser = async (client, user) => {
    remoteUsersRef.current.set(user.uid, user)
    if (user.hasAudio) {
      await client.subscribe(user, 'audio')
      user.audioTrack?.play()
    }
    if (user.hasVideo) {
      await client.subscribe(user, 'video')
      playRemoteVideo(user)
    }
    syncRemoteJoined()
  }

  useEffect(() => {
    let cancelled = false

    const cleanup = async () => {
      localTracksRef.current.forEach((t) => {
        try {
          t.stop()
          t.close()
        } catch (_) {}
      })
      localTracksRef.current = []
      remoteUsersRef.current.clear()
      const client = clientRef.current
      if (client) {
        try {
          await client.leave()
        } catch (_) {}
      }
      clientRef.current = null
    }

    const fetchJoinCredentials = async () => {
      const { data } = await axios.post(
        `${backendUrl}/api/doctor/appointments/${appointmentId}/agora-token`,
        {},
        { headers: { dToken: authToken } }
      )
      if (!data?.success) throw new Error(data?.message || 'Could not start video session')
      return data
    }

    const joinChannel = async (client, data) => {
      const uid = Number(data.uid)
      if (!Number.isFinite(uid) || uid <= 0) {
        throw new Error('Invalid Agora uid from server')
      }
      await client.join(data.appId, data.channel, data.token, uid)
    }

    const start = async () => {
      const attempt = ++joinAttemptRef.current
      try {
        const data = await fetchJoinCredentials()
        if (cancelled || attempt !== joinAttemptRef.current) return

        if (data.consultationId) setConsultationId(data.consultationId)
        if (data.appointment) setLiveAppointment(data.appointment)

        const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' })
        clientRef.current = client

        client.on('user-joined', (user) => {
          remoteUsersRef.current.set(user.uid, user)
          syncRemoteJoined()
          syncTimerFromServer()
        })
        client.on('user-published', async (user, mediaType) => {
          await client.subscribe(user, mediaType)
          remoteUsersRef.current.set(user.uid, user)
          if (mediaType === 'video') playRemoteVideo(user)
          if (mediaType === 'audio') user.audioTrack?.play()
          syncRemoteJoined()
          syncTimerFromServer()
        })
        client.on('user-unpublished', (user, mediaType) => {
          if (mediaType === 'video') {
            setRemoteVideoActive(false)
          }
        })
        client.on('user-left', (user) => {
          remoteUsersRef.current.delete(user.uid)
          syncRemoteJoined()
          if (hadRemoteRef.current) {
            handleCallEnded('The call was ended.', { notifyServer: true })
          }
        })

        try {
          await joinChannel(client, data)
        } catch (joinErr) {
          const code = joinErr?.code || joinErr?.name || ''
          const msg = joinErr?.message || ''
          const isUidConflict =
            code === 'UID_CONFLICT' ||
            msg.includes('UID_CONFLICT') ||
            msg.toLowerCase().includes('uid conflict')
          if (!isUidConflict) throw joinErr
          try {
            await client.leave()
          } catch (_) {}
          const fresh = await fetchJoinCredentials()
          if (cancelled || attempt !== joinAttemptRef.current) return
          await joinChannel(client, fresh)
        }
        setCallActive(true)

        for (const user of client.remoteUsers) {
          await subscribeRemoteUser(client, user)
        }
        if (client.remoteUsers.length > 0) {
          syncTimerFromServer()
        }

        const { tracks, videoTrack, cameraBlocked } = await createLocalTracks(publishCameraInitial)
        localTracksRef.current = tracks
        if (cameraBlocked) {
          setPublishCamera(false)
          setCameraHint('Webcam in use — receiving patient video only.')
        }
        await client.publish(tracks)
        if (!videoTrack) setVideoOff(true)

        if (!cancelled) {
          setTracksReady(true)
          setLoading(false)
        }
      } catch (e) {
        if (!cancelled) {
          setError(e?.response?.data?.message || e.message || 'Video call failed')
          setLoading(false)
        }
      }
    }

    start()
    return () => {
      cancelled = true
      joinAttemptRef.current += 1
      cleanup()
    }
  }, [appointmentId, authToken, backendUrl, publishCameraInitial])

  useEffect(() => {
    if (!tracksReady || loading) return
    const videoTrack = localTracksRef.current[1]
    if (videoTrack && localVideoRef.current && publishCamera) {
      try {
        videoTrack.play(localVideoRef.current, { fit: 'cover' })
      } catch (_) {}
    }
    remoteUsersRef.current.forEach((user) => playRemoteVideo(user))
  }, [tracksReady, loading, publishCamera])

  useEffect(() => {
    if (!tracksReady || loading) return undefined
    const id = setInterval(() => {
      remoteUsersRef.current.forEach((user) => playRemoteVideo(user))
    }, 2000)
    return () => clearInterval(id)
  }, [tracksReady, loading])

  useEffect(() => {
    if (!callActive || !callStartedAtMs) return undefined
    const tick = () => {
      setCallSeconds(Math.max(0, Math.floor((Date.now() - callStartedAtMs) / 1000)))
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [callActive, callStartedAtMs])

  useEffect(() => {
    if (!tracksReady || callEndedMessage) return undefined
    const id = setInterval(async () => {
      try {
        const { data } = await axios.get(
          `${backendUrl}/api/doctor/appointments/${appointmentId}/video-call-status`,
          { headers: { dToken: authToken } }
        )
        const window = data?.slotWindow || {}
        if (data?.forceEnd || window.forceEnd) {
          handleCallEnded('Slot time ended.', { notifyServer: true })
          return
        }
        if (window.inGrace) {
          setSlotBanner(window.windowMessage || 'Slot ended. Grace period — finish or leave soon.')
        } else if (window.softWarn || data?.softWarn) {
          setSlotBanner(window.windowMessage || data?.windowMessage || 'Consultation ends in 2 minutes.')
        } else {
          setSlotBanner(null)
        }
        if ((data?.ended && callActive) && !(data?.forceEnd || window.forceEnd)) {
          handleCallEnded('The call was ended.', { notifyServer: true })
          return
        }
        if (!callStartedAtMs && remoteJoined) {
          await syncTimerFromServer()
        }
      } catch (_) {}
    }, 2000)
    return () => clearInterval(id)
  }, [tracksReady, callEndedMessage, appointmentId, authToken, backendUrl, callStartedAtMs, remoteJoined, callActive])

  useEffect(() => {
    const client = clientRef.current
    if (!client || !tracksReady) return undefined
    const onQuality = (stats) => {
      // Agora Web: uplinkNetworkQuality / downlinkNetworkQuality 0–6 (4+ = poor)
      const up = stats?.uplinkNetworkQuality ?? 0
      const down = stats?.downlinkNetworkQuality ?? 0
      const poor = up >= 4 || down >= 4
      if (poor) {
        poorStreakRef.current += 1
      } else {
        poorStreakRef.current = 0
        setPoorConnection(false)
        return
      }
      if (poorStreakRef.current >= 3) setPoorConnection(true)
    }
    client.on('network-quality', onQuality)
    return () => {
      try {
        client.off('network-quality', onQuality)
      } catch (_) {}
    }
  }, [tracksReady])

  const toggleMute = async () => {
    const audio = localTracksRef.current[0]
    if (!audio) return
    await audio.setEnabled(muted)
    setMuted(!muted)
  }

  const toggleVideo = async () => {
    const video = localTracksRef.current[1]
    if (!video) return
    await video.setEnabled(videoOff)
    setVideoOff(!videoOff)
  }

  const enableMyCamera = async () => {
    const client = clientRef.current
    if (!client || publishCamera) return
    try {
      const videoTrack = await AgoraRTC.createCameraVideoTrack()
      localTracksRef.current = [localTracksRef.current[0], videoTrack]
      await client.publish(videoTrack)
      setPublishCamera(true)
      setVideoOff(false)
      setCameraHint(null)
      if (localVideoRef.current) videoTrack.play(localVideoRef.current, { fit: 'cover' })
      await refreshRemoteStreams()
      setTimeout(() => refreshRemoteStreams(), 1000)
      setTimeout(() => refreshRemoteStreams(), 3000)
    } catch (_) {
      toast.error('Camera in use. Close the patient tab or use a second browser.')
    }
  }

  const toggleFullscreen = () => {
    const el = videoPanelRef.current
    if (!el) return
    if (!document.fullscreenElement) {
      el.requestFullscreen?.().then(() => setIsFullscreen(true)).catch(() => {})
    } else {
      document.exitFullscreen?.().then(() => setIsFullscreen(false)).catch(() => {})
    }
  }

  const openChat = () => {
    setShowChat(true)
    setSidebarTab('chat')
  }

  const appendChatMessages = (msgs) => {
    if (!msgs || !msgs.length) return
    setChatMessages((prev) => {
      const seen = new Set(prev.map((m) => m.id).filter((id) => id != null))
      const next = [...prev]
      for (const m of msgs) {
        if (m.id != null && seen.has(m.id)) continue
        next.push({ id: m.id, from: m.role === 'doctor' ? 'doctor' : 'patient', text: m.text, at: m.at ? new Date(m.at) : new Date() })
        if (m.id != null) lastChatIdRef.current = Math.max(lastChatIdRef.current, m.id)
      }
      return next
    })
  }

  const fetchChat = async () => {
    if (!appointmentId || !authToken) return
    try {
      const { data } = await axios.get(
        `${backendUrl}/api/doctor/appointments/${appointmentId}/chat`,
        { params: { after: lastChatIdRef.current }, headers: { dToken: authToken } }
      )
      if (data?.success) appendChatMessages(data.messages)
    } catch (_) {}
  }

  const sendChat = async () => {
    const text = chatInput.trim()
    if (!text) return
    setChatInput('')
    try {
      const { data } = await axios.post(
        `${backendUrl}/api/doctor/appointments/${appointmentId}/chat`,
        { text },
        { headers: { dToken: authToken } }
      )
      if (data?.success && data.message) appendChatMessages([data.message])
      else toast.error(data?.message || 'Could not send message')
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not send message')
    }
  }

  useEffect(() => {
    if (loading || callEndedMessage) return
    fetchChat()
    const timer = setInterval(fetchChat, 2500)
    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, callEndedMessage, appointmentId, authToken])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] bg-white rounded-2xl border border-slate-200">
        <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4" />
        <p className="text-slate-600 font-medium">Connecting secure video consultation…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-lg mx-auto p-8 text-center bg-white rounded-2xl border border-red-100 shadow-sm">
        <p className="text-red-600 font-semibold mb-2">Video consultation unavailable</p>
        <p className="text-slate-600 text-sm mb-4">{error}</p>
        <div className="flex flex-wrap gap-3 justify-center">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-5 py-2.5 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700"
          >
            Retry video
          </button>
          <button type="button" onClick={onLeave} className="px-5 py-2.5 bg-slate-800 text-white rounded-lg text-sm">
            Back to appointments
          </button>
        </div>
      </div>
    )
  }

  const statusLabel = callEndedMessage ? 'Ended' : callActive || remoteJoined ? 'In Progress' : 'Connecting'
  const connectLabel = callEndedMessage
    ? 'Disconnected'
    : remoteJoined
      ? 'Connected'
      : 'Connecting…'

  return (
    <div className="flex flex-col bg-mc-bg rounded-2xl overflow-hidden min-h-[calc(100vh-120px)] lg:min-h-0 lg:h-[calc(100vh-104px)]">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-3 border-b border-slate-200 bg-white">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onLeave}
            title="Back"
            className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-600 hover:bg-slate-100 shrink-0"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          </button>
          <div className="min-w-0">
            <p className="font-bold text-slate-900 text-base sm:text-lg truncate">Video Consultation</p>
            <p className="text-xs text-slate-500 truncate">
              Consultation ID: <span className="text-blue-600 font-semibold">{consultationId || apptLabel}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Call Duration</p>
            <p className="text-sm font-bold text-blue-600 tabular-nums">
              {callStartedAtMs ? formatCallDuration(callSeconds) : '00:00'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => handleCallEnded('You ended the consultation.', { notifyServer: true })}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm font-semibold shadow-sm"
          >
            <svg className="w-4 h-4 rotate-[135deg]" fill="currentColor" viewBox="0 0 24 24"><path d="M6.62 10.79a15.05 15.05 0 006.59 6.59l2.2-2.2a1 1 0 011.01-.24 11.36 11.36 0 003.56.57 1 1 0 011 1V20a1 1 0 01-1 1A17 17 0 013 4a1 1 0 011-1h3.5a1 1 0 011 1c0 1.25.2 2.45.57 3.57a1 1 0 01-.25 1L6.62 10.79z" /></svg>
            End consultation
          </button>
        </div>
      </div>

      {cameraHint && (
        <div className="px-5 py-2 bg-amber-50 border-b border-amber-100 text-amber-800 text-xs">{cameraHint}</div>
      )}
      {poorConnection && (
        <div className="px-5 py-2 bg-orange-600 text-white text-xs font-semibold text-center">
          Poor connection — move closer to Wi‑Fi or switch network
        </div>
      )}
      {slotBanner && (
        <div className="px-5 py-2 bg-amber-600 text-white text-xs font-semibold text-center flex items-center justify-center gap-3">
          <span>{slotBanner}</span>
          <button type="button" className="underline opacity-90" onClick={() => setSlotBanner(null)}>
            Dismiss
          </button>
        </div>
      )}

      <div className="flex flex-1 flex-col lg:flex-row min-h-0 gap-4 p-4 overflow-y-auto lg:overflow-hidden">
        {/* Left column — video + consultation info */}
        <div className="flex-1 flex flex-col min-w-0 gap-4 lg:overflow-y-auto">
          {/* Video panel */}
          <div ref={videoPanelRef} className="relative bg-slate-900 rounded-2xl overflow-hidden shadow-lg h-[340px] sm:h-[420px] lg:h-[460px] shrink-0">
            <div ref={remoteVideoRef} className="absolute inset-0 w-full h-full" />

            {!remoteJoined && !callEndedMessage && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white/80 px-6 text-center pointer-events-none z-10">
                <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center mb-4">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <p className="font-medium">Waiting for patient to join…</p>
              </div>
            )}

            {remoteJoined && !remoteVideoActive && (
              <div className="absolute inset-0 flex items-center justify-center text-white/90 text-sm px-8 text-center pointer-events-none z-10">
                Patient connected — waiting for camera…
              </div>
            )}

            {/* Connected pill */}
            <span className="absolute top-4 left-4 z-20 inline-flex items-center gap-2 text-xs font-semibold text-white bg-slate-900/70 backdrop-blur px-3 py-1.5 rounded-lg">
              <span className={`w-2 h-2 rounded-full ${remoteJoined ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
              {connectLabel}
            </span>

            {/* Fullscreen */}
            <button
              type="button"
              onClick={toggleFullscreen}
              title="Fullscreen"
              className="absolute top-4 right-4 z-20 w-9 h-9 rounded-lg bg-slate-900/70 backdrop-blur hover:bg-slate-900/90 text-white flex items-center justify-center"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
            </button>

            {/* Doctor self-view PIP — mirrored */}
            <div className="absolute bottom-20 sm:bottom-24 right-4 z-20 w-32 sm:w-44 aspect-[4/3] rounded-xl overflow-hidden border-2 border-white/60 shadow-2xl bg-slate-800">
              <div
                ref={localVideoRef}
                className={`w-full h-full ${publishCamera && !videoOff ? 'scale-x-[-1]' : ''}`}
              />
              {!publishCamera || videoOff ? (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-800/90 text-white/70 text-[10px] px-2 text-center">
                  {publishCamera ? 'Camera off' : 'You (camera off)'}
                </div>
              ) : null}
              {muted && (
                <span className="absolute bottom-1.5 right-1.5 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center shadow">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 5L5 19" /></svg>
                </span>
              )}
            </div>

            {/* Floating toolbar */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-30 flex items-end gap-3 sm:gap-4 bg-slate-900/80 backdrop-blur px-4 py-2.5 rounded-2xl shadow-xl">
              <RoundCtrl label={muted ? 'Unmute' : 'Mute'} active={!muted} onClick={toggleMute}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {muted ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  )}
                </svg>
              </RoundCtrl>

              {publishCamera ? (
                <RoundCtrl label={videoOff ? 'Camera on' : 'Camera'} active={!videoOff} onClick={toggleVideo}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </RoundCtrl>
              ) : (
                <RoundCtrl label="Enable cam" onClick={enableMyCamera}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </RoundCtrl>
              )}

              <RoundCtrl label="Share" onClick={() => toast.info('Screen share coming soon')}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </RoundCtrl>

              <RoundCtrl label="Chat" active={sidebarTab === 'chat'} onClick={openChat}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </RoundCtrl>

              <div className="relative">
                <RoundCtrl label="More" active={showMore} onClick={() => setShowMore((v) => !v)}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h.01M12 12h.01M19 12h.01" /></svg>
                </RoundCtrl>
                {showMore && (
                  <div className="absolute bottom-14 right-0 w-44 bg-white rounded-xl shadow-2xl border border-slate-100 py-1.5 z-40">
                    <button
                      type="button"
                      onClick={() => { setSpeakerOn((v) => !v); toast.info(speakerOn ? 'Speaker muted' : 'Speaker on'); setShowMore(false) }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
                      {speakerOn ? 'Mute speaker' : 'Unmute speaker'}
                    </button>
                    <button
                      type="button"
                      onClick={() => { toggleFullscreen(); setShowMore(false) }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
                      {isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                    </button>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => handleCallEnded('You ended the consultation.', { notifyServer: true })}
                title="End Call"
                className="flex flex-col items-center gap-1"
              >
                <span className="inline-flex items-center gap-2 h-11 px-4 rounded-full bg-red-500 hover:bg-red-600 text-white text-sm font-semibold shadow">
                  <svg className="w-4 h-4 rotate-[135deg]" fill="currentColor" viewBox="0 0 24 24"><path d="M6.62 10.79a15.05 15.05 0 006.59 6.59l2.2-2.2a1 1 0 011.01-.24 11.36 11.36 0 003.56.57 1 1 0 011 1V20a1 1 0 01-1 1A17 17 0 013 4a1 1 0 011-1h3.5a1 1 0 011 1c0 1.25.2 2.45.57 3.57a1 1 0 01-.25 1L6.62 10.79z" /></svg>
                  End Call
                </span>
                <span className="text-[10px] font-medium text-transparent">.</span>
              </button>
            </div>
          </div>

          {/* Consultation Information */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 shrink-0">
            <div className="flex items-center gap-2.5 mb-4">
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-blue-50 text-blue-600">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              </span>
              <h3 className="text-base font-bold text-slate-900">Consultation Information</h3>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="min-w-0">
                <p className="text-xs text-slate-400 font-medium">Consultation ID</p>
                <p className="text-sm font-semibold text-slate-800 mt-0.5 truncate">{consultationId || apptLabel}</p>
              </div>
              <div className="min-w-0">
                <p className="text-xs text-slate-400 font-medium">Appointment Time</p>
                <p className="text-sm font-semibold text-slate-800 mt-0.5 truncate">{scheduledTime || '—'}</p>
              </div>
              <div className="min-w-0">
                <p className="text-xs text-slate-400 font-medium">Consultation Type</p>
                <span className="inline-flex items-center mt-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold">Online Video</span>
              </div>
              <div className="min-w-0">
                <p className="text-xs text-slate-400 font-medium">Status</p>
                <span className={`inline-flex items-center mt-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  statusLabel === 'Ended' ? 'bg-slate-100 text-slate-600' : statusLabel === 'In Progress' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
                }`}>{statusLabel}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right sidebar */}
        <div className="w-full lg:w-[360px] xl:w-[380px] shrink-0 flex flex-col gap-4 lg:overflow-y-auto">
          {/* Patient Details */}
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-blue-50 text-blue-600">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                </span>
                <h3 className="text-base font-bold text-slate-900">Patient Details</h3>
              </div>
              {appointment?.payment && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                  Verified
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 mb-4">
              <img src={patientImage} alt="" className="w-12 h-12 rounded-full object-cover ring-2 ring-blue-100" />
              <div className="min-w-0">
                <p className="font-bold text-slate-900 truncate">{patientName}</p>
                <p className="text-xs text-slate-500">{patientAge} Years, <span className="capitalize">{patientGender}</span></p>
              </div>
            </div>
            <dl className="space-y-2.5 text-sm">
              <div className="flex gap-3">
                <dt className="w-16 shrink-0 text-slate-400 text-xs pt-0.5">Phone</dt>
                <dd className="font-medium text-slate-800 break-all">{patientPhone}</dd>
              </div>
              <div className="flex gap-3">
                <dt className="w-16 shrink-0 text-slate-400 text-xs pt-0.5">Email</dt>
                <dd className="font-medium text-slate-800 break-all">{patientEmail}</dd>
              </div>
              <div className="flex gap-3">
                <dt className="w-16 shrink-0 text-slate-400 text-xs pt-0.5">Address</dt>
                <dd className="font-medium text-slate-800">{patientAddress}</dd>
              </div>
            </dl>
          </section>

          {/* Tabs: Chat / Prescription */}
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col flex-1 min-h-[360px] overflow-hidden">
            <div className="flex border-b border-slate-100">
              {[
                { id: 'chat', label: 'Chat' },
                { id: 'prescription', label: 'Prescription' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSidebarTab(tab.id)}
                  className={`flex-1 py-3 text-sm font-semibold transition-colors relative ${
                    sidebarTab === tab.id ? 'text-blue-600' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {tab.label}
                  {sidebarTab === tab.id && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />}
                </button>
              ))}
            </div>

            {sidebarTab === 'chat' ? (
              <div className="flex flex-col flex-1 min-h-0">
                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/60">
                  {chatMessages.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-6">No messages yet. Say hello to your patient.</p>
                  ) : (
                    chatMessages.map((m, i) => (
                      <div key={i} className={`flex ${m.from === 'doctor' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] text-xs rounded-2xl px-3 py-2 ${m.from === 'doctor' ? 'bg-blue-600 text-white rounded-br-sm' : 'bg-white border border-slate-200 text-slate-800 rounded-bl-sm'}`}>
                          {m.text}
                          <span className={`block text-[9px] mt-1 ${m.from === 'doctor' ? 'text-white/70' : 'text-slate-400'}`}>
                            {m.at?.toLocaleTimeString?.([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <div className="p-3 border-t border-slate-100 flex items-center gap-2">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && sendChat()}
                    placeholder="Type a message…"
                    className="flex-1 text-sm border border-slate-200 rounded-full px-4 py-2 outline-none focus:border-blue-400"
                  />
                  <button
                    type="button"
                    onClick={sendChat}
                    className="w-9 h-9 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center shrink-0"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" /></svg>
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col flex-1 min-h-0">
                {/* Save bar */}
                <div className="shrink-0 p-3 border-b border-slate-100 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-slate-500 truncate">
                      {saveState === 'saving' || savingPrescription
                        ? 'Saving…'
                        : saveState === 'dirty'
                          ? 'Unsaved changes'
                          : saveState === 'saved' && lastSavedAt
                            ? `Saved ${lastSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                            : 'Save anytime during the call'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => saveConsultationDraft()}
                    disabled={savingPrescription || saveState === 'saving'}
                    className="shrink-0 px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white text-xs font-bold uppercase tracking-wide"
                  >
                    Save
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {/* Symptoms */}
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-blue-700 mb-2">Symptoms</p>
                    {symptoms.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {symptoms.map((s, i) => (
                          <span key={i} className="px-2 py-1 rounded-lg bg-teal-50 text-teal-800 text-xs border border-teal-100">{s}</span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400">No symptoms recorded for this booking.</p>
                    )}
                    {patientBookingNotes.length > 0 && (
                      <p className="text-xs text-slate-600 mt-2 leading-relaxed"><span className="font-semibold">Notes:</span> {patientBookingNotes.join(' · ')}</p>
                    )}
                  </div>

                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-blue-700 mb-2">Uploaded Reports</p>
                    {bookingReportUrl ? (
                      <a
                        href={bookingReportUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:underline font-medium"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                        View report uploaded at booking
                      </a>
                    ) : (
                      <p className="text-xs text-slate-400">No reports uploaded for this booking.</p>
                    )}
                  </div>

                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-blue-700 mb-2">Diagnosis</p>
                    <textarea
                      value={diagnosis}
                      onChange={(e) => setDiagnosis(e.target.value)}
                      rows={2}
                      placeholder="Primary diagnosis…"
                      className="w-full text-xs border border-slate-200 rounded-lg p-3 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none resize-y"
                    />
                  </div>

                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-blue-700 mb-2">Prescription</p>
                    <textarea
                      value={prescription}
                      onChange={(e) => setPrescription(e.target.value)}
                      rows={4}
                      placeholder="Medicines, dosage, duration…"
                      className="w-full text-xs border border-slate-200 rounded-lg p-3 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none resize-y"
                    />
                  </div>

                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-blue-700 mb-2">Clinical notes</p>
                    <textarea
                      value={consultNotes}
                      onChange={(e) => setConsultNotes(e.target.value)}
                      rows={3}
                      placeholder="Exam findings, vitals…"
                      className="w-full text-xs border border-slate-200 rounded-lg p-3 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none resize-y"
                    />
                  </div>

                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-blue-700 mb-2">Advice to patient</p>
                    <textarea
                      value={advice}
                      onChange={(e) => setAdvice(e.target.value)}
                      rows={2}
                      placeholder="Diet, rest, warning signs…"
                      className="w-full text-xs border border-slate-200 rounded-lg p-3 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none resize-y"
                    />
                  </div>

                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-blue-700 mb-2">Follow-up date</p>
                    <input
                      type="date"
                      value={followupDate}
                      onChange={(e) => setFollowupDate(e.target.value)}
                      className="w-full text-xs border border-slate-200 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none"
                    />
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* View appointment details */}
          <button
            type="button"
            onClick={() => toast.info(`Appointment ${apptLabel}${scheduledTime ? ` · ${scheduledTime}` : ''}`)}
            className="shrink-0 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold shadow-sm"
          >
            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
            View Appointment Details
          </button>
        </div>
      </div>

      {callEndedMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl px-8 py-10 text-center max-w-sm mx-4">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 3l1.5 1.5M3 21l1.5-1.5M21 3l-1.5 1.5M21 21l-1.5-1.5" />
              </svg>
            </div>
            <p className="text-lg font-bold text-slate-900 mb-1">Call ended</p>
            <p className="text-sm text-slate-600">{callEndedMessage}</p>
          </div>
        </div>
      )}
    </div>
  )
}

export default DoctorVideoConsultRoom
