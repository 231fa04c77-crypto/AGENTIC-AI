import React, { useContext, useEffect, useRef, useState } from 'react'
import axios from 'axios'
import AgoraRTC from 'agora-rtc-sdk-ng'
import { AppContext } from '../context/AppContext'
import { toast } from 'react-toastify'

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
    const videoTrack = await AgoraRTC.createCameraVideoTrack()
    return { tracks: [audioTrack, videoTrack], videoTrack, cameraBlocked: false }
  } catch (_) {
    return { tracks: [audioTrack], videoTrack: null, cameraBlocked: true }
  }
}

/**
 * Agora RTC room for doctor or patient (web).
 * Doctor defaults to receive-only (mic, no camera) so patient can use the camera on the same PC.
 */
const VideoConsultRoom = ({
  appointmentId,
  role = 'doctor',
  authToken,
  authHeader = 'dToken',
  peerLabel = 'participant',
  scheduledTime = null,
  publishCamera: publishCameraInitial = role !== 'doctor',
  onLeave,
}) => {
  const { backendUrl } = useContext(AppContext)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [muted, setMuted] = useState(false)
  const [videoOff, setVideoOff] = useState(false)
  const [remoteJoined, setRemoteJoined] = useState(false)
  const [remoteVideoActive, setRemoteVideoActive] = useState(false)
  const [tracksReady, setTracksReady] = useState(false)
  const [callSeconds, setCallSeconds] = useState(0)
  const [callActive, setCallActive] = useState(false)
  const [publishCamera, setPublishCamera] = useState(publishCameraInitial)
  const [cameraHint, setCameraHint] = useState(
    role === 'doctor' && !publishCameraInitial
      ? 'Receive-only mode: your camera is off so the patient can use the webcam on this PC.'
      : null
  )

  const clientRef = useRef(null)
  const localTracksRef = useRef([])
  const localVideoRef = useRef(null)
  const remoteVideoRef = useRef(null)
  const remoteUsersRef = useRef(new Map())

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
    if (hasRemote) setCallActive(true)
    const hasVideo = [...remoteUsersRef.current.values()].some((u) => u.videoTrack)
    if (!hasVideo) setRemoteVideoActive(false)
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

    const start = async () => {
      try {
        const tokenPath =
          role === 'doctor'
            ? `/api/doctor/appointments/${appointmentId}/agora-token`
            : `/api/user/appointments/${appointmentId}/agora-token`

        const { data } = await axios.post(
          `${backendUrl}${tokenPath}`,
          {},
          { headers: { [authHeader]: authToken } }
        )

        if (!data?.success) {
          throw new Error(data?.message || 'Could not start video session')
        }

        const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' })
        clientRef.current = client

        client.on('user-joined', (user) => {
          remoteUsersRef.current.set(user.uid, user)
          syncRemoteJoined()
        })

        client.on('user-published', async (user, mediaType) => {
          await client.subscribe(user, mediaType)
          remoteUsersRef.current.set(user.uid, user)
          if (mediaType === 'video') playRemoteVideo(user)
          if (mediaType === 'audio') user.audioTrack?.play()
          syncRemoteJoined()
        })

        client.on('user-unpublished', (user, mediaType) => {
          if (mediaType === 'video') {
            setRemoteVideoActive(false)
            try {
              user.videoTrack?.stop()
            } catch (_) {}
          }
        })

        client.on('user-left', (user) => {
          remoteUsersRef.current.delete(user.uid)
          syncRemoteJoined()
        })

        await client.join(data.appId, data.channel, data.token, data.uid)
        setCallActive(true)

        for (const user of client.remoteUsers) {
          await subscribeRemoteUser(client, user)
        }

        const { tracks, videoTrack, cameraBlocked } = await createLocalTracks(publishCameraInitial)
        localTracksRef.current = tracks
        if (cameraBlocked) {
          setPublishCamera(false)
          setCameraHint(
            'Webcam is in use in another tab/app. Receiving patient video only — close other video tabs or use Chrome + Edge.'
          )
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
      cleanup()
    }
  }, [appointmentId, role, authToken, authHeader, backendUrl, publishCameraInitial])

  useEffect(() => {
    if (!tracksReady || loading) return
    const videoTrack = localTracksRef.current[1]
    const container = localVideoRef.current
    if (videoTrack && container && publishCamera) {
      try {
        videoTrack.play(container, { fit: 'cover' })
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
    if (!callActive) return undefined
    const id = setInterval(() => setCallSeconds((s) => s + 1), 1000)
    return () => clearInterval(id)
  }, [callActive])

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
      if (localVideoRef.current) {
        videoTrack.play(localVideoRef.current, { fit: 'cover' })
      }
    } catch (_) {
      toast.error('Camera still in use. Close the patient tab or use a second browser.')
    }
  }

  const handleLeave = () => {
    onLeave?.()
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-gray-600">
        <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4" />
        <p>Connecting to secure video room…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-lg mx-auto p-6 text-center">
        <p className="text-red-600 font-semibold mb-2">Video call unavailable</p>
        <p className="text-gray-600 text-sm mb-4">{error}</p>
        <button type="button" onClick={handleLeave} className="px-4 py-2 bg-gray-800 text-white rounded-lg text-sm">
          Go back
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full min-h-[70vh] bg-gray-900 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800/90 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-2 w-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-white text-sm font-semibold tabular-nums">{formatCallDuration(callSeconds)}</span>
          <span className="text-gray-400 text-xs">call duration</span>
        </div>
        {scheduledTime && <span className="text-gray-400 text-xs">Scheduled: {scheduledTime}</span>}
      </div>

      {cameraHint && (
        <div className="px-4 py-2 bg-amber-900/40 border-b border-amber-700/50 text-amber-100 text-xs">
          {cameraHint}
        </div>
      )}

      <div className="flex-1 relative grid grid-cols-1 md:grid-cols-2 gap-2 p-2">
        <div className="relative bg-black rounded-lg min-h-[200px] md:min-h-[320px]">
          <div ref={remoteVideoRef} className="w-full h-full min-h-[200px]" />
          {!remoteJoined && (
            <div className="absolute inset-0 flex items-center justify-center text-white/70 text-sm pointer-events-none px-4 text-center">
              Waiting for {peerLabel} to join…
            </div>
          )}
          {remoteJoined && !remoteVideoActive && (
            <div className="absolute inset-0 flex items-center justify-center text-white/80 text-sm pointer-events-none px-6 text-center">
              {peerLabel} connected — waiting for their camera…
              <br />
              <span className="text-white/50 text-xs mt-2">
                On one PC: join patient first, doctor uses receive-only (camera off).
              </span>
            </div>
          )}
          {remoteJoined && (
            <span className="absolute top-2 left-2 text-xs text-white/90 bg-green-600/80 px-2 py-1 rounded">
              {peerLabel} connected{remoteVideoActive ? ' · video on' : ' · audio'}
            </span>
          )}
        </div>
        <div className="relative bg-black rounded-lg min-h-[160px]">
          <div ref={localVideoRef} className="w-full h-full min-h-[160px]" />
          {!publishCamera && (
            <div className="absolute inset-0 flex items-center justify-center text-white/60 text-xs px-4 text-center pointer-events-none">
              Your camera is off (receive-only)
            </div>
          )}
          <span className="absolute bottom-2 left-2 text-xs text-white/80 bg-black/50 px-2 py-1 rounded">
            You ({role})
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3 p-4 bg-gray-800">
        <button type="button" onClick={toggleMute} className="px-4 py-2 rounded-full bg-white/10 text-white text-sm hover:bg-white/20">
          {muted ? 'Unmute' : 'Mute'}
        </button>
        {publishCamera ? (
          <button type="button" onClick={toggleVideo} className="px-4 py-2 rounded-full bg-white/10 text-white text-sm hover:bg-white/20">
            {videoOff ? 'Camera on' : 'Camera off'}
          </button>
        ) : (
          <button type="button" onClick={enableMyCamera} className="px-4 py-2 rounded-full bg-white/10 text-white text-sm hover:bg-white/20">
            Enable my camera
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            toast.info('Call ended')
            handleLeave()
          }}
          className="px-5 py-2 rounded-full bg-red-600 text-white text-sm font-semibold hover:bg-red-700"
        >
          End call
        </button>
      </div>
    </div>
  )
}

export default VideoConsultRoom
