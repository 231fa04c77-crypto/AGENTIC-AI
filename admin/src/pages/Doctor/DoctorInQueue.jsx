import React, { useState, useEffect, useContext, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { DoctorContext } from '../../context/DoctorContext'
import { AdminPageLayout, KpiCard, McCard } from '../../components/mc'
import QueueManager from '../../components/QueueManager'
import { labelForLifecycle } from '../../utils/lifecycleLabels'
import { useSocket } from '../../context/SocketContext'

function getTodayDate() {
  const today = new Date()
  const d = today.getDate()
  const m = today.getMonth() + 1
  const y = today.getFullYear()
  return `${d}_${m}_${y}`
}

const statusLabel = (apt) => {
  const lifecycle = String(apt.lifecycle_status || apt.lifecycleStatus || '').toUpperCase()
  const status = String(apt.status || '').toLowerCase()
  const reception = String(apt.receptionStatus || '').toUpperCase()
  const desk = String(apt.deskStatus || '').toUpperCase()

  if (
    lifecycle === 'IN_PROGRESS' ||
    lifecycle === 'IN_CONSULTATION' ||
    status === 'in-consult'
  ) {
    return { text: labelForLifecycle('IN_PROGRESS'), cls: 'bg-blue-100 text-blue-700 border-blue-200' }
  }
  if (
    lifecycle === 'READY_FOR_DOCTOR' ||
    reception === 'READY_FOR_DOCTOR' ||
    desk === 'READY_FOR_DOCTOR'
  ) {
    return { text: labelForLifecycle('READY_FOR_DOCTOR'), cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' }
  }
  if (lifecycle === 'CHECKED_IN' || desk === 'CHECKED_IN') {
    return { text: labelForLifecycle('CHECKED_IN'), cls: 'bg-teal-100 text-teal-700 border-teal-200' }
  }
  if (lifecycle === 'CONFIRMED' || status === 'confirmed') {
    return { text: labelForLifecycle('CONFIRMED'), cls: 'bg-amber-100 text-amber-700 border-amber-200' }
  }
  if (lifecycle === 'IN_QUEUE' || desk === 'IN_QUEUE' || status === 'in-queue') {
    return { text: labelForLifecycle('IN_QUEUE'), cls: 'bg-slate-100 text-slate-600 border-slate-200' }
  }
  return {
    text: labelForLifecycle(lifecycle || status || desk || reception || 'BOOKED'),
    cls: 'bg-slate-100 text-slate-600 border-slate-200',
  }
}

const DoctorInQueue = ({ defaultTab }) => {
  const { dToken, backendUrl } = useContext(DoctorContext)
  const navigate = useNavigate()

  const [queue, setQueue]           = useState([])
  const [loading, setLoading]       = useState(true)
  const [currentId, setCurrentId]   = useState(null)
  const [activeTab, setActiveTab]   = useState(defaultTab || 'consultations')
  const [doctorStatus, setDoctorStatus] = useState('unavailable')
  const [sessionStarted, setSessionStarted] = useState(false)
  const [statusBusy, setStatusBusy] = useState(false)

  const fetchQueue = useCallback(async () => {
    if (!dToken) return
    try {
      const { data } = await axios.get(
        `${backendUrl}/api/doctor/in-queue?slotDate=${getTodayDate()}`,
        { headers: { dToken }, timeout: 10000 }
      )
      if (data.success) {
        // Only show patients who came from reception queue
        const queuePts = (data.queue?.appointments || []).filter(a =>
          a.receptionStatus === 'READY_FOR_DOCTOR' ||
          a.deskStatus === 'IN_QUEUE' ||
          a.status === 'in-consult' ||
          a.lifecycle_status === 'IN_QUEUE' ||
          a.lifecycle_status === 'IN_CONSULTATION'
        )
        setQueue(queuePts)
        setCurrentId(data.queue?.currentAppointmentId || null)
      }
    } catch (err) {
      console.error('Failed to load queue:', err)
    } finally {
      setLoading(false)
    }
  }, [dToken, backendUrl])

  // Get current doctor status on load to set initial state correctly
  const fetchDoctorProfile = useCallback(async () => {
    if (!dToken) return
    try {
      const { data } = await axios.get(`${backendUrl}/api/doctor/profile`, {
        headers: { dToken }
      })
      if (data.success && data.profileData) {
        const currentStatus = data.profileData.status || 'unavailable'
        setDoctorStatus(currentStatus)
        setSessionStarted(currentStatus === 'in-clinic' || currentStatus === 'in-consult')
      }
    } catch (err) {
      console.error('Failed to fetch doctor profile:', err)
    }
  }, [dToken, backendUrl])

  useEffect(() => {
    fetchDoctorProfile()
  }, [fetchDoctorProfile])

  useEffect(() => {
    if (activeTab === 'consultations') {
      fetchQueue()
      const interval = setInterval(fetchQueue, 45000)
      return () => clearInterval(interval)
    }
  }, [fetchQueue, activeTab])

  const { socket } = useSocket() || {}
  useEffect(() => {
    if (!socket || activeTab !== 'consultations') return undefined
    const onQueue = () => fetchQueue()
    socket.on('doctor_queue_updated', onQueue)
    socket.on('queue_updated', onQueue)
    return () => {
      socket.off('doctor_queue_updated', onQueue)
      socket.off('queue_updated', onQueue)
    }
  }, [socket, activeTab, fetchQueue])

  // Option A API call: sends 'in-clinic' (hyphen) and 'unavailable' (hyphen)
  const handleStatusChange = async (newStatus) => {
    setDoctorStatus(newStatus)
    const isActive = newStatus === 'in-clinic' || newStatus === 'in-consult'
    setSessionStarted(isActive)

    setStatusBusy(true)
    try {
      await axios.post(
        `${backendUrl}/api/doctor/update-status`,
        { status: newStatus },
        { headers: { dToken }, timeout: 5000 }
      )
    } catch (err) {
      console.error('Failed to update doctor status:', err)
    } finally {
      setStatusBusy(false)
    }
  }

  const startSession = () => handleStatusChange('in-clinic')
  const stopSession = () => handleStatusChange('unavailable')

  const inConsult = queue.filter(a => a.status === 'in-consult').length
  const waiting   = queue.length - inConsult

  return (
    <AdminPageLayout>
      <div className='flex flex-wrap items-center justify-between gap-3 mb-4'>
        <div>
          <h1 className='text-2xl font-bold text-mc-text'>Queue Management</h1>
          <p className='text-sm text-mc-text-muted mt-0.5'>Manage your patient consultations and queue</p>
        </div>
        {activeTab === 'consultations' && (
          <button
            onClick={fetchQueue}
            className='inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-mc-border text-sm font-semibold text-slate-700 hover:bg-slate-50'
          >
            <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
              <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15' />
            </svg>
            Refresh
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className='flex gap-3 mb-6 border-b border-mc-border pb-4'>
        <button
          onClick={() => setActiveTab('consultations')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all
            ${activeTab === 'consultations' ? 'bg-doctor text-white shadow-md' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
        >
          <span>🧑‍⚕️</span>
          <span>Active Consultations</span>
        </button>
        <button
          onClick={() => setActiveTab('operations')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all
            ${activeTab === 'operations' ? 'bg-doctor text-white shadow-md' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
        >
          <span>⚙️</span>
          <span>Queue Operations</span>
        </button>
      </div>

      {activeTab === 'consultations' ? (
        <>
          {/* ── Start Consulting Session Control Only (No extra buttons) ── */}
          <div className='bg-white rounded-2xl border border-mc-border shadow-sm p-5 mb-5 flex items-center justify-between gap-4 flex-wrap'>
            <div>
              <p className='text-xs font-bold uppercase tracking-wider text-slate-400'>Consulting Session</p>
              <p className='text-sm text-slate-500 mt-1'>
                {sessionStarted 
                  ? 'Session is active. Reception can check in patients to your queue.'
                  : 'Start your session to allow reception to check in patients.'
                }
              </p>
            </div>

            {/* Toggling session started state */}
            {!sessionStarted ? (
              <button
                onClick={startSession}
                disabled={statusBusy}
                className='flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-2xl font-black text-sm shadow-md hover:shadow-lg hover:from-emerald-600 hover:to-teal-600 transition-all disabled:opacity-60 shrink-0'
              >
                <svg className='w-4.5 h-4.5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                  <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2.5} d='M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z'/>
                  <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2.5} d='M21 12a9 9 0 11-18 0 9 9 0 0118 0z'/>
                </svg>
                {statusBusy ? 'Starting…' : 'Start Consulting'}
              </button>
            ) : (
              <div className='flex items-center gap-3'>
                <div className='flex items-center gap-2 px-4 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-sm font-bold'>
                  <span className='w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse' />
                  Session Active
                </div>
                <button
                  onClick={stopSession}
                  disabled={statusBusy}
                  className='px-5 py-2.5 bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-100 rounded-xl text-sm font-bold transition-all disabled:opacity-60'
                >
                  {statusBusy ? 'Stopping…' : 'Stop Consulting'}
                </button>
              </div>
            )}
          </div>

          {/* KPI strip */}
          <div className='mc-kpi-grid lg:grid-cols-3 mb-4'>
            <KpiCard
              label='In Queue Today'
              value={queue.length}
              iconBg='bg-blue-100 text-blue-600'
              trendLabel='From reception panel'
              icon={<svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' /></svg>}
            />
            <KpiCard
              label='Waiting'
              value={waiting}
              iconBg='bg-amber-100 text-amber-600'
              trendLabel='Ready for doctor'
              icon={<svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' /></svg>}
            />
            <KpiCard
              label='In Consultation'
              value={inConsult}
              iconBg='bg-emerald-100 text-emerald-600'
              trendLabel='Active now'
              icon={<svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' /></svg>}
            />
          </div>

          {/* Queue list */}
          <McCard noPadding>
            {loading ? (
              <div className='flex items-center justify-center py-20'>
                <div className='animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600' />
              </div>
            ) : queue.length === 0 ? (
              <div className='flex flex-col items-center justify-center py-20 px-6 text-center'>
                <div className='w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4'>
                  <svg className='w-8 h-8 text-slate-400' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                    <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={1.5} d='M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' />
                  </svg>
                </div>
                <p className='text-slate-600 font-medium'>No patients in queue</p>
                <p className='text-slate-400 text-sm mt-1 max-w-sm'>
                  When reception verifies patients and adds them to the queue, they will appear here automatically.
                </p>
              </div>
            ) : (
              <div className='divide-y divide-mc-border'>
                {queue.map((apt) => {
                  const st      = statusLabel(apt)
                  const isActive = currentId === apt._id || apt.status === 'in-consult'
                  const symptoms = (apt.symptoms || []).filter(s => !String(s).startsWith('Note:'))
                  return (
                    <button
                      key={apt._id}
                      type='button'
                      onClick={() => navigate(`/doctor-consultation/${apt._id}`)}
                      className={`w-full text-left p-4 sm:p-5 flex items-center gap-4 transition-colors hover:bg-slate-50/80 ${isActive ? 'bg-blue-50/60' : ''}`}
                    >
                      <div className={`flex-shrink-0 w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center text-white font-bold text-lg ${isActive ? 'bg-blue-600' : 'bg-slate-600'}`}>
                        #{apt.tokenNumber}
                      </div>

                      {apt.patientImage ? (
                        <img src={apt.patientImage} alt='' className='w-11 h-11 rounded-full object-cover ring-2 ring-white shrink-0 hidden sm:block' />
                      ) : null}

                      <div className='flex-1 min-w-0'>
                        <div className='flex items-center gap-2 flex-wrap'>
                          <p className='font-semibold text-slate-900 text-base'>{apt.patientName}</p>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${st.cls}`}>{st.text}</span>
                          {isActive && (
                            <span className='flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-700'>
                              <span className='w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse' />
                              In Consult
                            </span>
                          )}
                        </div>
                        <p className='text-sm text-slate-500 mt-0.5'>
                          {apt.slotTime || '—'}
                          {apt.patientPhone ? ` · ${apt.patientPhone}` : ''}
                        </p>
                        {symptoms.length > 0 && (
                          <div className='flex flex-wrap gap-1 mt-2'>
                            {symptoms.slice(0, 3).map((s, i) => (
                              <span key={i} className='px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs'>{s}</span>
                            ))}
                            {symptoms.length > 3 && <span className='text-xs text-slate-400'>+{symptoms.length - 3} more</span>}
                          </div>
                        )}
                      </div>

                      <div className='flex-shrink-0 flex items-center gap-2'>
                        {isActive ? (
                          <div className='px-4 py-2 rounded-xl bg-blue-100 text-blue-700 text-xs font-bold border border-blue-200'>Consulting</div>
                        ) : (
                          <div className='w-10 h-10 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center shadow-sm transition-colors'>
                            <svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                              <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M9 5l7 7-7 7' />
                            </svg>
                          </div>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </McCard>
        </>
      ) : (
        <QueueManager />
      )}
    </AdminPageLayout>
  )
}

export default DoctorInQueue
