import React, { useMemo, useState } from 'react'

const PRIORITY_LABEL = {
  HIGH: { text: '🔴 HIGH', cls: 'text-rose-600 bg-rose-50 border-rose-200' },
  MEDIUM: { text: '🟠 MEDIUM', cls: 'text-amber-700 bg-amber-50 border-amber-200' },
  LOW: { text: '🔵 LOW', cls: 'text-sky-700 bg-sky-50 border-sky-200' },
}

const formatFindingTitle = (finding) => {
  const t = String(finding?.finding_type || '').replaceAll('_', ' ')
  if (t) return t
  return String(finding?.message || 'Coordination issue').slice(0, 80)
}

const evidenceRows = (finding, journeyEvidence = []) => {
  const ev = finding?.evidence && typeof finding.evidence === 'object' ? finding.evidence : {}
  const rows = []

  const push = (label, value, ok) => {
    if (value == null || value === '') return
    rows.push({ label, value: String(value), ok })
  }

  push('Referral created', ev.created || ev.referral_created, true)
  push('Specialist', ev.specialist, Boolean(ev.specialist && ev.specialist !== 'Not assigned'))
  push('Referral status', ev.status, ev.status && String(ev.status).toLowerCase().includes('accept'))
  push('Specialist appointment', ev.appointment, ev.appointment && !String(ev.appointment).toLowerCase().includes('not'))
  push('Follow-up', ev.followup || ev.due_date, true)
  push('Investigation', ev.test_name || ev.investigation, true)
  push('Report', ev.report, ev.report && String(ev.report).toLowerCase() !== 'not available')

  if (rows.length === 0 && journeyEvidence.length > 0) {
    journeyEvidence.forEach((block) => {
      Object.entries(block || {}).forEach(([k, v]) => {
        if (k === 'type' || v == null || v === '') return
        push(k.replaceAll('_', ' '), v, true)
      })
    })
  }

  if (rows.length === 0) {
    Object.entries(ev).forEach(([k, v]) => {
      if (v == null || v === '') return
      push(k.replaceAll('_', ' '), v, true)
    })
  }

  return rows
}

