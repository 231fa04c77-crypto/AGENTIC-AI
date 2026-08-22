import { useContext, useEffect, useRef } from 'react'
import { toast } from 'react-toastify'
import axios from 'axios'
import { ReceptionContext } from '../context/ReceptionContext'
import { useSocket } from '../context/SocketContext'

const STATUS_TOAST = {
  'in-clinic': 'info',
  'in-consult': 'info',
  'on-break': 'warning',
  unavailable: 'error',
  emergency: 'warning',
  offline: 'warning',
}

const showStatusToast = (data) => {
  if (!data?.message) return
  const type = STATUS_TOAST[data.status] || 'info'
  toast[type](data.message, {
    toastId: `doctor-status-${data.doctorId}-${data.timestamp}`,
    autoClose: 6000,
  })
}

const matchesHospital = (data, recInfo) => {
  const hid = recInfo?.hospitalId ?? recInfo?.hospital_id
  if (!hid) return true
  if (!data?.hospitalId) return true
  return String(data.hospitalId) === String(hid)
}

/**
 * Reception toast when a doctor changes status (In Clinic / In Consult / On Break / Unavailable).
 * Uses Socket.IO when available, with HTTP polling fallback.
 */
const DoctorStatusListener = () => {
  const { recToken, recInfo } = useContext(ReceptionContext)
  const { socket } = useSocket()
  const lastPollRef = useRef(new Date().toISOString())
  const seenRef = useRef(new Set())

  const handleEvent = (data) => {
    if (!data?.doctorId) return
    const key = `${data.doctorId}-${data.timestamp}`
    if (seenRef.current.has(key)) return
    seenRef.current.add(key)
    if (seenRef.current.size > 100) {
      const arr = [...seenRef.current]
      seenRef.current = new Set(arr.slice(-50))
    }
    if (!matchesHospital(data, recInfo)) return
    showStatusToast(data)
  }

  useEffect(() => {
    if (!recToken) return

    const onSocket = (data) => handleEvent(data)
    if (socket) {
      socket.on('doctor-status-changed', onSocket)
    }

    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000'
    const poll = async () => {
      try {
        const { data } = await axios.get(
          `${backendUrl}/api/reception/doctor-status-events`,
          {
            headers: { rectoken: recToken },
            params: { since: lastPollRef.current },
          }
        )
        if (data.success && Array.isArray(data.events)) {
          data.events.forEach(handleEvent)
          if (data.events.length > 0) {
            lastPollRef.current = data.events[data.events.length - 1].timestamp
          }
        }
      } catch {
        /* silent — socket may still work */
      }
    }

    poll()
    const interval = setInterval(poll, 15000)

    return () => {
      if (socket) socket.off('doctor-status-changed', onSocket)
      clearInterval(interval)
    }
  }, [recToken, recInfo, socket])

  return null
}

export default DoctorStatusListener
