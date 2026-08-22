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

const VideoConsultRoom = ({
  appointmentId,
  role = 'patient',
  authToken,
  authHeader = 'token',
  peerLabel = 'doctor',
  scheduledTime = null,
  onLeave,
}) => {
  const { backendUrl } = useContext(AppContext)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [muted, setMuted] = useState(false)
  const [videoOff, setVideoOff] = useState(false)
  const [remoteJoined, setRemoteJoined] = useState(false)
  const [tracksReady, setTracksReady] = useState(false)
  const [callSeconds, setCallSeconds] = useState(0)
  const [callActive, setCallActive] = useState(false)

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
      user.videoTrack.play(container)
      return true
    } catch (_) {
      return false
    }
  }

  const syncRemoteJoined = () => {
    const hasRemote = remoteUsersRef.current.size > 0
    setRemoteJoined(hasRemote)
    if (hasRemote) setCallActive(true)
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

        client.on('user-left', (user) => {
          remoteUsersRef.current.delete(user.uid)
          syncRemoteJoined()
        })

        await client.join(data.appId, data.channel, data.token, data.uid)
        setCallActive(true)

        for (const user of client.remoteUsers) {
          await subscribeRemoteUser(client, user)
        }

        const tracks = await AgoraRTC.createMicrophoneAndCameraTracks()
        localTracksRef.current = tracks
        await client.publish(tracks)

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
  }, [appointmentId, role, authToken, authHeader, backendUrl])

  useEffect(() => {
    if (!tracksReady || loading) return
    const videoTrack = localTracksRef.current[1]
    const container = localVideoRef.current
    if (videoTrack && container) {
      try {
        videoTrack.play(container)
      } catch (_) {}
    }
    remoteUsersRef.current.forEach((user) => playRemoteVideo(user))
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

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-gray-600">
        <div className="w-12 h-12 border-4 border-cyan-200 border-t-cyan-600 rounded-full animate-spin mb-4" />
        <p>Connecting to your doctor…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-lg mx-auto p-6 text-center card">
        <p className="text-red-600 font-semibold mb-2">Video call unavailable</p>
        <p className="text-gray-600 text-sm mb-4">{error}</p>
        <button type="button" onClick={onLeave} className="btn btn-secondary">
          Go back
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col rounded-2xl overflow-hidden shadow-xl border border-gray-200 bg-gray-900">
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800/90 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-2 w-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-white text-sm font-semibold tabular-nums">
            {formatCallDuration(callSeconds)}
          </span>
        </div>
        {scheduledTime && <span className="text-gray-400 text-xs">Scheduled: {scheduledTime}</span>}
      </div>
      <div className="flex-1 relative grid grid-cols-1 md:grid-cols-2 gap-2 p-2 min-h-[360px]">
        <div className="relative bg-black rounded-lg min-h-[200px]">
          <div ref={remoteVideoRef} className="w-full h-full min-h-[200px]" />
          {!remoteJoined && (
            <div className="absolute inset-0 flex items-center justify-center text-white/70 text-sm px-4 text-center pointer-events-none">
              Waiting for {peerLabel} to join the call…
            </div>
          )}
          {remoteJoined && (
            <span className="absolute top-2 left-2 text-xs text-white/90 bg-green-600/80 px-2 py-1 rounded">
              {peerLabel} connected
            </span>
          )}
        </div>
        <div className="relative bg-black rounded-lg min-h-[160px]">
          <div ref={localVideoRef} className="w-full h-full min-h-[160px]" />
          <span className="absolute bottom-2 left-2 text-xs text-white/80 bg-black/50 px-2 py-1 rounded">
            You
          </span>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3 p-4 bg-gray-800">
        <button type="button" onClick={toggleMute} className="btn btn-secondary text-sm">
          {muted ? 'Unmute' : 'Mute'}
        </button>
        <button type="button" onClick={toggleVideo} className="btn btn-secondary text-sm">
          {videoOff ? 'Camera on' : 'Camera off'}
        </button>
        <button
          type="button"
          onClick={() => {
            toast.info('Call ended')
            onLeave?.()
          }}
          className="btn bg-red-600 hover:bg-red-700 text-white border-0 text-sm"
        >
          End call
        </button>
      </div>
    </div>
  )
}

export default VideoConsultRoom