const HumanReviewModal = ({
  finding,
  patientName,
  reviewerName,
  journeyEvidence,
  busy,
  onClose,
  onSubmit,
}) => {
  const [decision, setDecision] = useState('')
  const [comment, setComment] = useState('')
  const [appointmentDate, setAppointmentDate] = useState('')

  const priority = PRIORITY_LABEL[finding?.priority] || PRIORITY_LABEL.MEDIUM
  const rows = useMemo(() => evidenceRows(finding, journeyEvidence), [finding, journeyEvidence])
  const isReferralAppt = String(finding?.finding_type || '').includes('REFERRAL')
  const isReportReview = finding?.finding_type === 'REPORT_REVIEW_PENDING'

  const handleSubmit = () => {
    if (!decision) return
    const mods = {}
    if (decision === 'APPROVE' && isReferralAppt && appointmentDate) {
      mods.appointment_date = new Date(appointmentDate).toISOString()
    }
    if (decision === 'MODIFY' && appointmentDate) {
      mods.appointment_date = new Date(appointmentDate).toISOString()
    }
    onSubmit(decision, comment.trim(), mods)
  }

  if (!finding) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl p-5 max-w-lg w-full shadow-xl max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-[10px] font-black uppercase tracking-wide text-indigo-600">Human review — coordination only</p>
        <h3 className="font-black text-slate-900 text-lg mt-1">AI Coordination Recommendation</h3>

        <div className="mt-3 p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs space-y-1">
          <p><span className="font-bold text-slate-500">Patient:</span> {patientName || '—'}</p>
          <p><span className="font-bold text-slate-500">Issue:</span> {formatFindingTitle(finding)}</p>
          <p>
            <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-black border ${priority.cls}`}>
              {priority.text}
            </span>
          </p>
        </div>

        <div className="mt-4">
          <p className="text-[10px] font-black uppercase text-slate-500 mb-1">AI explanation</p>
          <p className="text-sm text-slate-800 leading-relaxed">{finding.message}</p>
        </div>

        {finding.recommended_action && (
          <div className="mt-3 p-3 rounded-xl bg-indigo-50 border border-indigo-100">
            <p className="text-[10px] font-black uppercase text-indigo-600">AI recommendation</p>
            <p className="text-sm font-semibold text-indigo-900 mt-1">{finding.recommended_action}</p>
          </div>
        )}

        <div className="mt-4">
          <p className="text-[10px] font-black uppercase text-slate-500 mb-2">Evidence (live database)</p>
          <ul className="space-y-1.5 text-xs">
            {rows.map((r) => (
              <li key={r.label} className="flex items-start gap-2">
                <span>{r.ok ? '✓' : '✗'}</span>
                <span>
                  <span className="font-bold text-slate-600">{r.label}:</span> {r.value}
                </span>
              </li>
            ))}
            {rows.length === 0 && (
              <li className="text-slate-400">No structured evidence — see journey data.</li>
            )}
          </ul>
        </div>

        <div className="mt-5 pt-4 border-t border-slate-100">
          <p className="text-[10px] font-black uppercase text-slate-500 mb-2">Your decision</p>
          <p className="text-[11px] text-slate-500 mb-3">
            AI recommends coordination actions only. You approve or reject — no diagnosis or treatment changes.
            {reviewerName ? ` Reviewer: ${reviewerName}` : ''}
          </p>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => setDecision('APPROVE')}
              className={`px-4 py-2 rounded-xl text-xs font-black border ${
                decision === 'APPROVE'
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-white text-emerald-800 border-emerald-300 hover:bg-emerald-50'
              }`}
            >
              Approve
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setDecision('REJECT')}
              className={`px-4 py-2 rounded-xl text-xs font-black border ${
                decision === 'REJECT'
                  ? 'bg-rose-600 text-white border-rose-600'
                  : 'bg-white text-rose-800 border-rose-300 hover:bg-rose-50'
              }`}
            >
              Reject
            </button>
            {isReferralAppt && (
              <button
                type="button"
                disabled={busy}
                onClick={() => setDecision('MODIFY')}
                className={`px-4 py-2 rounded-xl text-xs font-black border ${
                  decision === 'MODIFY'
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-indigo-800 border-indigo-300 hover:bg-indigo-50'
                }`}
              >
                Modify &amp; schedule
              </button>
            )}
          </div>

          {(decision === 'APPROVE' || decision === 'MODIFY') && isReferralAppt && (
            <div className="mt-3">
              <label className="text-[11px] font-bold text-slate-500">
                Specialist appointment (optional — leave blank to notify patient/specialist only)
              </label>
              <input
                type="datetime-local"
                value={appointmentDate}
                onChange={(e) => setAppointmentDate(e.target.value)}
                className="w-full mt-1 border rounded-xl p-2 text-sm"
              />
            </div>
          )}

          {decision === 'APPROVE' && isReportReview && (
            <p className="mt-2 text-[11px] text-emerald-700 font-semibold">
              Approving will mark the lab report as reviewed using the existing investigation workflow.
            </p>
          )}

          <label className="block mt-4 text-[11px] font-bold text-slate-500">Comment (optional)</label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={2}
            placeholder={
              decision === 'REJECT'
                ? 'e.g. Appointment is not required at this time.'
                : 'e.g. Coordinate specialist appointment before follow-up.'
            }
            className="w-full mt-1 border rounded-xl p-2 text-sm"
          />

          <div className="flex gap-2 mt-4">
            <button
              type="button"
              className="flex-1 px-3 py-2 rounded-xl bg-slate-100 text-xs font-bold"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={busy || !decision}
              onClick={handleSubmit}
              className="flex-1 px-3 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold disabled:opacity-50"
            >
              {busy ? 'Submitting…' : 'Submit review'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default HumanReviewModal
