import React, { useContext, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { toast } from 'react-toastify'
import { DoctorContext } from '../../context/DoctorContext'
import { AppContext } from '../../context/AppContext'
import AnimatedCounter from '../../components/ui/AnimatedCounter'
import { getPatientName, getPatientAge, getPatientImage } from '../../utils/appointmentDisplay'
import { isOnlineVideoAppointment } from '../../utils/videoConsult'
import SuggestInvestigationModal from '../../components/SuggestInvestigationModal'
import HumanReviewModal from '../../components/HumanReviewModal'
import { submitFindingReview } from '../../utils/findingReview'
import { DeskPage, DeskHeader, DeskKpi, DeskBtn } from '../../components/desk/DeskChrome'
import { McCard } from '../../components/mc'

const WEEK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const STATUS_OPTIONS = [
  { value: 'available', label: 'Available', dot: 'bg-emerald-500', activeCls: 'bg-emerald-50 border-emerald-300 text-emerald-700 ring-emerald-400' },
  { value: 'in-clinic', label: 'In-clinic', dot: 'bg-sky-500', activeCls: 'bg-sky-50 border-sky-300 text-sky-700 ring-sky-400' },
  { value: 'emergency', label: 'Emergency', dot: 'bg-rose-500', activeCls: 'bg-rose-50 border-rose-300 text-rose-700 ring-rose-400' },
  { value: 'offline', label: 'Offline', dot: 'bg-slate-400', activeCls: 'bg-slate-100 border-slate-300 text-slate-700 ring-slate-400' },
]

const DoctorDashboard = () => {
  const { dToken, backendUrl, dashData, getDashData, profileData, getProfileData } = useContext(DoctorContext)
  const { slotDateFormat, calculateAge, currency } = useContext(AppContext)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [investigateFor, setInvestigateFor] = useState(null)
  const [reviewTarget, setReviewTarget] = useState(null)
  const [reviewNotes, setReviewNotes] = useState('')
  const [reviewBusy, setReviewBusy] = useState(false)

  // AI findings and reports review state
  const [openFindings, setOpenFindings] = useState([])
  const [pendingReports, setPendingReports] = useState([])
  const [specialistReferrals, setSpecialistReferrals] = useState([])
  const [doctorNotifications, setDoctorNotifications] = useState([])
  const [referralBusyId, setReferralBusyId] = useState(null)
  const [loadingOrders, setLoadingOrders] = useState(true)
  const [reviewFinding, setReviewFinding] = useState(null)
  const [findingReviewBusy, setFindingReviewBusy] = useState(false)

  const loadOrdersData = async () => {
    if (!profileData?.id) return
    try {
      const resFindings = await axios.get(backendUrl + '/api/findings?doctor_id=' + profileData.id, {
        headers: { dtoken: dToken }
      })
      if (resFindings.data.success) {
        setOpenFindings(resFindings.data.findings)
      }
      const resReports = await axios.get(backendUrl + '/api/lab/queue?status=REPORT_AVAILABLE', {
        headers: { dtoken: dToken }
      })
      if (resReports.data.success) {
        const filtered = resReports.data.queue.filter(
          (x) => Number(x.ordered_by) === Number(profileData.id)
            && String(x.status || '').toUpperCase() === 'REPORT_AVAILABLE'
            && String(x.report_review_status || 'PENDING').toUpperCase() === 'PENDING'
        )
        setPendingReports(filtered)
      }
      const [resRefs, resNotes] = await Promise.all([
        axios.get(`${backendUrl}/api/doctor/specialist-referrals`, { headers: { dtoken: dToken } }),
        axios.get(`${backendUrl}/api/doctor/notifications`, { headers: { dtoken: dToken } }),
      ])
      if (resRefs.data.success) {
        setSpecialistReferrals(resRefs.data.referrals || [])
      }
      if (resNotes.data.success) {
        setDoctorNotifications(resNotes.data.notifications || [])
      }
    } catch (e) {
      console.error('Error loading order/findings data:', e)
    } finally {
      setLoadingOrders(false)
    }
  }

  const handleMarkReviewed = async (id, nextStep = null) => {
    setReviewBusy(true)
    try {
      const body = { reportReviewStatus: 'REVIEWED', reviewNotes, status: 'REVIEWED' }
      if (nextStep) body.nextStep = nextStep
      const { data } = await axios.patch(
        backendUrl + `/api/investigations/${id}`,
        body,
        { headers: { dtoken: dToken } }
      )
      if (data.success) {
        toast.success('Report marked as reviewed')
        setReviewTarget(null)
        setReviewNotes('')
        await loadOrdersData()
      } else {
        toast.error(data.message || 'Failed to update')
      }
    } catch (e) {
      toast.error(e.response?.data?.detail || e.message)
    } finally {
      setReviewBusy(false)
    }
  }

  const reportLink = (id, download = false) => {
    const q = new URLSearchParams()
    if (dToken) q.set('dtoken', dToken)
    else q.set('token', dToken || '')
    if (download) q.set('download', '1')
    return `${backendUrl}/api/investigations/${id}/report?${q.toString()}`
  }

  const handleReferralAction = async (referralId, action) => {
    setReferralBusyId(referralId)
    try {
      const { data } = await axios.post(
        `${backendUrl}/api/doctor/referrals/${referralId}/${action}`,
        {},
        { headers: { dtoken: dToken } }
      )
      if (data.success) {
        toast.success(action === 'accept' ? 'Referral accepted' : 'Referral declined')
        await loadOrdersData()
      } else {
        toast.error(data.message || 'Action failed')
      }
    } catch (e) {
      toast.error(e.response?.data?.detail || e.response?.data?.message || e.message)
    } finally {
      setReferralBusyId(null)
    }
  }

  const handleFindingReview = async (findingId, decision, comment, modifications = {}) => {
    setFindingReviewBusy(true)
    try {
      const data = await submitFindingReview(
        backendUrl,
        { dtoken: dToken },
        findingId,
        decision,
        comment,
        modifications
      )
      if (data.success) {
        toast.success(data.resolved ? 'Finding reviewed and resolved' : 'Human review recorded — agents re-checked')
        setReviewFinding(null)
        await loadOrdersData()
      } else {
        toast.error(data.message || 'Review failed')
      }
    } catch (e) {
      toast.error(e.response?.data?.detail || e.message)
    } finally {
      setFindingReviewBusy(false)
    }
  }

  useEffect(() => {
    if (dToken && profileData?.id) {
      loadOrdersData()
    }
  }, [dToken, profileData])

  const [sched, setSched] = useState({
    opStart: '09:00',
    opEnd: '13:00',
    opStartAfternoon: '16:00',
    opEndAfternoon: '20:00',
    maxAppointmentsMorning: 20,
    maxAppointmentsAfternoon: 20,
    videoOpStart: '14:00',
    videoOpEnd: '15:00',
    maxVideoSlots: 4,
    videoSlotMinutes: 15,
    days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
  })
  const [savingStatus, setSavingStatus] = useState(false)
  const [savingSched, setSavingSched] = useState(false)
  const [savingOverride, setSavingOverride] = useState(false)
  const [dayOverride, setDayOverride] = useState({
    date: '',
    halfDay: 'both',
    morningStart: '09:00',
    morningEnd: '13:00',
    afternoonStart: '16:00',
    afternoonEnd: '20:00',
    maxMorning: 20,
    maxAfternoon: 20,
  })
  const navigate = useNavigate()

  useEffect(() => {
    if (dToken) {
      getDashData()
      getProfileData()
    }
  }, [dToken])

  // Initialize scheduling editor from the doctor's saved profile.
  useEffect(() => {
    if (!profileData) return
    setSched({
      opStart: profileData.opStart || '09:00',
      opEnd: profileData.opEnd || '13:00',
      opStartAfternoon: profileData.opStartAfternoon || '16:00',
      opEndAfternoon: profileData.opEndAfternoon || '20:00',
      maxAppointmentsMorning: profileData.maxAppointmentsMorning || 20,
      maxAppointmentsAfternoon: profileData.maxAppointmentsAfternoon || 20,
      videoOpStart: profileData.videoOpStart || '14:00',
      videoOpEnd: profileData.videoOpEnd || '15:00',
      maxVideoSlots: profileData.maxVideoSlots ?? 4,
      videoSlotMinutes: profileData.videoSlotMinutes || 15,
      days: Array.isArray(profileData.availableDays) && profileData.availableDays.length
        ? profileData.availableDays
        : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    })
  }, [profileData])

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Persist a partial profile change via the existing update-profile endpoint.
  // address/fees/about are always sent so they are not wiped server-side.
  const saveProfile = async (overrides = {}, successMsg) => {
    try {
      const fd = new FormData()
      fd.append('address', JSON.stringify(profileData?.address || { line1: '', line2: '' }))
      fd.append('fees', String(profileData?.fees ?? 0))
      fd.append('about', profileData?.about || '')
      if (overrides.status !== undefined) fd.append('status', overrides.status)
      if (overrides.opStart !== undefined) fd.append('opStart', overrides.opStart)
      if (overrides.opEnd !== undefined) fd.append('opEnd', overrides.opEnd)
      if (overrides.opStartAfternoon !== undefined) fd.append('opStartAfternoon', overrides.opStartAfternoon)
      if (overrides.opEndAfternoon !== undefined) fd.append('opEndAfternoon', overrides.opEndAfternoon)
      if (overrides.maxAppointmentsMorning !== undefined) fd.append('maxAppointmentsMorning', String(overrides.maxAppointmentsMorning))
      if (overrides.maxAppointmentsAfternoon !== undefined) fd.append('maxAppointmentsAfternoon', String(overrides.maxAppointmentsAfternoon))
      if (overrides.videoOpStart !== undefined) fd.append('videoOpStart', overrides.videoOpStart)
      if (overrides.videoOpEnd !== undefined) fd.append('videoOpEnd', overrides.videoOpEnd)
      if (overrides.maxVideoSlots !== undefined) fd.append('maxVideoSlots', String(overrides.maxVideoSlots))
      if (overrides.videoSlotMinutes !== undefined) fd.append('videoSlotMinutes', String(overrides.videoSlotMinutes))
      if (overrides.availableDays !== undefined) fd.append('availableDays', JSON.stringify(overrides.availableDays))
      const { data } = await axios.post(backendUrl + '/api/doctor/update-profile', fd, { headers: { dToken } })
      if (data.success) {
        if (successMsg) toast.success(successMsg)
        getProfileData()
        return true
      }
      toast.error(data.message || 'Could not save')
      return false
    } catch (e) {
      toast.error(e.response?.data?.message || e.message || 'Could not save')
      return false
    }
  }

  const handleStatusChange = async (value, label) => {
    if (savingStatus) return
    setSavingStatus(true)
    await saveProfile({ status: value }, `Status updated to ${label}`)
    setSavingStatus(false)
  }

  const toggleDay = (day) => {
    setSched((prev) => ({
      ...prev,
      days: prev.days.includes(day) ? prev.days.filter((d) => d !== day) : [...prev.days, day],
    }))
  }

  const handleScheduleSave = async () => {
    if (savingSched) return
    if (!sched.opStart || !sched.opEnd || !sched.opStartAfternoon || !sched.opEndAfternoon) {
      toast.error('Please set both morning and afternoon OP timings')
      return
    }
    if (!sched.videoOpStart || !sched.videoOpEnd) {
      toast.error('Please set video consult timings')
      return
    }
    if (!sched.maxVideoSlots && sched.maxVideoSlots !== 0) {
      toast.error('Set how many video slots per day')
      return
    }
    if (sched.days.length === 0) {
      toast.error('Select at least one available day')
      return
    }
    setSavingSched(true)
    await saveProfile(
      { 
        opStart: sched.opStart, 
        opEnd: sched.opEnd, 
        opStartAfternoon: sched.opStartAfternoon,
        opEndAfternoon: sched.opEndAfternoon,
        maxAppointmentsMorning: sched.maxAppointmentsMorning,
        maxAppointmentsAfternoon: sched.maxAppointmentsAfternoon,
        videoOpStart: sched.videoOpStart,
        videoOpEnd: sched.videoOpEnd,
        maxVideoSlots: sched.maxVideoSlots,
        videoSlotMinutes: sched.videoSlotMinutes,
        availableDays: sched.days 
      },
      'Schedule updated'
    )
    setSavingSched(false)
  }

  const handleDayOverrideSave = async () => {
    if (savingOverride) return
    if (!dayOverride.date) {
      toast.error('Pick a date for the day override')
      return
    }
    setSavingOverride(true)
    try {
      const payload = {
        date: dayOverride.date,
        halfDay: dayOverride.halfDay,
        morningStart: dayOverride.morningStart,
        morningEnd: dayOverride.morningEnd,
        afternoonStart: dayOverride.afternoonStart,
        afternoonEnd: dayOverride.afternoonEnd,
        maxAppointmentsMorning: dayOverride.maxMorning,
        maxAppointmentsAfternoon: dayOverride.maxAfternoon,
      }
      const { data } = await axios.post(
        `${backendUrl}/api/doctor/schedule/overrides`,
        payload,
        { headers: { dToken } },
      )
      if (data.success) {
        toast.success('Day override saved — only this date is affected')
      } else {
        toast.error(data.message || 'Could not save day override')
      }
    } catch (e) {
      toast.error(e.response?.data?.message || e.message || 'Could not save day override')
    }
    setSavingOverride(false)
  }

  const currentStatus = profileData?.status || (profileData?.available === false ? 'offline' : 'available')

  const formatTime = (date) =>
    date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })

  const formatDate = (date) =>
    date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

  if (!dashData) {
    return (
      <DeskPage>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto" />
            <p className="mt-4 text-rd-muted">Loading dashboard...</p>
          </div>
        </div>
      </DeskPage>
    )
  }

  return (
    <DeskPage>
      <DeskHeader
        title={`Good day, ${profileData?.name || 'Doctor'}`}
        subtitle={`${formatDate(currentTime)} · ${formatTime(currentTime)}`}
        right={<DeskBtn onClick={() => getDashData()}>Refresh</DeskBtn>}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <DeskKpi
          label="Revenue"
          value={`${currency}${dashData.earnings ? dashData.earnings.toLocaleString() : '0'}`}
          tone="emerald"
          icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
        />
        <DeskKpi
          label="Appointments"
          value={<AnimatedCounter value={dashData.appointments || 0} duration={2000} />}
          tone="violet"
          onClick={() => navigate('/doctor-appointments')}
          icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
        />
        <DeskKpi
          label="Total Patients"
          value={<AnimatedCounter value={dashData.patients || 0} duration={2000} />}
          tone="teal"
          onClick={() => navigate('/doctor-appointments')}
          icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
        />
      </div>

      <div className="rd-card rd-soft bg-rd-surface rounded-[16px] border border-rd-border px-3.5 py-3">
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="text-sm font-bold text-rd-text shrink-0">Quick Actions</h2>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 flex-1 min-w-0">
            {[
              { label: 'Queue Manager', to: '/doctor-in-queue', bg: 'bg-indigo-500' },
              { label: 'Video Calls', to: '/doctor-video-calls', bg: 'bg-sky-500' },
              { label: 'Patients', to: '/doctor-patients', bg: 'bg-teal-500' },
              { label: 'AI Patient Journey', to: '/doctor-patient-journey', bg: 'bg-rose-500' },
              { label: 'Profile', to: '/doctor-profile', bg: 'bg-violet-500' },
            ].map((a) => (
              <button
                key={a.to}
                type="button"
                onClick={() => navigate(a.to)}
                className={`${a.bg} text-white text-[11px] font-semibold rounded-xl px-2 py-2.5 text-center hover:opacity-90`}
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Specialist referrals assigned to this doctor */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <McCard title="Specialist Referrals">
          <p className="text-xs text-mc-text-muted mb-3">Patients referred to you by other doctors. Accept to enable patient booking.</p>
          {loadingOrders ? (
            <div className="text-center py-6 text-xs text-mc-text-muted animate-pulse">Loading referrals…</div>
          ) : specialistReferrals.length === 0 ? (
            <div className="text-center py-8 border border-dashed border-mc-border rounded-xl bg-mc-canvas/20">
              <p className="text-xs text-mc-text-muted font-medium">No pending specialist referrals</p>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[280px] overflow-y-auto pr-1">
              {specialistReferrals.map((ref) => {
                const pending = String(ref.status || '').toUpperCase() === 'PENDING'
                return (
                  <div key={ref.id} className="p-3.5 rounded-xl border border-mc-border bg-mc-canvas/30 space-y-2">
                    <div className="flex justify-between gap-2">
                      <div>
                        <span className="font-bold text-xs text-mc-text block">{ref.patient_name}</span>
                        <span className="text-[11px] text-mc-text-muted block mt-0.5">
                          From {ref.referring_doctor_name || 'Doctor'} · {ref.to_dept}
                        </span>
                        {ref.reason && (
                          <span className="text-[10px] text-slate-500 block mt-1">{ref.reason}</span>
                        )}
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                        pending ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {String(ref.status || 'PENDING').replaceAll('_', ' ')}
                      </span>
                    </div>
                    {pending && (
                      <div className="flex gap-2 pt-1">
                        <button
                          type="button"
                          disabled={referralBusyId === ref.id}
                          onClick={() => handleReferralAction(ref.id, 'accept')}
                          className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-bold disabled:opacity-50"
                        >
                          Accept
                        </button>
                        <button
                          type="button"
                          disabled={referralBusyId === ref.id}
                          onClick={() => handleReferralAction(ref.id, 'reject')}
                          className="px-3 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 text-[10px] font-bold disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                    {String(ref.status || '').toUpperCase() === 'APPOINTMENT_BOOKED' && (
                      <button
                        type="button"
                        disabled={referralBusyId === ref.id}
                        onClick={() => handleReferralAction(ref.id, 'complete')}
                        className="px-3 py-1.5 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white text-[10px] font-bold disabled:opacity-50"
                      >
                        Mark consultation complete
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </McCard>

        <McCard title="Referral Notifications">
          <p className="text-xs text-mc-text-muted mb-3">New referrals and appointment updates for you.</p>
          {loadingOrders ? (
            <div className="text-center py-6 text-xs text-mc-text-muted animate-pulse">Loading…</div>
          ) : doctorNotifications.length === 0 ? (
            <div className="text-center py-8 border border-dashed border-mc-border rounded-xl bg-mc-canvas/20">
              <p className="text-xs text-mc-text-muted font-medium">No recent notifications</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
              {doctorNotifications.slice(0, 8).map((n) => (
                <div key={n.id} className="p-3 rounded-xl border border-slate-100 bg-slate-50">
                  <p className="text-xs font-bold text-slate-800">{n.title}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">{n.body}</p>
                </div>
              ))}
            </div>
          )}
        </McCard>
      </div>

      {/* AI alert findings and pathology reports for doctor review */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* AI Findings feed */}
        <McCard title="AI Agent Alerts & Findings">
          <p className="text-xs text-mc-text-muted mb-3">SLA breaches and process findings flagged by Medclues AI monitoring.</p>
          {loadingOrders ? (
            <div className="text-center py-6 text-xs text-mc-text-muted animate-pulse">Loading alerts…</div>
          ) : openFindings.length === 0 ? (
            <div className="text-center py-8 border border-dashed border-mc-border rounded-xl bg-mc-canvas/20">
              <p className="text-xs text-mc-text-muted font-medium">✓ No outstanding AI warnings or SLA alerts</p>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[280px] overflow-y-auto pr-1">
              {openFindings.map((f) => {
                const isHigh = f.priority === 'HIGH'
                return (
                  <div key={f.id} className="p-3.5 rounded-xl border border-mc-border bg-mc-canvas/30 flex flex-col gap-2 relative overflow-hidden shadow-sm">
                    <div className={`absolute left-0 top-0 bottom-0 w-1 ${isHigh ? 'bg-rose-500' : 'bg-amber-400'}`} />
                    <div className="flex items-center justify-between gap-2">
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-black tracking-wide uppercase ${isHigh ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-amber-50 text-amber-600 border border-amber-100'}`}>
                        {f.priority} SLA WARNING
                      </span>
                      <span className="text-[10px] text-mc-text-muted">
                        {new Date(f.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-mc-text leading-relaxed">{f.message}</p>
                    <div className="flex justify-between items-center pt-1 border-t border-mc-border/60">
                      <span className="text-[10px] text-mc-text-muted font-bold">Patient: {f.patient_name}</span>
                      <button
                        onClick={() => setReviewFinding(f)}
                        className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold shadow-sm transition-colors"
                      >
                        Review Finding
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </McCard>

        {/* Pathology reports needing doctor review */}
        <McCard title="New Lab Report Available">
          <p className="text-xs text-mc-text-muted mb-3">Completed investigations with reports ready for your clinical review.</p>
          {loadingOrders ? (
            <div className="text-center py-6 text-xs text-mc-text-muted animate-pulse">Loading reports…</div>
          ) : pendingReports.length === 0 ? (
            <div className="text-center py-8 border border-dashed border-mc-border rounded-xl bg-mc-canvas/20">
              <p className="text-xs text-mc-text-muted font-medium">No pending lab reports for review</p>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[280px] overflow-y-auto pr-1">
              {pendingReports.map((item) => (
                <div key={item.id} className="p-3.5 rounded-xl border border-mc-border bg-mc-canvas/30 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:bg-mc-canvas/50 transition-all shadow-sm">
                  <div className="min-w-0">
                    <span className="font-bold text-xs text-mc-text block">{item.patient_name}</span>
                    <span className="text-[11px] text-mc-text-muted block mt-0.5">{item.test_name}</span>
                    {item.report_url && (
                      <a
                        href={reportLink(item.id)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] text-indigo-500 font-bold hover:underline inline-flex items-center gap-1 mt-1"
                      >
                        View report
                      </a>
                    )}
                  </div>
                  <button
                    onClick={() => { setReviewTarget(item); setReviewNotes('') }}
                    className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold shadow-sm shrink-0 transition-colors"
                  >
                    Review report
                  </button>
                </div>
              ))}
            </div>
          )}
        </McCard>
      </div>

      <McCard title="Accepted patients">
        <p className="text-xs text-mc-text-muted mb-3">After you accept a booking, consult and suggest investigations here. Journey updates automatically.</p>
        {(!dashData.latestAppointments || dashData.latestAppointments.filter((a) => !a.cancelled && String(a.lifecycleStatus || '').toUpperCase() === 'CONFIRMED').length === 0) ? (
          <p className="text-xs text-slate-400 py-4">No confirmed patients yet. Accept a booking from Patients.</p>
        ) : (
          <div className="space-y-2">
            {dashData.latestAppointments
              .filter((a) => !a.cancelled && String(a.lifecycleStatus || '').toUpperCase() === 'CONFIRMED')
              .map((item) => (
                <div key={item._id} className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl border border-slate-200">
                  <div>
                    <p className="text-sm font-bold text-slate-800">{getPatientName(item)}</p>
                    <p className="text-[11px] text-slate-500">ID {item.userId} · {slotDateFormat(item.slotDate)} {item.slotTime || ''}</p>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" className="px-2.5 py-1.5 rounded-lg bg-indigo-600 text-white text-[11px] font-bold" onClick={() => setInvestigateFor(item)}>
                      Suggest Investigation
                    </button>
                    <button type="button" className="px-2.5 py-1.5 rounded-lg bg-slate-100 text-[11px] font-bold" onClick={() => navigate('/doctor-patient-journey')}>
                      Journey
                    </button>
                  </div>
                </div>
              ))}
          </div>
        )}
      </McCard>

      {/* Availability status + Scheduling */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Status buttons */}
        <McCard title="My Availability">
          <p className="text-xs text-mc-text-muted mb-3">Set your current consultation status — patients see this instantly.</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {STATUS_OPTIONS.map((opt) => {
              const active = currentStatus === opt.value
              return (
                <button
                  key={opt.value}
                  type="button"
                  disabled={savingStatus}
                  onClick={() => handleStatusChange(opt.value, opt.label)}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all disabled:opacity-60 ${
                    active
                      ? `${opt.activeCls} ring-2 ring-offset-2`
                      : 'bg-white border-mc-border hover:border-slate-300 text-mc-text'
                  }`}
                >
                  <span className={`w-3 h-3 rounded-full ${opt.dot} shadow-sm`} />
                  <span className="text-xs font-bold uppercase tracking-wider">{opt.label}</span>
                </button>
              )
            })}
          </div>
        </McCard>

        {/* Scheduling & Consultation */}
        <McCard title="Scheduling & Consultation">
          <div className="space-y-4">
            {/* Morning Session */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs font-semibold text-mc-text uppercase tracking-wider text-sky-600">Morning Session Timings *</label>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Capacity / Slots</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1 flex items-center gap-2">
                  <input
                    type="time"
                    value={sched.opStart}
                    onChange={(e) => setSched((p) => ({ ...p, opStart: e.target.value }))}
                    className="flex-1 px-3 py-2 border border-mc-border rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-400"
                  />
                  <span className="text-xs text-mc-text-muted">to</span>
                  <input
                    type="time"
                    value={sched.opEnd}
                    onChange={(e) => setSched((p) => ({ ...p, opEnd: e.target.value }))}
                    className="flex-1 px-3 py-2 border border-mc-border rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-400"
                  />
                </div>
                <div className="w-24 shrink-0">
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={sched.maxAppointmentsMorning}
                    onChange={(e) => setSched((p) => ({ ...p, maxAppointmentsMorning: parseInt(e.target.value) || '' }))}
                    className="w-full px-3 py-2 border border-mc-border rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-400 text-center font-bold text-slate-700"
                  />
                </div>
              </div>
            </div>

            {/* Afternoon Session */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs font-semibold text-mc-text uppercase tracking-wider text-teal-600">Afternoon / Evening Session *</label>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Capacity / Slots</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1 flex items-center gap-2">
                  <input
                    type="time"
                    value={sched.opStartAfternoon}
                    onChange={(e) => setSched((p) => ({ ...p, opStartAfternoon: e.target.value }))}
                    className="flex-1 px-3 py-2 border border-mc-border rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-400"
                  />
                  <span className="text-xs text-mc-text-muted">to</span>
                  <input
                    type="time"
                    value={sched.opEndAfternoon}
                    onChange={(e) => setSched((p) => ({ ...p, opEndAfternoon: e.target.value }))}
                    className="flex-1 px-3 py-2 border border-mc-border rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-400"
                  />
                </div>
                <div className="w-24 shrink-0">
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={sched.maxAppointmentsAfternoon}
                    onChange={(e) => setSched((p) => ({ ...p, maxAppointmentsAfternoon: parseInt(e.target.value) || '' }))}
                    className="w-full px-3 py-2 border border-mc-border rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-400 text-center font-bold text-slate-700"
                  />
                </div>
              </div>
            </div>

            {/* Video consult session */}
            <div className="pt-2 border-t border-slate-100">
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs font-semibold text-mc-text uppercase tracking-wider text-violet-600">Video Consult Session</label>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Slots / Day</span>
              </div>
              <div className="flex items-center gap-3 mb-2">
                <div className="flex-1 flex items-center gap-2">
                  <input
                    type="time"
                    value={sched.videoOpStart}
                    onChange={(e) => setSched((p) => ({ ...p, videoOpStart: e.target.value }))}
                    className="flex-1 px-3 py-2 border border-mc-border rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400"
                  />
                  <span className="text-xs text-mc-text-muted">to</span>
                  <input
                    type="time"
                    value={sched.videoOpEnd}
                    onChange={(e) => setSched((p) => ({ ...p, videoOpEnd: e.target.value }))}
                    className="flex-1 px-3 py-2 border border-mc-border rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400"
                  />
                </div>
                <div className="w-24 shrink-0">
                  <input
                    type="number"
                    min="0"
                    max="48"
                    value={sched.maxVideoSlots}
                    onChange={(e) => setSched((p) => ({ ...p, maxVideoSlots: parseInt(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border border-mc-border rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 text-center font-bold text-slate-700"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0">Minutes / call</span>
                <select
                  value={sched.videoSlotMinutes}
                  onChange={(e) => setSched((p) => ({ ...p, videoSlotMinutes: parseInt(e.target.value) || 15 }))}
                  className="px-3 py-2 border border-mc-border rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400"
                >
                  {[10, 15, 20, 30, 45, 60].map((m) => (
                    <option key={m} value={m}>{m} min</option>
                  ))}
                </select>
                <span className="text-[11px] text-slate-400">Patients book one call per slot</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-mc-text mb-1.5">Available Days *</label>
              <div className="flex flex-wrap gap-2">
                {WEEK_DAYS.map((day) => {
                  const active = sched.days.includes(day)
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleDay(day)}
                      className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
                        active
                          ? 'bg-teal-500 text-white shadow-sm'
                          : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      }`}
                    >
                      {day}
                    </button>
                  )
                })}
              </div>
            </div>
            <button
              type="button"
              onClick={handleScheduleSave}
              disabled={savingSched}
              className="mc-btn mc-btn--primary w-full sm:w-auto disabled:opacity-60"
            >
              {savingSched ? 'Saving…' : 'Save Schedule'}
            </button>

            <div className="pt-4 mt-4 border-t border-mc-border space-y-3">
              <div>
                <h4 className="text-sm font-bold text-mc-text">Edit this day only</h4>
                <p className="text-xs text-mc-text-muted mt-0.5">
                  Change timings or capacity for a single date without affecting your default schedule.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-mc-text mb-1">Date</label>
                  <input
                    type="date"
                    value={dayOverride.date}
                    onChange={(e) => setDayOverride((p) => ({ ...p, date: e.target.value }))}
                    className="w-full px-3 py-2 border border-mc-border rounded-lg text-sm bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-mc-text mb-1">Session</label>
                  <select
                    value={dayOverride.halfDay}
                    onChange={(e) => setDayOverride((p) => ({ ...p, halfDay: e.target.value }))}
                    className="w-full px-3 py-2 border border-mc-border rounded-lg text-sm bg-white"
                  >
                    <option value="both">Full day (custom)</option>
                    <option value="morning">Morning only (half day)</option>
                    <option value="afternoon">Afternoon only (half day)</option>
                    <option value="cancel">Day off (cancel bookings seats)</option>
                  </select>
                </div>
              </div>
              {dayOverride.halfDay !== 'cancel' && (
                <div className="grid grid-cols-2 gap-3">
                  {(dayOverride.halfDay === 'both' || dayOverride.halfDay === 'morning') && (
                    <>
                      <input type="time" value={dayOverride.morningStart} onChange={(e) => setDayOverride((p) => ({ ...p, morningStart: e.target.value }))} className="px-3 py-2 border border-mc-border rounded-lg text-sm" />
                      <input type="time" value={dayOverride.morningEnd} onChange={(e) => setDayOverride((p) => ({ ...p, morningEnd: e.target.value }))} className="px-3 py-2 border border-mc-border rounded-lg text-sm" />
                      <input type="number" min="0" max="100" value={dayOverride.maxMorning} onChange={(e) => setDayOverride((p) => ({ ...p, maxMorning: parseInt(e.target.value) || 0 }))} className="px-3 py-2 border border-mc-border rounded-lg text-sm" placeholder="Morning seats" />
                    </>
                  )}
                  {(dayOverride.halfDay === 'both' || dayOverride.halfDay === 'afternoon') && (
                    <>
                      <input type="time" value={dayOverride.afternoonStart} onChange={(e) => setDayOverride((p) => ({ ...p, afternoonStart: e.target.value }))} className="px-3 py-2 border border-mc-border rounded-lg text-sm" />
                      <input type="time" value={dayOverride.afternoonEnd} onChange={(e) => setDayOverride((p) => ({ ...p, afternoonEnd: e.target.value }))} className="px-3 py-2 border border-mc-border rounded-lg text-sm" />
                      <input type="number" min="0" max="100" value={dayOverride.maxAfternoon} onChange={(e) => setDayOverride((p) => ({ ...p, maxAfternoon: parseInt(e.target.value) || 0 }))} className="px-3 py-2 border border-mc-border rounded-lg text-sm" placeholder="Afternoon seats" />
                    </>
                  )}
                </div>
              )}
              <button
                type="button"
                onClick={handleDayOverrideSave}
                disabled={savingOverride}
                className="mc-btn mc-btn--secondary w-full sm:w-auto disabled:opacity-60"
              >
                {savingOverride ? 'Saving…' : 'Save day override'}
              </button>
            </div>
          </div>
        </McCard>
      </div>

      {/* Video consultations */}
      <McCard title="Video Consultations" noPadding>
        <div className="px-5 py-2 text-xs text-mc-text-muted border-b border-mc-border">Paid online appointments ready for video call</div>
        <div className="divide-y divide-mc-border max-h-[360px] overflow-y-auto">
          {(!dashData.todayVideoConsults || dashData.todayVideoConsults.length === 0) ? (
            <div className="flex flex-col items-center justify-center py-12 text-mc-text-muted">
              <svg className="w-12 h-12 mb-2 text-sky-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
              <p className="text-sm font-semibold text-mc-text">No active video consultations</p>
              <p className="text-xs">You currently have no ongoing video consultations.</p>
            </div>
          ) : (
            dashData.todayVideoConsults.map((item, index) => (
              <div key={item._id || index} className="flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-3 hover:bg-sky-50/40 transition-colors">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <img className="rounded-full w-10 h-10 object-cover ring-2 ring-sky-100 shrink-0" src={getPatientImage(item)} alt="" />
                  <div className="min-w-0 flex-1">
                    <p className="text-mc-text font-bold text-sm truncate">{getPatientName(item)}</p>
                    <p className="text-xs text-mc-text-muted mt-0.5">{item.slotTime || 'Time TBD'} · Age {getPatientAge(item, calculateAge)}</p>
                    <p className="text-[10px] mt-1">
                      <span className={`inline-flex px-2 py-0.5 rounded-full font-semibold ${item.payment ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                        {item.payment ? 'Paid' : 'Payment pending'}
                      </span>
                      <span className="text-mc-text-muted mx-1">·</span>
                      <span className="text-mc-text-muted">{currency}{item.amount}</span>
                    </p>
                  </div>
                </div>
                {isOnlineVideoAppointment(item) && !item.cancelled && !item.isCompleted && (
                  <button type="button" onClick={() => navigate(`/doctor-video/${item._id}`)}
                    className="mc-btn mc-btn--primary shrink-0">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                    Join Video Call
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </McCard>

      {investigateFor && (
        <SuggestInvestigationModal
          patientId={investigateFor.userId}
          patientName={getPatientName(investigateFor)}
          onClose={() => setInvestigateFor(null)}
          onCreated={() => { getDashData(); loadOrdersData() }}
        />
      )}
      {reviewTarget && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setReviewTarget(null)}>
          <div className="bg-white rounded-2xl p-5 max-w-md w-full shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-black text-slate-900">Review lab report</h3>
            <p className="text-xs text-slate-500 mt-1">{reviewTarget.patient_name} · {reviewTarget.test_name}</p>
            <p className="text-xs text-amber-700 font-semibold mt-1">⚠ Needs your review</p>
            {reviewTarget.report_url && (
              <a href={reportLink(reviewTarget.id)} target="_blank" rel="noreferrer" className="text-xs text-indigo-600 font-bold mt-2 inline-block">View report</a>
            )}
            <textarea value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} rows={3} placeholder="Clinical notes (optional)" className="w-full border rounded-xl p-2 text-sm mt-3" />
            <div className="flex flex-wrap gap-2 mt-3">
              <button disabled={reviewBusy} type="button" className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold" onClick={() => handleMarkReviewed(reviewTarget.id)}>Mark as Reviewed</button>
              <button disabled={reviewBusy} type="button" className="px-3 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold" onClick={() => handleMarkReviewed(reviewTarget.id, 'TREATMENT')}>Review + Treatment</button>
              <button disabled={reviewBusy} type="button" className="px-3 py-2 rounded-xl bg-sky-600 text-white text-xs font-bold" onClick={() => { handleMarkReviewed(reviewTarget.id, 'REFERRAL'); navigate('/doctor-patients') }}>Review + Refer</button>
              <button type="button" className="px-3 py-2 rounded-xl bg-slate-100 text-xs font-bold" onClick={() => setReviewTarget(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
      {reviewFinding && (
        <HumanReviewModal
          finding={reviewFinding}
          patientName={reviewFinding.patient_name}
          reviewerName={profileData?.name}
          journeyEvidence={[]}
          busy={findingReviewBusy}
          onClose={() => setReviewFinding(null)}
          onSubmit={(decision, comment, mods) => handleFindingReview(reviewFinding.id, decision, comment, mods)}
        />
      )}
    </DeskPage>
  )
}

export default DoctorDashboard
