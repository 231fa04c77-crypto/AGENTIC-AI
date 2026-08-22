import React, { useState, useContext, useEffect, useMemo } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { getPatientName, getPatientAge, getPatientImage } from '../../utils/appointmentDisplay'
import { isOnlineVideoAppointment } from '../../utils/videoConsult'
import { DoctorContext } from '../../context/DoctorContext'
import { AppContext } from '../../context/AppContext'
import AppointmentDetailModal from '../../components/AppointmentDetailModal'
import CompleteConsultationModal from '../../components/CompleteConsultationModal'
import { AdminPageLayout, KpiCard, McCard, ExportMenu } from '../../components/mc'

const PAGE_SIZE = 8

const isTodayAppointment = (a) => {
  const today = new Date()
  const d = today.getDate()
  const m = today.getMonth() + 1
  const y = today.getFullYear()
  const std = `${d.toString().padStart(2, '0')}_${m.toString().padStart(2, '0')}_${y}`
  const leg = `${d}_${m}_${y}`
  return a.slotDate === std || a.slotDate === leg
}

const getReason = (item) => {
  const raw = item.selectedSymptoms || []
  const symptoms = raw.filter((s) => !String(s).startsWith('Note:'))
  if (symptoms.length > 0) return symptoms.join(', ')
  const note = raw.find((s) => String(s).startsWith('Note:'))
  if (note) return String(note).replace(/^Note:\s*/, '')
  return 'General consultation'
}

const getWeekRangeLabel = () => {
  const now = new Date()
  const day = now.getDay()
  const monday = new Date(now)
  monday.setDate(now.getDate() - ((day + 6) % 7))
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  const opts = { month: 'short', day: 'numeric' }
  return `${monday.toLocaleDateString('en-US', opts)} – ${sunday.toLocaleDateString('en-US', opts)}, ${sunday.getFullYear()}`
}

