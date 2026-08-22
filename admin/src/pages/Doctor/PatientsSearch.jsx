import React, { useContext, useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { toast } from 'react-toastify'
import { DoctorContext } from '../../context/DoctorContext'
import { AppContext } from '../../context/AppContext'
import { AdminPageLayout, KpiCard, McCard } from '../../components/mc'
import DoctorPatientHistoryModal from '../../components/DoctorPatientHistoryModal'
import SuggestInvestigationModal from '../../components/SuggestInvestigationModal'

// ─── Shared UI components ─────────────────────────────────────────────────────
const Avatar = ({ name, image }) => {
  const initials = (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  return image
    ? <img src={image} alt={name} className='w-9 h-9 rounded-full object-cover border border-slate-100 shadow-sm shrink-0' />
    : <div className='w-9 h-9 rounded-full bg-purple-50 border border-purple-100 text-purple-600 flex items-center justify-center text-xs font-black shrink-0'>{initials}</div>
}

const inputCls = 'w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-doctor outline-none text-sm transition-colors'

const StatusPill = ({ cancelled, isCompleted, lifecycleStatus }) => {
  if (cancelled) return <span className='inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-600'><span className='w-1 h-1 rounded-full bg-rose-500' />Cancelled</span>
  if (isCompleted) return <span className='inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-600'><span className='w-1 h-1 rounded-full bg-emerald-500' />Completed</span>
  if ((lifecycleStatus || '').toUpperCase() === 'CONFIRMED') return <span className='inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-teal-50 text-teal-700'><span className='w-1 h-1 rounded-full bg-teal-500' />Confirmed</span>
  return <span className='inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-600'><span className='w-1 h-1 rounded-full bg-blue-500' />Upcoming</span>
}

const TypePill = ({ mode }) => {
  const isVideo = String(mode || '').toLowerCase().includes('video') || String(mode || '').toLowerCase().includes('online')
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${isVideo ? 'bg-sky-50 text-sky-700 border border-sky-100' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'}`}>
      {isVideo ? 'Video' : 'In-Clinic'}
    </span>
  )
}

const PatientsSearch = () => {
  const { dToken, backendUrl, appointments, getAppointments, acceptAppointment, cancelAppointment } = useContext(DoctorContext)
  const { slotDateFormat } = useContext(AppContext)
  const navigate = useNavigate()

  const [query, setQuery]           = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [isSearching, setIsSearching]     = useState(false)

  // History modal target
  const [historyTarget, setHistoryTarget] = useState(null) // { appointmentId?: string, userId?: string, name: string }
  const [investigateFor, setInvestigateFor] = useState(null)

  // Reject modal
  const [rejectTarget, setRejectTarget] = useState(null)  // appointment object
  const [rejectReason, setRejectReason] = useState('')
  const [actionLoading, setActionLoading] = useState(null) // appointmentId being actioned

  const handleAccept = async (apt) => {
    setActionLoading(apt._id)
    await acceptAppointment(apt._id)
    setActionLoading(null)
  }

  const openReject = (apt) => {
    setRejectTarget(apt)
    setRejectReason('')
  }

  const handleRejectConfirm = async () => {
    if (!rejectTarget) return
    setActionLoading(rejectTarget._id)
    try {
      const { default: axios } = await import('axios')
      const { data } = await axios.post(
        `${backendUrl}/api/doctor/reject-appointment`,
        { appointmentId: rejectTarget._id, reason: rejectReason || 'Doctor unavailable' },
        { headers: { dtoken: dToken } }
      )
      if (data.success) {
        const { toast } = await import('react-toastify')
        toast.success('Appointment rejected')
        getAppointments()
      } else {
        const { toast } = await import('react-toastify')
        toast.error(data.message || 'Failed to reject')
      }
    } catch (e) {
      const { toast } = await import('react-toastify')
      toast.error(e.message)
    } finally {
      setActionLoading(null)
      setRejectTarget(null)
      setRejectReason('')
    }
  }

  // Load doctor's scheduled appointments on mount
  useEffect(() => {
    if (dToken) getAppointments()
  }, [dToken])

  const doSearch = useCallback(async () => {
    const q = query.trim()
    if (!q) {
      setIsSearching(false)
      setSearchResults([])
      return
    }
    if (q.length < 2) return toast.error('Enter at least 2 characters to search')
    
    setSearchLoading(true)
    setIsSearching(true)
    try {
      const { data } = await axios.get(`${backendUrl}/api/doctor/patients/search`, {
        headers: { dtoken: dToken },
        params: { q },
      })
      if (data.success) {
        setSearchResults(data.patients || [])
      } else {
        toast.error(data.message || 'Search failed')
      }
    } catch {
      toast.error('Search failed. Please try again.')
      setSearchResults([])
    } finally {
      setSearchLoading(false)
    }
  }, [query, dToken, backendUrl])

  const handleClearSearch = () => {
    setQuery('')
    setIsSearching(false)
    setSearchResults([])
  }

  // Group booked appointments by unique patient to show clean list of your patient bookings
  const patientBookings = useMemo(() => {
    const map = {}
    appointments.forEach(apt => {
      const pName = apt.userData?.name || apt.actualPatient?.name || 'Patient'
      const key = apt.user_id || pName
      if (!map[key] || new Date(apt.slotDate) > new Date(map[key].slotDate)) {
        map[key] = apt
      }
    })
    return Object.values(map).sort((a, b) => new Date(b.slotDate) - new Date(a.slotDate))
  }, [appointments])

  return (
    <AdminPageLayout>
      {/* Header */}
      <div className='flex flex-wrap items-center justify-between gap-3 mb-4'>
        <div>
          <h1 className='text-2xl font-bold text-mc-text'>Patient Records & Directory</h1>
          <p className='text-sm text-mc-text-muted mt-0.5'>Search any patient records globally or view your scheduled bookings</p>
        </div>
      </div>

      {/* Stats Summary cards */}
      <div className='mc-kpi-grid lg:grid-cols-3 mb-4'>
        <KpiCard
          label='Your Patients'
          value={patientBookings.length}
          iconBg='bg-purple-100 text-purple-600'
          trendLabel='Unique patient bookings'
          icon={<svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' /></svg>}
        />
        <KpiCard
          label='Total Appointments'
          value={appointments.length}
          iconBg='bg-blue-100 text-blue-600'
          trendLabel='All schedule bookings'
          icon={<svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' /></svg>}
        />
        <KpiCard
          label='Completed Consultations'
          value={appointments.filter(a => a.isCompleted).length}
          iconBg='bg-emerald-100 text-emerald-600'
          trendLabel='Fully consulted'
          icon={<svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' /></svg>}
        />
      </div>

      {/* Global Search box */}
      <div className='bg-white rounded-2xl border border-slate-200 shadow-sm p-4 mb-5 flex gap-3 items-center flex-wrap'>
        <div className='relative flex-1 min-w-[240px]'>
          <svg className='w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z' /></svg>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && doSearch()}
            placeholder='Search any registered patient globally (Name, Phone or Email)'
            className='w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-doctor outline-none text-sm'
          />
        </div>
        <div className='flex gap-2 shrink-0'>
          <button onClick={doSearch} disabled={searchLoading} className='px-5 py-2.5 bg-doctor text-white rounded-xl text-sm font-bold shadow-sm hover:opacity-95 transition-opacity disabled:opacity-60'>
            {searchLoading ? 'Searching…' : 'Search Directory'}
          </button>
          {isSearching && (
            <button onClick={handleClearSearch} className='px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-200 transition-colors'>
              Clear Search
            </button>
          )}
        </div>
      </div>

      {/* Main List */}
      <McCard noPadding>
        {isSearching ? (
          <div>
            <div className='px-5 py-3.5 bg-purple-50/60 border-b border-slate-100 flex items-center justify-between'>
              <p className='text-xs font-bold uppercase tracking-wider text-purple-700'>Global Search Results ({searchResults.length})</p>
              <button onClick={handleClearSearch} className='text-xs font-bold text-purple-600 hover:underline'>✕ Clear and show my bookings</button>
            </div>

            {searchLoading ? (
              <div className='flex items-center justify-center py-20'>
                <div className='animate-spin rounded-full h-10 w-10 border-b-2 border-doctor' />
              </div>
            ) : searchResults.length === 0 ? (
              <div className='text-center py-16 text-slate-500 space-y-2'>
                <div className='text-4xl'>🔍</div>
                <p className='font-bold'>No global records found</p>
                <p className='text-xs text-slate-400'>Make sure patient spelling or phone number is correct.</p>
              </div>
            ) : (
              <div className='overflow-x-auto'>
                <table className='w-full text-sm border-collapse'>
                  <thead>
                    <tr className='text-left text-[11px] uppercase tracking-wider text-slate-400 border-b border-mc-border bg-slate-50/40'>
                      <th className='px-5 py-3 font-semibold w-12'>#</th>
                      <th className='px-5 py-3 font-semibold'>Patient</th>
                      <th className='px-5 py-3 font-semibold'>Contact Information</th>
                      <th className='px-5 py-3 font-semibold text-center'>Medical File</th>
                    </tr>
                  </thead>
                  <tbody className='divide-y divide-mc-border'>
                    {searchResults.map((p, idx) => (
                      <tr key={p._id || p.id} className='hover:bg-slate-50/60 transition-colors'>
                        <td className='px-5 py-4 text-xs font-bold text-slate-400'>{idx + 1}</td>
                        <td className='px-5 py-4'>
                          <div className='flex items-center gap-3'>
                            <Avatar name={p.name} image={p.image} />
                            <div>
                              <p className='font-semibold text-slate-800'>{p.name}</p>
                              <p className='text-xs text-slate-400'>{p.gender || '—'} · {p.age || '—'} yrs</p>
                            </div>
                          </div>
                        </td>
                        <td className='px-5 py-4'>
                          <p className='font-medium text-slate-700'>{p.phone || '—'}</p>
                          <p className='text-xs text-slate-400'>{p.email || '—'}</p>
                        </td>
                        <td className='px-5 py-4 text-center'>
                          <button
                            onClick={() => setHistoryTarget({ userId: p._id || p.id, name: p.name })}
                            className='inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-doctor/10 text-doctor hover:bg-doctor hover:text-white text-xs font-bold transition-all shadow-sm'
                          >
                            📁 View Records &amp; History
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          <div>
            <div className='px-5 py-3.5 bg-slate-50 border-b border-slate-100'>
              <p className='text-xs font-bold uppercase tracking-wider text-slate-500'>My Booked Patients ({patientBookings.length})</p>
            </div>

            {patientBookings.length === 0 ? (
              <div className='text-center py-20 text-slate-500 space-y-2'>
                <div className='text-4xl'>📅</div>
                <p className='font-bold'>No scheduled appointments yet</p>
                <p className='text-xs text-slate-400'>When patients book or check in to your slots, they will appear here.</p>
              </div>
            ) : (
              <div className='overflow-x-auto'>
                <table className='w-full text-sm border-collapse'>
                  <thead>
                    <tr className='text-left text-[11px] uppercase tracking-wider text-slate-400 border-b border-mc-border bg-slate-50/40'>
                      <th className='px-5 py-3 font-semibold w-12'>#</th>
                      <th className='px-5 py-3 font-semibold'>Patient</th>
                      <th className='px-5 py-3 font-semibold'>Last Visit / Booking Date</th>
                      <th className='px-5 py-3 font-semibold'>Consultation Type</th>
                      <th className='px-5 py-3 font-semibold'>Status</th>
                      <th className='px-5 py-3 font-semibold text-center'>Action</th>
                    </tr>
                  </thead>
                  <tbody className='divide-y divide-mc-border'>
                    {patientBookings.map((a, idx) => {
                      const pn = a.userData?.name || a.actualPatient?.name || 'Patient'
                      return (
                        <tr key={a._id} className='hover:bg-slate-50/60 transition-colors'>
                          <td className='px-5 py-4 text-xs font-bold text-slate-400'>{idx + 1}</td>
                          <td className='px-5 py-4'>
                            <div className='flex items-center gap-3'>
                              <Avatar name={pn} src={a.userData?.image} />
                              <div>
                                <p className='font-semibold text-slate-800'>{pn}</p>
                                <p className='text-xs text-slate-400'>{a.userData?.gender || a.actualPatient?.gender || '—'} · {a.userData?.age || a.actualPatient?.age || '—'} yrs</p>
                              </div>
                            </div>
                          </td>
                          <td className='px-5 py-4'>
                            <p className='font-semibold text-slate-700'>{slotDateFormat(a.slotDate)}</p>
                            <p className='text-xs text-slate-400'>{a.slotTime || '—'}</p>
                          </td>
                          <td className='px-5 py-4'><TypePill mode={a.mode} /></td>
                          <td className='px-5 py-4'><StatusPill cancelled={a.cancelled} isCompleted={a.isCompleted} lifecycleStatus={a.lifecycleStatus} /></td>
                          <td className='px-5 py-4 text-center'>
                            <div className='flex items-center justify-center gap-2 flex-wrap'>
                              {!a.cancelled && !a.isCompleted && (a.lifecycleStatus || '').toUpperCase() !== 'CONFIRMED' ? (
                                <>
                                  <button
                                    id={`accept-apt-${a._id}`}
                                    onClick={() => handleAccept(a)}
                                    disabled={actionLoading === a._id}
                                    title='Accept appointment'
                                    className='inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold transition-all shadow-sm disabled:opacity-60'
                                  >
                                    {actionLoading === a._id ? '…' : '✓ Accept'}
                                  </button>
                                  <button
                                    id={`reject-apt-${a._id}`}
                                    onClick={() => openReject(a)}
                                    disabled={actionLoading === a._id}
                                    title='Reject appointment'
                                    className='inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold transition-all shadow-sm disabled:opacity-60'
                                  >
                                    ✕ Reject
                                  </button>
                                </>
                              ) : (
                                <>
                                  {(a.lifecycleStatus || '').toUpperCase() === 'CONFIRMED' && !a.isCompleted && (
                                    <button
                                      onClick={() => setInvestigateFor(a)}
                                      className='inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold shadow-sm'
                                    >
                                      Suggest Investigation
                                    </button>
                                  )}
                                  <button
                                    onClick={() => setHistoryTarget({ appointmentId: a._id, userId: a.userId, name: pn })}
                                    className='inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-doctor/10 text-doctor hover:bg-doctor hover:text-white text-xs font-bold transition-all shadow-sm'
                                  >
                                    📁 View History
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </McCard>

      {/* History modal */}
      {historyTarget && (
        <DoctorPatientHistoryModal
          isOpen={true}
          appointmentId={historyTarget.appointmentId}
          userId={historyTarget.userId}
          patientName={historyTarget.name}
          onClose={() => setHistoryTarget(null)}
        />
      )}
      {investigateFor && (
        <SuggestInvestigationModal
          patientId={investigateFor.userId}
          patientName={investigateFor.userData?.name || investigateFor.actualPatient?.name}
          onClose={() => setInvestigateFor(null)}
          onCreated={() => getAppointments()}
        />
      )}

      {/* Reject reason modal */}
      {rejectTarget && (
        <div className='fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4'>
          <div className='bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4'>
            <div className='flex items-center justify-between'>
              <h3 className='text-base font-bold text-slate-800'>Reject Appointment</h3>
              <button onClick={() => setRejectTarget(null)} className='text-slate-400 hover:text-slate-600 p-1'>
                <svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M6 18L18 6M6 6l12 12' /></svg>
              </button>
            </div>
            <p className='text-sm text-slate-500'>
              Rejecting appointment for <span className='font-semibold text-slate-700'>{rejectTarget?.userData?.name || rejectTarget?.actualPatient?.name || 'Patient'}</span>.
              The patient will be notified by email.
            </p>
            <div>
              <label className='block text-xs font-semibold text-slate-600 mb-1.5'>Reason for rejection <span className='font-normal text-slate-400'>(optional)</span></label>
              <textarea
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                placeholder='e.g. Doctor unavailable, schedule conflict…'
                rows={3}
                className='w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-rose-400 outline-none text-sm resize-none transition-colors'
              />
            </div>
            <div className='flex gap-2 pt-1'>
              <button
                onClick={() => setRejectTarget(null)}
                className='flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition-colors'
              >
                Cancel
              </button>
              <button
                id='confirm-reject-btn'
                onClick={handleRejectConfirm}
                disabled={actionLoading === rejectTarget._id}
                className='flex-1 px-4 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-sm font-bold shadow-sm transition-colors disabled:opacity-60'
              >
                {actionLoading === rejectTarget._id ? 'Rejecting…' : 'Confirm Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminPageLayout>
  )
}

export default PatientsSearch
