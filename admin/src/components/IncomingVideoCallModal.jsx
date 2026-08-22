import React, { useCallback, useContext, useEffect, useState } from 'react'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { DoctorContext } from '../context/DoctorContext'
import { AppContext } from '../context/AppContext'

/**
 * Polls /api/doctor/call/incoming and shows full-screen ringing UI for video consult requests.
 */
const IncomingVideoCallModal = () => {
  const { dToken } = useContext(DoctorContext)
  const { backendUrl } = useContext(AppContext)
  const navigate = useNavigate()
  const [incoming, setIncoming] = useState(null)
  const [acting, setActing] = useState(false)

  const fetchIncoming = useCallback(async () => {
    if (!dToken) return
    try {
      const { data } = await axios.get(`${backendUrl}/api/doctor/call/incoming`, {
        headers: { dToken },
      })
      if (data.success && data.calls?.length > 0) {
        setIncoming(data.calls[0])
      } else {
        setIncoming(null)
      }
    } catch (_) {
      /* ignore poll errors */
    }
  }, [backendUrl, dToken])

  useEffect(() => {
    if (!dToken) return undefined
    let cancelled = false
    let inFlight = false
    const tick = async () => {
      if (cancelled || inFlight || document.hidden) return
      inFlight = true
      try {
        await fetchIncoming()
      } finally {
        inFlight = false
      }
    }
    tick()
    const id = setInterval(tick, 5000)
    const onVis = () => { if (!document.hidden) tick() }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      cancelled = true
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [dToken, fetchIncoming])

  const respond = async (action) => {
    if (!incoming || acting) return
    setActing(true)
    const apptId = incoming.appointmentId
    try {
      const { data } = await axios.post(
        `${backendUrl}/api/doctor/appointments/${apptId}/call/${action}`,
        {},
        { headers: { dToken } },
      )
      if (!data.success) {
        toast.error(data.message || 'Could not update call')
        return
      }
      if (action === 'accept') {
        setIncoming(null)
        navigate(`/doctor-video/${apptId}`)
      } else {
        setIncoming(null)
        toast.info(action === 'busy' ? 'Marked as busy' : 'Call declined')
      }
    } catch (e) {
      toast.error(e.message || 'Network error')
    } finally {
      setActing(false)
    }
  }

  if (!incoming) return null

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden animate-fade-in-up">
        <div className="bg-gradient-to-r from-teal-600 to-blue-600 px-6 py-8 text-center text-white">
          <p className="text-sm uppercase tracking-wide opacity-90">Incoming consultation</p>
          <h2 className="text-2xl font-bold mt-2">{incoming.patientName || 'Patient'}</h2>
          <p className="text-sm mt-2 opacity-90">
            {incoming.slotDate} · {incoming.slotTime}
            {incoming.tokenNumber ? ` · Token #${incoming.tokenNumber}` : ''}
          </p>
        </div>
        <div className="p-6 flex flex-col gap-3">
          <button
            type="button"
            disabled={acting}
            onClick={() => respond('accept')}
            className="w-full py-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold disabled:opacity-60"
          >
            Accept & join video
          </button>
          <div className="flex gap-3">
            <button
              type="button"
              disabled={acting}
              onClick={() => respond('reject')}
              className="flex-1 py-2.5 rounded-xl border border-red-200 text-red-600 font-medium hover:bg-red-50"
            >
              Reject
            </button>
            <button
              type="button"
              disabled={acting}
              onClick={() => respond('busy')}
              className="flex-1 py-2.5 rounded-xl border border-amber-200 text-amber-700 font-medium hover:bg-amber-50"
            >
              Busy
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default IncomingVideoCallModal