const DoctorAppointments = () => {
  const { dToken, appointments, getAppointments, cancelAppointment, completeAppointment } = useContext(DoctorContext)
  const { slotDateFormat, calculateAge, currency } = useContext(AppContext)
  const navigate = useNavigate()

  const [selectedAppointment, setSelectedAppointment] = useState(null)
  const [completeTarget, setCompleteTarget] = useState(null)
  const [completing, setCompleting] = useState(false)
  const [searchParams, setSearchParams] = useSearchParams()
  const [viewMode, setViewMode] = useState('list')
  const [page, setPage] = useState(1)

  const validTabs = ['all', 'completed', 'cancelled', 'today']
  const [activeTab, setActiveTab] = useState(() => {
    const tabParam = searchParams.get('tab')
    return validTabs.includes(tabParam) ? tabParam : 'all'
  })

  const handleCompleteSubmit = async (consultationData) => {
    if (!completeTarget) return
    setCompleting(true)
    const ok = await completeAppointment(completeTarget._id, consultationData)
    setCompleting(false)
    if (ok) setCompleteTarget(null)
  }

  useEffect(() => {
    if (dToken) getAppointments()
  }, [dToken])

  useEffect(() => {
    if (activeTab === 'all') {
      setSearchParams({}, { replace: true })
    } else {
      setSearchParams({ tab: activeTab }, { replace: true })
    }
  }, [activeTab, setSearchParams])

  useEffect(() => {
    const tabParam = searchParams.get('tab')
    setActiveTab(validTabs.includes(tabParam) ? tabParam : 'all')
  }, [searchParams])

  useEffect(() => {
    setPage(1)
  }, [activeTab])

  const filteredAppointments = useMemo(() => {
    return appointments.filter((a) => {
      if (activeTab === 'today') return isTodayAppointment(a)
      if (activeTab === 'completed') return a.isCompleted
      if (activeTab === 'cancelled') return a.cancelled
      return true
    })
  }, [appointments, activeTab])

  const stats = useMemo(() => ({
    today: appointments.filter(isTodayAppointment).length,
    upcomingToday: appointments.filter((a) => isTodayAppointment(a) && !a.cancelled && !a.isCompleted).length,
    completed: appointments.filter((a) => a.isCompleted).length,
    cancelled: appointments.filter((a) => a.cancelled).length,
    total: appointments.length,
  }), [appointments])

  const totalPages = Math.max(1, Math.ceil(filteredAppointments.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pageItems = filteredAppointments.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)
  const rangeStart = filteredAppointments.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1
  const rangeEnd = Math.min(safePage * PAGE_SIZE, filteredAppointments.length)

  const tabs = [
    { id: 'all', label: 'All Appointments' },
    { id: 'completed', label: 'Completed' },
    { id: 'cancelled', label: 'Cancelled' },
  ]

  const appointmentExportColumns = [
    { key: (a) => getPatientName(a), label: 'Patient' },
    { key: (a) => getPatientAge(a, calculateAge), label: 'Age' },
    { key: (a) => slotDateFormat(a.slotDate), label: 'Date' },
    { key: (a) => a.slotTime, label: 'Time' },
    { key: (a) => (isOnlineVideoAppointment(a) ? 'Video Call' : 'In Clinic'), label: 'Type' },
    { key: (a) => getReason(a), label: 'Reason' },
    { key: (a) => a.amount, label: 'Fee', format: (v) => `${currency}${v ?? ''}` },
    { key: (a) => (a.payment ? 'Paid' : 'Pending'), label: 'Payment' },
    { key: (a) => (a.cancelled ? 'Cancelled' : a.isCompleted ? 'Completed' : 'Upcoming'), label: 'Status' },
    { key: (a) => a.bookingId, label: 'Booking ID' },
  ]

  const StatusPill = ({ item }) => {
    if (item.cancelled) return <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-600"><span className="w-1.5 h-1.5 rounded-full bg-rose-500" />Cancelled</span>
    if (item.isCompleted) return <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Completed</span>
    return <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600"><span className="w-1.5 h-1.5 rounded-full bg-blue-500" />Upcoming</span>
  }

  const TypePill = ({ item }) => {
    const video = isOnlineVideoAppointment(item)
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${video ? 'bg-sky-50 text-sky-700' : 'bg-emerald-50 text-emerald-700'}`}>
        {video ? (
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
        ) : (
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0H5m14 0h2M5 21H3m4-14h2m-2 4h2m6-4h2m-2 4h2m-6 4h6" /></svg>
        )}
        {video ? 'Video Call' : 'In Clinic'}
      </span>
    )
  }

  return (
    <AdminPageLayout>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-mc-text">Appointments</h1>
          <p className="text-sm text-mc-text-muted mt-0.5">Manage and view all your patient appointments</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportMenu
            columns={appointmentExportColumns}
            rows={() => filteredAppointments}
            filename='my_appointments'
            title='Doctor Appointments'
            subtitle={`${filteredAppointments.length} record(s)`}
          />
          <button
            onClick={() => setViewMode(viewMode === 'list' ? 'calendar' : 'list')}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={viewMode === 'list' ? 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' : 'M4 6h16M4 10h16M4 14h16M4 18h16'} />
            </svg>
            {viewMode === 'list' ? 'Calendar View' : 'List View'}
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="mc-kpi-grid lg:grid-cols-4">
        <KpiCard
          label="Today's Appointments"
          value={stats.today}
          iconBg="bg-blue-100 text-blue-600"
          trendLabel={`${stats.upcomingToday} upcoming`}
          icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
          onClick={() => setActiveTab('today')}
        />
        <KpiCard
          label="Completed"
          value={stats.completed}
          iconBg="bg-emerald-100 text-emerald-600"
          trendLabel="All time"
          icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
          onClick={() => setActiveTab('completed')}
        />
        <KpiCard
          label="Cancelled"
          value={stats.cancelled}
          iconBg="bg-violet-100 text-violet-600"
          trendLabel="All time"
          icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
          onClick={() => setActiveTab('cancelled')}
        />
        <KpiCard
          label="Total Appointments"
          value={stats.total}
          iconBg="bg-amber-100 text-amber-600"
          trendLabel="All time"
          icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>}
          onClick={() => setActiveTab('all')}
        />
      </div>

      {viewMode === 'calendar' ? (
        <McCard title="Weekly Schedule">
          <div className="overflow-x-auto">
            <div className="min-w-[800px]">
              <div className="grid grid-cols-7 gap-2 mb-2">
                {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => (
                  <div key={day} className="text-center text-xs sm:text-sm font-semibold text-slate-700 py-2 bg-slate-50 rounded-lg">{day.slice(0, 3)}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-2">
                {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => {
                  const dayAppointments = filteredAppointments.filter((apt) => {
                    const aptDate = new Date(apt.slotDate)
                    const dayIndex = aptDate.getDay()
                    const dayMap = { 1: 'Monday', 2: 'Tuesday', 3: 'Wednesday', 4: 'Thursday', 5: 'Friday', 6: 'Saturday', 0: 'Sunday' }
                    return dayMap[dayIndex] === day
                  })
                  return (
                    <div key={day} className="min-h-[360px] bg-slate-50 rounded-lg p-2 border border-slate-200">
                      {dayAppointments.length === 0 ? (
                        <p className="text-xs text-slate-400 text-center mt-2">No appointments</p>
                      ) : (
                        <div className="space-y-2">
                          {dayAppointments.map((apt, idx) => (
                            <div
                              key={idx}
                              onClick={() => setSelectedAppointment(apt)}
                              className="text-white p-2 rounded-lg cursor-pointer hover:shadow-lg transition-all text-xs"
                              style={{ backgroundColor: apt.cancelled ? '#ef4444' : apt.isCompleted ? '#10b981' : '#3b82f6' }}
                            >
                              <div className="font-semibold mb-1 truncate">{getPatientName(apt)}</div>
                              <div className="text-[10px] opacity-90">{apt.slotTime}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </McCard>
      ) : (
        <McCard noPadding>
          {/* Tabs + filter row */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-5 pt-4 border-b border-mc-border">
            <div className="flex items-center gap-1 flex-wrap">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative px-3 sm:px-4 py-2.5 text-sm font-semibold transition-colors ${
                    activeTab === tab.id ? 'text-blue-600' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {tab.label}
                  {activeTab === tab.id && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 pb-3">
              <span className="hidden sm:inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-mc-border text-xs font-medium text-slate-600 bg-white">
                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                {getWeekRangeLabel()}
              </span>
            </div>
          </div>

          {/* Table header */}
          {filteredAppointments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-6">
              <svg className="w-16 h-16 text-slate-200 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              <p className="text-slate-500 text-base font-medium">No appointments found</p>
              <p className="text-slate-400 text-sm mt-1">Your appointments will appear here</p>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full min-w-[860px] text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wider text-slate-400 border-b border-mc-border">
                      <th className="font-semibold px-5 py-3">Patient</th>
                      <th className="font-semibold px-3 py-3">Date &amp; Time</th>
                      <th className="font-semibold px-3 py-3">Type</th>
                      <th className="font-semibold px-3 py-3">Reason</th>
                      <th className="font-semibold px-3 py-3">Status</th>
                      <th className="font-semibold px-3 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-mc-border">
                    {pageItems.map((item) => {
                      const patientId = item.userData?.publicId || item.bookingId
                      const video = isOnlineVideoAppointment(item)
                      const actionable = !item.cancelled && !item.isCompleted
                      return (
                        <tr key={item._id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <img src={getPatientImage(item)} alt="" className="w-9 h-9 rounded-full object-cover ring-2 ring-slate-100 shrink-0" />
                              <div className="min-w-0">
                                <p className="font-semibold text-slate-800 truncate">{getPatientName(item)}</p>
                                {patientId && <p className="text-xs text-slate-400 truncate">{patientId}</p>}
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <p className="font-medium text-slate-700">{slotDateFormat(item.slotDate)}</p>
                            <p className="text-xs text-slate-400">{item.slotTime}</p>
                          </td>
                          <td className="px-3 py-3"><TypePill item={item} /></td>
                          <td className="px-3 py-3 text-slate-600 max-w-[220px] truncate" title={getReason(item)}>{getReason(item)}</td>
                          <td className="px-3 py-3"><StatusPill item={item} /></td>
                          <td className="px-3 py-3">
                            <div className="flex items-center justify-end gap-1.5">
                              {video && actionable && (
                                <button
                                  onClick={() => navigate(`/doctor-video/${item._id}`)}
                                  title="Join video call"
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition-colors"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                                  Join
                                </button>
                              )}
                              <button
                                onClick={() => setSelectedAppointment(item)}
                                title="View details"
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-mc-border text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors"
                              >
                                View
                              </button>
                              {actionable && (
                                <button
                                  onClick={() => setCompleteTarget(item)}
                                  title="Mark as complete"
                                  className="w-8 h-8 rounded-lg border border-emerald-200 text-emerald-600 hover:bg-emerald-50 flex items-center justify-center transition-colors"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                </button>
                              )}
                              {actionable && (
                                <button
                                  onClick={() => cancelAppointment(item._id)}
                                  title="Cancel appointment"
                                  className="w-8 h-8 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 flex items-center justify-center transition-colors"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden divide-y divide-mc-border">
                {pageItems.map((item) => {
                  const actionable = !item.cancelled && !item.isCompleted
                  const video = isOnlineVideoAppointment(item)
                  return (
                    <div key={item._id} className="p-4">
                      <div className="flex items-start gap-3">
                        <img src={getPatientImage(item)} alt="" className="w-11 h-11 rounded-full object-cover ring-2 ring-slate-100" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-semibold text-slate-800 truncate">{getPatientName(item)}</p>
                            <StatusPill item={item} />
                          </div>
                          <p className="text-xs text-slate-400">{slotDateFormat(item.slotDate)} · {item.slotTime}</p>
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            <TypePill item={item} />
                            <span className="text-xs text-slate-500 truncate">{getReason(item)}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-3">
                            <button onClick={() => setSelectedAppointment(item)} className="px-3 py-1.5 rounded-lg border border-mc-border text-slate-700 text-xs font-semibold">View</button>
                            {video && actionable && (
                              <button onClick={() => navigate(`/doctor-video/${item._id}`)} className="px-3 py-1.5 rounded-lg bg-sky-600 text-white text-xs font-semibold">Join</button>
                            )}
                            {actionable && (
                              <>
                                <button onClick={() => setCompleteTarget(item)} className="px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-semibold">Complete</button>
                                <button onClick={() => cancelAppointment(item._id)} className="px-3 py-1.5 rounded-lg bg-rose-50 text-rose-700 text-xs font-semibold">Cancel</button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Footer / pagination */}
              <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-t border-mc-border">
                <p className="text-xs text-slate-500">
                  Showing {rangeStart} to {rangeEnd} of {filteredAppointments.length} appointments
                </p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={safePage <= 1}
                    className="w-8 h-8 rounded-lg border border-mc-border text-slate-500 hover:bg-slate-50 disabled:opacity-40 flex items-center justify-center"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={`w-8 h-8 rounded-lg text-sm font-semibold flex items-center justify-center ${
                        p === safePage ? 'bg-blue-600 text-white' : 'border border-mc-border text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={safePage >= totalPages}
                    className="w-8 h-8 rounded-lg border border-mc-border text-slate-500 hover:bg-slate-50 disabled:opacity-40 flex items-center justify-center"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  </button>
                </div>
              </div>
            </>
          )}
        </McCard>
      )}

      {completeTarget && (
        <CompleteConsultationModal
          appointment={completeTarget}
          onClose={() => setCompleteTarget(null)}
          onSubmit={handleCompleteSubmit}
          submitting={completing}
        />
      )}

      {selectedAppointment && (
        <AppointmentDetailModal
          appointment={selectedAppointment}
          onClose={() => setSelectedAppointment(null)}
        />
      )}
    </AdminPageLayout>
  )
}

export default DoctorAppointments
