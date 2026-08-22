import React, { useContext, useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import { toast } from 'react-toastify'
import { DoctorContext } from '../../context/DoctorContext'
import { ReceptionContext } from '../../context/ReceptionContext'
import { DeanContext } from '../../context/DeanContext'
import { AdminPageLayout, McCard } from '../../components/mc'
import ReferralDoctorPicker, { doctorSpec } from '../../components/ReferralDoctorPicker'
import HumanReviewModal from '../../components/HumanReviewModal'

const PIPELINE = [
  ['registration', 'Registration'],
  ['problem', 'Problem reported'],
  ['doctor_accepted', 'Doctor accepted'],
  ['consultation', 'Consultation'],
  ['investigation', 'Investigation'],
  ['report', 'Lab report'],
  ['doctor_review', 'Doctor review'],
  ['pharmacy', 'Pharmacy'],
  ['referral', 'Referral'],
  ['specialist_appointment', 'Specialist appointment'],
  ['followup', 'Follow-up'],
]

const formatStep = (value) => {
  const v = String(value || '').trim()
  if (!v || v.toUpperCase() === 'NONE') return 'Not yet created'
  if (v.includes(' ') || v.includes('—') || v.includes('(')) return v
  return v.replaceAll('_', ' ')
}

const toneForLabel = (key, label) => {
  const lv = String(label || '').toLowerCase()
  if (!lv || lv.includes('not required') || lv.includes('not applicable')) return 'muted'
  if (lv.includes('not yet') || lv.includes('not scheduled') || lv.includes('not booked') || lv.includes('overdue') || lv.includes('declined') || lv.includes('pending review')) return 'danger'
  if (key === 'followup') {
    if (lv.includes('completed')) return 'ok'
    if (lv.includes('overdue')) return 'danger'
    if (/\d/.test(lv)) return 'warn'
    return lv.includes('not yet') ? 'danger' : 'muted'
  }
  if (key === 'referral') {
    if (lv.includes('not yet')) return 'danger'
    if (lv.includes('completed') || lv.includes('accepted')) return 'ok'
    if (lv.includes('created') || lv.includes('pending')) return 'warn'
    return 'danger'
  }
  if (key === 'specialist_appointment') {
    if (lv.includes('completed') || (/\d/.test(lv) && !lv.includes('not'))) return 'ok'
    if (lv.includes('awaiting')) return 'danger'
    return 'danger'
  }
  if (key === 'pharmacy') {
    if (lv.includes('delivered') || lv.includes('completed')) return 'ok'
    if (lv.includes('ready')) return 'warn'
    if (lv.includes('payment') || lv.includes('pending') || lv.includes('placed')) return 'danger'
    if (lv.includes('not yet') || lv.includes('not required')) return lv.includes('not required') ? 'muted' : 'danger'
    return 'warn'
  }
  if (key === 'consultation' && lv.includes('scheduled')) return 'warn'
  if (lv.includes('completed') || (key === 'report' && lv.includes('available'))) return 'ok'
  if (lv.includes('pending') || lv.includes('awaiting') || lv.includes('in progress')) return 'warn'
  return 'muted'
}

const listBadge = (j) => {
  const st = String(j.journey_status || '').toUpperCase()
  if (st === 'OVERDUE') return { label: 'OVERDUE', tone: 'danger' }
  if (st === 'ATTENTION_REQUIRED' || st === 'ACTION_NEEDED') return { label: 'ATTENTION', tone: 'danger' }
  if (st === 'UPCOMING') return { label: 'UPCOMING', tone: 'warn' }
  return { label: 'ON TRACK', tone: 'ok' }
}

const overallStatusLabel = (status) => {
  const st = String(status || '').toUpperCase()
  if (st === 'ON_TRACK') return { text: '🟢 ON TRACK', tone: 'ok' }
  if (st === 'UPCOMING') return { text: '🟡 UPCOMING', tone: 'warn' }
  if (st === 'OVERDUE') return { text: '🔴 OVERDUE', tone: 'danger' }
  return { text: '🔴 ATTENTION REQUIRED', tone: 'danger' }
}

const TONE_CLS = {
  ok: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  warn: 'bg-amber-50 text-amber-900 border-amber-200',
  danger: 'bg-rose-50 text-rose-800 border-rose-200',
  muted: 'bg-slate-50 text-slate-500 border-slate-200',
}

const TONE_DOT = { ok: '🟢', warn: '🟡', danger: '🔴', muted: '⚪' }

const Pill = ({ value, tone, stepKey }) => {
  const display = formatStep(value)
  const t = tone || toneForLabel(stepKey, value)
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border ${TONE_CLS[t] || TONE_CLS.muted}`}>
      <span>{TONE_DOT[t] || '⚪'}</span> {display}
    </span>
  )
}

const DoctorPatientJourney = () => {
  const { dToken, backendUrl, profileData, getProfileData } = useContext(DoctorContext)
  const { recToken } = useContext(ReceptionContext)
  const { deanToken } = useContext(DeanContext)
  const token = dToken || recToken || deanToken
  const headers = dToken
    ? { dtoken: dToken }
    : recToken
      ? { Token: recToken }
      : { deantoken: deanToken }

  const [journeys, setJourneys] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [evidenceFinding, setEvidenceFinding] = useState(null)
  const [modifyFor, setModifyFor] = useState(null)
  const [modifyDate, setModifyDate] = useState('')
  const [note, setNote] = useState('')
  const [rechecking, setRechecking] = useState(false)
  const [recheckDone, setRecheckDone] = useState(null)
  const [showFollowupModal, setShowFollowupModal] = useState(false)
  const [followupDate, setFollowupDate] = useState('')
  const [followupTime, setFollowupTime] = useState('')
  const [followupInstructions, setFollowupInstructions] = useState('')
  const [schedulingFollowup, setSchedulingFollowup] = useState(false)
  const [showReferralModal, setShowReferralModal] = useState(false)
  const [referralSpec, setReferralSpec] = useState('ALL')
  const [referralDoctorId, setReferralDoctorId] = useState('')
  const [referralToDept, setReferralToDept] = useState('')
  const [referralReason, setReferralReason] = useState('')
  const [referralPriority, setReferralPriority] = useState('ROUTINE')
  const [referralNotes, setReferralNotes] = useState('')
  const [creatingReferral, setCreatingReferral] = useState(false)
  const [reviewFinding, setReviewFinding] = useState(null)
  const [lastReviewResult, setLastReviewResult] = useState(null)

  const doctorAuthHeaders = useMemo(() => {
    if (dToken) return { dtoken: dToken }
    if (recToken) return { Token: recToken }
    if (deanToken) return { deantoken: deanToken }
    return {}
  }, [dToken, recToken, deanToken])

  const staffHeaders = useMemo(() => ({ headers }), [dToken, recToken, deanToken])

  const reportLink = (investigationId, download = false) => {
    const q = new URLSearchParams()
    const authTok = dToken || recToken || deanToken || ''
    if (dToken) q.set('dtoken', dToken)
    else q.set('token', authTok)
    if (download) q.set('download', '1')
    return `${backendUrl}/api/investigations/${investigationId}/report?${q.toString()}`
  }

  const openReportViewer = (report) => {
    if (!report?.id) return
    window.open(reportLink(report.id), '_blank', 'noopener,noreferrer')
  }

  const createReferral = async () => {
    if (!selectedId || !referralDoctorId || !referralReason.trim()) {
      toast.error('Select a specialist and enter a reason')
      return
    }
    const toDept =
      referralSpec && referralSpec !== 'ALL'
        ? referralSpec
        : referralToDept || 'General Medicine'

    setCreatingReferral(true)
    try {
      const { data } = await axios.post(
        `${backendUrl}/api/referrals`,
        {
          patient_id: selectedId,
          to_dept: toDept,
          specialistDoctorId: Number(referralDoctorId),
          reason: referralReason.trim(),
          notes: [referralNotes.trim(), referralPriority !== 'ROUTINE' ? `Priority: ${referralPriority}` : ''].filter(Boolean).join('\n') || undefined,
        },
        staffHeaders
      )
      if (data.success) {
        toast.success('Referral created — specialist notified')
        setShowReferralModal(false)
        setReferralSpec('ALL')
        setReferralDoctorId('')
        setReferralToDept('')
        setReferralReason('')
        setReferralNotes('')
        await loadDetail(selectedId, { refresh: true })
        await loadList()
      } else {
        toast.error(data.message || 'Failed to create referral')
      }
    } catch (e) {
      toast.error(e.response?.data?.detail || e.message)
    } finally {
      setCreatingReferral(false)
    }
  }

  const handleSelectSpecialist = (id, doc) => {
    setReferralDoctorId(String(id))
    setReferralToDept(doctorSpec(doc))
  }

  const minFollowupDate = useMemo(() => new Date().toISOString().slice(0, 10), [])

  const loadList = async () => {
    try {
      const { data } = await axios.get(`${backendUrl}/api/ai/patient-journeys`, staffHeaders)
      if (data.success) {
        setJourneys(data.journeys || [])
        if (!selectedId && data.journeys?.[0]?.patient_id) {
          setSelectedId(data.journeys[0].patient_id)
        }
      } else {
        toast.error(data.message || 'Could not load journeys')
      }
    } catch (e) {
      const status = e.response?.status
      const detail = e.response?.data?.detail
      toast.error(
        status === 404
          ? 'Journey API is not on this backend. Restart uvicorn from the project fastapi_back folder.'
          : (typeof detail === 'string' ? detail : e.message)
      )
    } finally {
      setLoading(false)
    }
  }

  const loadDetail = async (patientId, { refresh = false } = {}) => {
    if (!patientId) return
    if (refresh) setRechecking(true)
    try {
      const url = refresh
        ? `${backendUrl}/api/ai/patient-journey/${patientId}/refresh`
        : `${backendUrl}/api/ai/patient-journey/${patientId}`
      const { data } = refresh
        ? await axios.post(url, {}, staffHeaders)
        : await axios.get(url, staffHeaders)
      if (data?.success) {
        setDetail(data)
        if (refresh && data.agent_refresh) {
          setRecheckDone(data.agent_refresh)
          toast.success('Agents re-checked — journey updated')
        }
      } else toast.error(data?.message || 'Journey not found')
    } catch (e) {
      const detailMsg = e.response?.data?.detail
      toast.error(typeof detailMsg === 'string' ? detailMsg : e.message)
    } finally {
      if (refresh) setRechecking(false)
    }
  }

  const scheduleFollowup = async () => {
    if (!selectedId || !followupDate) {
      toast.error('Select a follow-up date')
      return
    }
    if (followupDate < minFollowupDate) {
      toast.error('Follow-up date cannot be in the past')
      return
    }
    setSchedulingFollowup(true)
    try {
      const instructions = [
        followupInstructions.trim(),
        followupTime ? `Preferred time: ${followupTime}` : '',
      ].filter(Boolean).join('\n')
      const { data } = await axios.post(
        `${backendUrl}/api/followups`,
        {
          patientId: selectedId,
          dueDate: followupDate,
          reason: 'Follow-up visit',
          instructions: instructions || undefined,
        },
        staffHeaders
      )
      if (data.success) {
        toast.success(`Follow-up scheduled for ${new Date(followupDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`)
        setShowFollowupModal(false)
        setFollowupDate('')
        setFollowupTime('')
        setFollowupInstructions('')
        await loadDetail(selectedId, { refresh: true })
        await loadList()
      } else {
        toast.error(data.message || 'Failed to schedule follow-up')
      }
    } catch (e) {
      toast.error(e.response?.data?.detail || e.message)
    } finally {
      setSchedulingFollowup(false)
    }
  }

  const markFollowupCompleted = async (finding) => {
    if (!finding?.entity_id) return
    setBusy(true)
    try {
      const { data } = await axios.patch(
        `${backendUrl}/api/followups/${finding.entity_id}`,
        { status: 'COMPLETED' },
        staffHeaders
      )
      if (data.success) {
        toast.success('Follow-up marked completed')
        await loadDetail(selectedId, { refresh: true })
        await loadList()
      } else {
        toast.error(data.message || 'Update failed')
      }
    } catch (e) {
      toast.error(e.response?.data?.detail || e.message)
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (dToken) getProfileData()
  }, [dToken])

  useEffect(() => {
    if (token) loadList()
  }, [token])

  useEffect(() => {
    if (selectedId && token) loadDetail(selectedId)
  }, [selectedId, token])

  const submitHumanReview = async (findingId, decision, comment, modifications = {}) => {
    setBusy(true)
    try {
      const { data } = await axios.post(
        `${backendUrl}/api/ai/findings/${findingId}/review`,
        { decision, note: comment, modifications },
        staffHeaders
      )
      if (data.success) {
        const hr = data.human_review || {}
        const decisionLabel = hr.decision === 'REJECTED' ? 'rejected' : hr.decision === 'MODIFIED' ? 'modified & approved' : 'approved'
        toast.success(
          data.resolved
            ? `Human review ${decisionLabel} — finding resolved`
            : `Human review ${decisionLabel} — agents re-checked`
        )
        setReviewFinding(null)
        setLastReviewResult({
          decision: hr.decision,
          comment,
          coordination: data.coordination,
          resolved: data.resolved,
        })
        setRecheckDone(true)
        setDetail(data.journey)
        await loadList()
      } else {
        toast.error(data.message || 'Review failed')
      }
    } catch (e) {
      toast.error(e.response?.data?.detail || e.message)
    } finally {
      setBusy(false)
    }
  }

  const review = async (findingId, decision, extra = {}) => {
    await submitHumanReview(findingId, decision, note, extra)
    setNote('')
    setModifyFor(null)
  }

  const journey = detail?.journey || {}
  const care = detail?.care || journey
  const careTones = detail?.care_tones || {}
  const findings = detail?.findings || []
  const recentReviews = detail?.recent_reviews || []
  const agentActivity = detail?.agent_activity || []
  const reports = detail?.reports || []
  const referrals = detail?.referrals || []
  const overall = overallStatusLabel(detail?.journey_status)
  const showCreateReferral = dToken && String(care.referral || '').toLowerCase().includes('not yet')

  return (
    <AdminPageLayout>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-black text-slate-900">AI Patient Journey</h1>
          <p className="text-xs text-slate-500 mt-1">Coordination monitoring only — AI detects and recommends; authorized staff make the final decision.</p>
        </div>
        <button
          type="button"
          disabled={!selectedId || rechecking}
          onClick={() => selectedId && loadDetail(selectedId, { refresh: true })}
          className="px-3 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold disabled:opacity-60"
        >
          {rechecking ? 'Re-checking agents…' : 'Re-check agents'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <McCard title="Patients needing attention" className="lg:col-span-4">
          {loading ? (
            <p className="text-xs text-slate-400 py-6 text-center">Loading journeys…</p>
          ) : journeys.length === 0 ? (
            <p className="text-xs text-slate-500 py-6 text-center">No accepted patients yet. Confirm a booking, then open this page.</p>
          ) : (
            <div className="space-y-2 max-h-[640px] overflow-y-auto">
              {journeys.map((j) => (
                <button
                  key={j.patient_id}
                  type="button"
                  onClick={() => setSelectedId(j.patient_id)}
                  className={`w-full text-left p-3 rounded-xl border ${selectedId === j.patient_id ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200 bg-white'}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold text-slate-800">{j.patient_name || `Patient #${j.patient_id}`}</span>
                    <Pill value={listBadge(j).label} tone={listBadge(j).tone} />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">{String(j.journey_status || '').replaceAll('_', ' ')}</p>
                </button>
              ))}
            </div>
          )}
        </McCard>

        <div className="lg:col-span-8 space-y-4">
          {!detail ? (
            <McCard title="Journey"><p className="text-xs text-slate-400">Select a patient.</p></McCard>
          ) : (
            <>
              <McCard title={`PATIENT: ${detail.patient_name || detail.patient_id}`}>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <span className={`text-sm font-black px-2 py-1 rounded-lg border ${TONE_CLS[overall.tone]}`}>
                    {overall.text}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowFollowupModal(true)}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-[11px] font-bold"
                  >
                    Schedule Follow-up
                  </button>
                </div>
                {recheckDone && (
                  <p className="text-[11px] text-emerald-700 mb-2">
                    ✓ Investigation Agent checked · ✓ Referral Agent checked · ✓ Pharmacy Agent checked · ✓ Appointment Agent checked · ✓ Follow-up Agent checked · ✓ Orchestrator recalculated
                  </p>
                )}
                {lastReviewResult && (
                  <div className={`mb-2 p-2 rounded-lg border text-[11px] ${
                    lastReviewResult.decision === 'REJECTED'
                      ? 'bg-slate-50 border-slate-200 text-slate-600'
                      : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  }`}>
                    <span className="font-black">
                      Human review {lastReviewResult.decision === 'REJECTED' ? '⚪ REJECTED' : '🟢 APPROVED'}
                    </span>
                    {lastReviewResult.comment && <span className="ml-1">— {lastReviewResult.comment}</span>}
                    {lastReviewResult.coordination?.action && lastReviewResult.coordination.action !== 'none' && (
                      <span className="block mt-0.5">Action: {String(lastReviewResult.coordination.action).replaceAll('_', ' ')}</span>
                    )}
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {PIPELINE.map(([key, label]) => (
                    <div key={key} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-slate-50 border border-slate-100">
                      <span className="text-xs font-semibold text-slate-600">{label}</span>
                      <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                        <Pill value={care[key] || journey[key]} tone={careTones[key]} stepKey={key} />
                        {key === 'referral' && showCreateReferral && (
                          <button
                            type="button"
                            onClick={() => {
                              setShowReferralModal(true)
                              setReferralSpec('ALL')
                              setReferralDoctorId('')
                              setReferralToDept('')
                            }}
                            className="px-2 py-0.5 rounded-lg bg-rose-600 text-white text-[10px] font-bold"
                          >
                            + Create Referral
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {reports.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-slate-100">
                    <h3 className="text-xs font-black uppercase tracking-wide text-slate-500 mb-2">Lab reports</h3>
                    <div className="space-y-2">
                      {reports.map((r) => (
                        <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 p-2 rounded-lg bg-white border border-slate-100 text-xs">
                          <span className="font-bold text-slate-800">{r.test_name}</span>
                          <span className="flex gap-2">
                            <button type="button" onClick={() => openReportViewer(r)} className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white font-bold">View Report</button>
                            <a href={reportLink(r.id, true)} className="px-2.5 py-1 rounded-lg bg-slate-200 text-slate-800 font-bold">Download PDF</a>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {referrals.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-slate-100">
                    <h3 className="text-xs font-black uppercase tracking-wide text-slate-500 mb-2">Specialist referrals</h3>
                    <div className="space-y-2">
                      {referrals.map((ref) => (
                        <div key={ref.id} className="p-3 rounded-xl border border-sky-100 bg-sky-50/60 text-xs">
                          <div className="flex justify-between gap-2">
                            <span className="font-bold text-slate-800">{ref.to_dept}</span>
                            <span className="font-bold text-sky-700">{String(ref.status || '').replaceAll('_', ' ')}</span>
                          </div>
                          <p className="text-slate-600 mt-1">
                            {ref.specialist_name ? `Specialist: ${ref.specialist_name}` : 'Specialist not assigned'}
                            {ref.referring_doctor_name ? ` · Referred by ${ref.referring_doctor_name}` : ''}
                          </p>
                          {ref.reason && <p className="text-slate-500 mt-0.5">{ref.reason}</p>}
                          {ref.appointment_date && (
                            <p className="text-emerald-700 font-semibold mt-1">Appointment: {ref.appointment_date}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {referrals.length === 0 && showCreateReferral && null}
              </McCard>

              <McCard title="AI Agent Activity">
                <div className="space-y-2">
                  {agentActivity.length === 0 ? (
                    <p className="text-xs text-slate-400">Run Re-check agents to refresh coordination status.</p>
                  ) : (
                    agentActivity.map((a) => (
                      <div key={a.agent} className="flex items-start gap-2 text-xs">
                        <span>{a.icon}</span>
                        <div>
                          <span className="font-bold text-slate-700 capitalize">{a.agent.replace('_', ' ')} Agent</span>
                          <p className={`mt-0.5 font-semibold ${
                            a.status === 'danger' ? 'text-rose-700' :
                            a.status === 'attention' ? 'text-rose-700' :
                            a.status === 'warn' ? 'text-amber-700' :
                            a.status === 'ok' ? 'text-emerald-700' : 'text-slate-500'
                          }`}>
                            {a.status === 'danger' ? '🔴 ' : a.status === 'attention' ? '🔴 ' : a.status === 'warn' ? '🟡 ' : a.status === 'ok' ? '🟢 ' : '⚪ '}{a.message}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </McCard>

              <McCard title="AI Findings — human review required">
                {findings.length === 0 ? (
                  <p className="text-xs text-emerald-700">No open findings. Journey is on track.</p>
                ) : (
                  <div className="space-y-3">
                    {findings.map((f) => (
                      <div key={f.id} className="p-3 rounded-xl border border-slate-200 bg-white">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className={`text-[10px] font-black uppercase ${f.priority === 'HIGH' ? 'text-rose-600' : f.priority === 'MEDIUM' ? 'text-amber-600' : 'text-sky-600'}`}>
                            {f.priority === 'HIGH' ? '🔴' : f.priority === 'MEDIUM' ? '🟠' : '🔵'} AI FINDING
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">{f.finding_type}</span>
                        </div>
                        <p className="text-sm font-bold text-slate-900 uppercase tracking-tight">
                          {String(f.finding_type || 'Coordination issue').replaceAll('_', ' ')}
                        </p>
                        <p className="text-sm text-slate-700 mt-1">{f.message}</p>
                        {f.recommended_action && (
                          <p className="text-xs text-indigo-700 mt-2 font-semibold">
                            AI recommendation: {f.recommended_action}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-2 mt-3">
                          <button
                            type="button"
                            disabled={busy}
                            className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-[11px] font-black"
                            onClick={() => setReviewFinding(f)}
                          >
                            REVIEW FINDING
                          </button>
                          {f.entity_type === 'investigation' && f.entity_id && (
                            <>
                              <button type="button" onClick={() => openReportViewer({ id: f.entity_id })} className="px-2.5 py-1 rounded-lg bg-indigo-100 text-indigo-800 text-[11px] font-bold">VIEW REPORT</button>
                              <a href={reportLink(f.entity_id, true)} className="px-2.5 py-1 rounded-lg bg-slate-200 text-slate-800 text-[11px] font-bold">DOWNLOAD PDF</a>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {recentReviews.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-slate-100">
                    <p className="text-[10px] font-black uppercase text-slate-500 mb-2">Recent human reviews</p>
                    <div className="space-y-2">
                      {recentReviews.slice(0, 4).map((r) => (
                        <div key={r.id} className="text-[11px] p-2 rounded-lg bg-slate-50 border border-slate-100">
                          <span className="font-bold">
                            {r.review_decision === 'REJECTED' ? '⚪ Rejected' : '🟢 Approved'}
                          </span>
                          {r.reviewer_name && <span className="text-slate-500"> · {r.reviewer_name}</span>}
                          <p className="text-slate-600 mt-0.5">{r.resolution_note || r.message}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </McCard>

              <McCard title="AI Summary">
                <p className="text-sm text-slate-700 leading-relaxed">{detail.summary || '—'}</p>
                {(detail.recommendations || []).length > 0 && (
                  <ol className="mt-3 list-decimal pl-5 text-xs text-slate-600 space-y-1">
                    {detail.recommendations.map((r) => <li key={r}>{r}</li>)}
                  </ol>
                )}
              </McCard>
            </>
          )}
        </div>
      </div>

      {showReferralModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setShowReferralModal(false)}>
          <div className="bg-white rounded-2xl p-5 max-w-xl w-full shadow-xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-black text-slate-900">Create Specialist Referral</h3>
            <p className="text-xs text-slate-500 mt-1">Patient: {detail?.patient_name || `#${selectedId}`}</p>

            <div className="mt-4">
              <ReferralDoctorPicker
                backendUrl={backendUrl}
                authHeaders={doctorAuthHeaders}
                excludeDoctorId={profileData?._id ?? profileData?.id}
                hospitalId={profileData?.hospitalId ?? profileData?.hospital_id}
                specialization={referralSpec}
                onSpecializationChange={(v) => {
                  setReferralSpec(v)
                  setReferralDoctorId('')
                  setReferralToDept('')
                }}
                selectedDoctorId={referralDoctorId}
                onSelectDoctor={handleSelectSpecialist}
              />
            </div>

            <label className="block mt-4 text-[11px] font-bold text-slate-500">Reason for referral *</label>
            <textarea className="w-full mt-1 border rounded-xl p-2 text-sm" rows={2} value={referralReason} onChange={(e) => setReferralReason(e.target.value)} placeholder="Specialist consultation required…" />
            <label className="block mt-3 text-[11px] font-bold text-slate-500">Priority</label>
            <select className="w-full mt-1 border rounded-xl p-2 text-sm" value={referralPriority} onChange={(e) => setReferralPriority(e.target.value)}>
              <option value="ROUTINE">Normal</option>
              <option value="URGENT">High</option>
              <option value="EMERGENCY">Urgent</option>
            </select>
            <label className="block mt-3 text-[11px] font-bold text-slate-500">Notes (optional)</label>
            <textarea className="w-full mt-1 border rounded-xl p-2 text-sm" rows={2} value={referralNotes} onChange={(e) => setReferralNotes(e.target.value)} />
            <div className="flex gap-2 mt-4">
              <button type="button" className="flex-1 px-3 py-2 rounded-xl bg-slate-100 text-xs font-bold" onClick={() => setShowReferralModal(false)}>Cancel</button>
              <button
                type="button"
                disabled={creatingReferral || !referralDoctorId || !referralReason.trim()}
                className="flex-1 px-3 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold disabled:opacity-60"
                onClick={createReferral}
              >
                {creatingReferral ? 'Creating…' : 'Create Referral'}
              </button>
            </div>
          </div>
        </div>
      )}

      {reviewFinding && (
        <HumanReviewModal
          finding={reviewFinding}
          patientName={detail?.patient_name}
          reviewerName={profileData?.name}
          journeyEvidence={detail?.evidence || []}
          busy={busy}
          onClose={() => setReviewFinding(null)}
          onSubmit={(decision, comment, mods) => submitHumanReview(reviewFinding.id, decision, comment, mods)}
        />
      )}

      {evidenceFinding && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setEvidenceFinding(null)}>
          <div className="bg-white rounded-2xl p-5 max-w-lg w-full shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-black text-slate-900 mb-3">Evidence (live MEDCLUES data)</h3>
            <pre className="text-xs bg-slate-50 border border-slate-100 rounded-xl p-3 overflow-auto max-h-80">
              {JSON.stringify(evidenceFinding.evidence || detail?.evidence || {}, null, 2)}
            </pre>
            <button type="button" className="mt-3 px-3 py-2 rounded-xl bg-slate-800 text-white text-xs font-bold" onClick={() => setEvidenceFinding(null)}>Close</button>
          </div>
        </div>
      )}

      {showFollowupModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setShowFollowupModal(false)}>
          <div className="bg-white rounded-2xl p-5 max-w-md w-full shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-black text-slate-900">Schedule Follow-up</h3>
            <p className="text-xs text-slate-500 mt-1">{detail?.patient_name || `Patient #${selectedId}`}</p>
            <label className="block mt-4 text-[11px] font-bold text-slate-500">Date *</label>
            <input type="date" min={minFollowupDate} value={followupDate} onChange={(e) => setFollowupDate(e.target.value)} className="w-full mt-1 border rounded-xl p-2 text-sm" />
            <label className="block mt-3 text-[11px] font-bold text-slate-500">Time (optional)</label>
            <input type="time" value={followupTime} onChange={(e) => setFollowupTime(e.target.value)} className="w-full mt-1 border rounded-xl p-2 text-sm" />
            <label className="block mt-3 text-[11px] font-bold text-slate-500">Instructions</label>
            <textarea value={followupInstructions} onChange={(e) => setFollowupInstructions(e.target.value)} rows={3} className="w-full mt-1 border rounded-xl p-2 text-sm" placeholder="Review test results, medication check…" />
            <div className="flex gap-2 mt-4">
              <button type="button" className="flex-1 px-3 py-2 rounded-xl bg-slate-100 text-xs font-bold" onClick={() => setShowFollowupModal(false)}>Cancel</button>
              <button type="button" disabled={schedulingFollowup} className="flex-1 px-3 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold disabled:opacity-60" onClick={scheduleFollowup}>
                {schedulingFollowup ? 'Scheduling…' : 'Schedule Follow-up'}
              </button>
            </div>
          </div>
        </div>
      )}

      {modifyFor && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setModifyFor(null)}>
          <div className="bg-white rounded-2xl p-5 max-w-lg w-full shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-black text-slate-900 mb-2">Modify coordination</h3>
            <p className="text-xs text-slate-500 mb-3">{modifyFor.message}</p>
            <label className="text-[11px] font-bold text-slate-500">Note</label>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} className="w-full mt-1 mb-3 border rounded-xl p-2 text-sm" rows={3} />
            {String(modifyFor.finding_type || '').includes('REFERRAL') && (
              <>
                <label className="text-[11px] font-bold text-slate-500">Specialist appointment</label>
                <input type="datetime-local" value={modifyDate} onChange={(e) => setModifyDate(e.target.value)} className="w-full mt-1 mb-3 border rounded-xl p-2 text-sm" />
              </>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy}
                className="px-3 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold"
                onClick={() => review(modifyFor.id, 'MODIFY', modifyDate ? { appointment_date: new Date(modifyDate).toISOString() } : {})}
              >
                Save & re-check
              </button>
              <button type="button" className="px-3 py-2 rounded-xl bg-slate-100 text-xs font-bold" onClick={() => setModifyFor(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </AdminPageLayout>
  )
}

export default DoctorPatientJourney
