import React, { useContext, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { DoctorContext } from '../../context/DoctorContext'
import { AppContext } from '../../context/AppContext'
import { canJoinVideoCall, isOnlineVideoAppointment } from '../../utils/videoConsult'
import { getPatientName, getPatientAge, getPatientImage } from '../../utils/appointmentDisplay'
import { AdminPageLayout, McCard } from '../../components/mc'
import PrescriptionModal from '../../components/PrescriptionModal'

const TABS = [
  { id: 'ready', label: 'Ready to Join' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'completed', label: 'Completed' },
]

const DoctorVideoCalls = () => {
  const { dToken, appointments, getAppointments } = useContext(DoctorContext)
  const { slotDateFormat, calculateAge, currency } = useContext(AppContext)
  const navigate = useNavigate()

  const [activeTab, setActiveTab] = useState('ready')
  const [prescriptionTarget, setPrescriptionTarget] = useState(null)

  useEffect(() => {
    if (dToken) getAppointments()
  }, [dToken])

  const videoAppointments = useMemo(
    () => appointments.filter((a) => isOnlineVideoAppointment(a)),
    [appointments]
  )

  const groups = useMemo(() => {
    const ready = videoAppointments.filter((a) => canJoinVideoCall(a))
    const completed = videoAppointments.filter((a) => a.isCompleted)
    const upcoming = videoAppointments.filter(
      (a) => !a.isCompleted && !a.cancelled && !canJoinVideoCall(a)
    )
    return { ready, upcoming, completed }
  }, [videoAppointments])

  const list = groups[activeTab] || []

  const emptyText = {
    ready: 'No video consultations are ready to join right now.',
    upcoming: 'No upcoming video consultations scheduled.',
    completed: 'No completed video consultations yet.',
  }[activeTab]

  return (
    <AdminPageLayout>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-mc-text">Video Consultations</h1>
          <p className="text-sm text-mc-text-muted mt-0.5">Connect with patients over a secure room and manage their prescriptions</p>
        </div>
        <span className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-blue-50 text-blue-700 text-sm font-semibold">
          <span className="relative flex h-2 w-2">
            {groups.ready.length > 0 && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />}
            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-600" />
          </span>
          {groups.ready.length} ready to join
        </span>
      </div>

      <McCard noPadding>
        {/* Tabs */}
        <div className="flex items-center gap-1 px-4 sm:px-5 pt-4 border-b border-mc-border flex-wrap">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative px-3 sm:px-4 py-2.5 text-sm font-semibold transition-colors ${
                activeTab === tab.id ? 'text-blue-600' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.label}
              <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-md ${activeTab === tab.id ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-400'}`}>
                {groups[tab.id]?.length || 0}
              </span>
              {activeTab === tab.id && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />}
            </button>
          ))}
        </div>

        {list.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-slate-600 text-base font-semibold">{emptyText}</p>
            <p className="text-slate-400 text-sm mt-1 max-w-sm">Cancelled visits are not listed here.</p>
          </div>
        ) : (
          <div className="divide-y divide-mc-border">
            {list.map((item) => {
              const completed = item.isCompleted
              return (
                <div key={item._id} className="flex flex-col sm:flex-row sm:items-center gap-4 px-5 py-4 hover:bg-slate-50/60 transition-colors">
                  <img src={getPatientImage(item)} alt="" className="w-12 h-12 rounded-full object-cover ring-2 ring-slate-100 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-slate-800 truncate">{getPatientName(item)}</p>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-[11px] font-semibold">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                        Video
                      </span>
                      {completed && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[11px] font-semibold">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Completed
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-xs text-slate-500 flex-wrap">
                      <span className="inline-flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        {slotDateFormat(item.slotDate)} · {item.slotTime}
                      </span>
                      <span>Age {getPatientAge(item, calculateAge) || '—'}</span>
                      <span className={`font-semibold ${item.payment ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {item.payment ? 'Paid' : 'Pay at visit'} · {currency}{item.amount}
                      </span>
                    </div>
                  </div>

                  {completed ? (
                    <button
                      type="button"
                      onClick={() => setPrescriptionTarget(item)}
                      className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-white border border-blue-200 text-blue-700 hover:bg-blue-50 text-sm font-semibold rounded-lg shrink-0 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                      Prescription
                    </button>
                  ) : activeTab === 'ready' ? (
                    <button
                      type="button"
                      onClick={() => navigate(`/doctor-video/${item._id}`)}
                      className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg shadow-sm shrink-0 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                      Join Call
                    </button>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-slate-50 text-slate-400 text-sm font-semibold shrink-0">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      Scheduled
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </McCard>

      {prescriptionTarget && (
        <PrescriptionModal
          appointment={prescriptionTarget}
          onClose={() => setPrescriptionTarget(null)}
          onSaved={() => getAppointments()}
        />
      )}
    </AdminPageLayout>
  )
}

export default DoctorVideoCalls
