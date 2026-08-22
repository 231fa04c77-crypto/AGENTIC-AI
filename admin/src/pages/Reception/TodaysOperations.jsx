import React, { useContext, useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { ReceptionContext } from '../../context/ReceptionContext'
import axios from 'axios'
import {
  PageWrap, RcHeader, Avatar, Pill, Spinner, EmptyState, RdIcon,
  patientName, doctorName, tokenLabel,
} from './components'
import { OnlineBookingsList } from './OnlineBookings'
import { useQrBookingScanner } from '../../hooks/useQrBookingScanner'
import { extractBookingId, looksLikeVisitSummaryPayload } from '../../utils/bookingId'

// ─── Shared styles ────────────────────────────────────────────────────────────
const inputCls = 'w-full px-3 py-2 rounded-rd border border-rd-border bg-rd-surface focus:border-rd-primary outline-none text-sm font-medium text-rd-text'
const btnCls   = (active) => `px-4 py-2 rounded-rd text-sm font-semibold transition-[background-color,color] duration-100 ${active ? 'rd-tab-active' : 'rd-tab-idle'}`

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtDate = (iso, fallback) => {
  if (iso) {
    const d = new Date(iso)
    if (!isNaN(d)) return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  }
  return fallback ? String(fallback).replace(/_/g, '/') : '—'
}

const fmtPayMethod = (m) => {
  const k = String(m || '').toLowerCase()
  if (!k) return '—'
  if (['razorpay', 'online', 'onlinepayment'].includes(k)) return 'Online'
  if (k === 'cash') return 'Cash'
  if (k === 'card') return 'Card'
  if (k === 'upi') return 'UPI'
  if (['payonvisit', 'pay_on_visit', 'payatdesk', 'offline'].includes(k)) return 'Pay at desk'
  return k.charAt(0).toUpperCase() + k.slice(1)
}

const isInClinicUnpaid = (a) => {
  const method = String(a.paymentMethod || a.payment_method || '').toLowerCase()
  const isPayAtDesk = ['payonvisit', 'pay_on_visit', 'payatdesk', 'offline', 'cash'].includes(method)
    || method.includes('desk') || method.includes('visit')
  return isPayAtDesk && !a.paid
}

const todayStr = () => new Date().toISOString().split('T')[0]

// ─── Badges ───────────────────────────────────────────────────────────────────
const PaidBadge = ({ paid }) => (
  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-rd-sm text-xs font-bold ${paid ? 'bg-rd-good-bg text-rd-good' : 'bg-rd-critical-bg text-rd-critical'}`}>
    <span className={`w-1.5 h-1.5 rounded-rd-sm ${paid ? 'bg-rd-good' : 'bg-rd-critical'}`} />
    {paid ? 'Paid' : 'Unpaid'}
  </span>
)

const BookingBadge = ({ cancelled }) => (
  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-rd-sm text-xs font-bold ${cancelled ? 'bg-rd-critical-bg text-rd-critical' : 'bg-rd-good-bg text-rd-good'}`}>
    {cancelled ? 'Cancelled' : 'Active'}
  </span>
)

const TypeBadge = ({ type }) => (
  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-rd-sm text-xs font-bold ${type === 'Online' ? 'bg-rd-info-bg text-rd-info' : 'bg-rd-pending-bg text-rd-pending'}`}>
    {type || '—'}
  </span>
)

const ModeBadge = ({ mode }) => {
  const k = String(mode || '').toLowerCase()
  const isVideo = k === 'video' || k.includes('online')
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-rd-sm text-xs font-bold ${isVideo ? 'bg-rd-info-bg text-rd-info' : 'bg-rd-good-bg text-rd-good'}`}>
      {isVideo ? 'Online (Video)' : 'In-clinic'}
    </span>
  )
}

// ─── Walk-In Registration Modal ────────────────────────────────────────────────
const WalkInModal = ({ onClose, onComplete }) => {
  const { getDoctors, bookWalkIn } = useContext(ReceptionContext)
  const [step, setStep]       = useState(0)
  const [busy, setBusy]       = useState(false)
  const [doctors, setDoctors] = useState([])
  const [patient, setPatient] = useState({ name: '', age: '', gender: 'Male', phone: '', email: '', address: '', complaint: '' })
  const [appt, setAppt]       = useState({ doctorId: '', slotDate: todayStr(), slotTime: '', mode: 'In-person', paymentMethod: 'cash', amount: '' })
  const [done, setDone]       = useState(null)

  useEffect(() => {
    getDoctors().then(r => { if (r?.success) setDoctors(r.doctors || []) })
  }, [])

  const doBookWalkIn = async () => {
    setBusy(true)
    const res = await bookWalkIn({ patient, ...appt })
    if (res?.success) {
      toast.success('✅ Walk-in booked successfully!')
      setDone(res)
    } else {
      toast.error(res?.message || 'Walk-in booking failed')
    }
    setBusy(false)
  }

  const steps = ['Patient Details', 'Doctor & Slot', 'Payment Details']

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4' onClick={onClose}>
      <div className='rd-panel w-full max-w-xl overflow-hidden' onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className='bg-rd-primary px-6 py-4 flex items-center justify-between text-white'>
          <h3 className='font-bold text-lg'>Walk-In Registration</h3>
          <button onClick={onClose} className='w-8 h-8 rounded-rd-sm bg-white/20 text-white flex items-center justify-center hover:bg-white/30'>✕</button>
        </div>

        <div className='p-6'>
          {done ? (
            <div className='text-center space-y-4 py-6'>
              <div className='text-5xl'>🎉</div>
              <p className='text-xl font-bold text-rd-text'>Walk-In Registered!</p>
              <div className='inline-block bg-rd-info-bg text-rd-primary font-bold text-3xl px-8 py-4 rounded-rd tracking-widest'>
                Token #{done.token || done.appointment?.token_number || '—'}
              </div>
              <p className='text-sm text-rd-muted'>Patient has been added to the queue.</p>
              <button onClick={() => { onComplete?.(); onClose(); }} className='px-6 py-2.5 bg-rd-primary text-white rounded-rd font-bold text-sm'>
                Done
              </button>
            </div>
          ) : (
            <div className='space-y-6'>
              {/* Step indicator */}
              <div className='flex items-center gap-2 overflow-x-auto pb-2 border-b border-rd-border'>
                {steps.map((s, i) => (
                  <React.Fragment key={s}>
                    <div className={`flex items-center gap-2 shrink-0 ${i <= step ? 'text-rd-primary' : 'text-rd-muted'}`}>
                      <span className={`w-6 h-6 rounded-rd-sm flex items-center justify-center text-xs font-bold ${i < step ? 'rd-tab-active' : i === step ? 'rd-tab-active' : 'bg-rd-info-bg text-rd-muted'}`}>
                        {i < step ? '✓' : i + 1}
                      </span>
                      <span className='text-xs font-bold whitespace-nowrap'>{s}</span>
                    </div>
                    {i < steps.length - 1 && <div className={`h-0.5 w-6 rounded shrink-0 ${i < step ? 'bg-rd-primary' : 'bg-rd-border'}`} />}
                  </React.Fragment>
                ))}
              </div>

              {step === 0 && (
                <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
                  <Field label='Full Name' required><input value={patient.name} onChange={e => setPatient(p => ({ ...p, name: e.target.value }))} className={inputCls} placeholder='Patient full name' /></Field>
                  <Field label='Age' required><input type='number' value={patient.age} onChange={e => setPatient(p => ({ ...p, age: e.target.value }))} className={inputCls} placeholder='Age in years' /></Field>
                  <Field label='Gender' required>
                    <select value={patient.gender} onChange={e => setPatient(p => ({ ...p, gender: e.target.value }))} className={inputCls}>
                      {['Male', 'Female', 'Other'].map(g => <option key={g}>{g}</option>)}
                    </select>
                  </Field>
                  <Field label='Phone'><input value={patient.phone} onChange={e => setPatient(p => ({ ...p, phone: e.target.value }))} className={inputCls} placeholder='+91 98765 43210' /></Field>
                  <Field label='Email'><input type='email' value={patient.email} onChange={e => setPatient(p => ({ ...p, email: e.target.value }))} className={inputCls} placeholder='Optional' /></Field>
                  <Field label='Complaint'><input value={patient.complaint} onChange={e => setPatient(p => ({ ...p, complaint: e.target.value }))} className={inputCls} placeholder='Primary complaint' /></Field>
                  <div className='sm:col-span-2 flex justify-end pt-2 border-t border-rd-border mt-2'>
                    <button onClick={() => { if (!patient.name || !patient.age) return toast.error('Name and Age are required'); setStep(1) }}
                      className='px-6 py-2.5 bg-rd-primary text-white rounded-rd font-bold text-sm'>Next →</button>
                  </div>
                </div>
              )}

              {step === 1 && (
                <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
                  <Field label='Doctor' required>
                    <select value={appt.doctorId} onChange={e => setAppt(a => ({ ...a, doctorId: e.target.value }))} className={inputCls}>
                      <option value=''>Select doctor…</option>
                      {doctors.map(d => <option key={d._id} value={d._id}>{d.name} — {d.speciality}</option>)}
                    </select>
                  </Field>
                  <Field label='Visit Type'>
                    <select value={appt.mode} onChange={e => setAppt(a => ({ ...a, mode: e.target.value }))} className={inputCls}>
                      {['In-person', 'Video'].map(m => <option key={m}>{m}</option>)}
                    </select>
                  </Field>
                  <Field label='Slot Date'><input type='date' value={appt.slotDate} onChange={e => setAppt(a => ({ ...a, slotDate: e.target.value }))} className={inputCls} /></Field>
                  <Field label='Slot Time'><input type='time' value={appt.slotTime} onChange={e => setAppt(a => ({ ...a, slotTime: e.target.value }))} className={inputCls} /></Field>
                  <div className='sm:col-span-2 flex justify-between pt-2 border-t border-rd-border mt-2'>
                    <button onClick={() => setStep(0)} className='px-5 py-2.5 bg-rd-info-bg text-rd-muted rounded-rd font-bold text-sm'>← Back</button>
                    <button onClick={() => { if (!appt.doctorId || !appt.slotDate) return toast.error('Doctor and date are required'); setStep(2) }}
                      className='px-6 py-2.5 bg-rd-primary text-white rounded-rd font-bold text-sm'>Next →</button>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
                  <Field label='Payment Method'>
                    <select value={appt.paymentMethod} onChange={e => setAppt(a => ({ ...a, paymentMethod: e.target.value }))} className={inputCls}>
                      {['cash', 'upi', 'card'].map(m => <option key={m} value={m}>{m.toUpperCase()}</option>)}
                    </select>
                  </Field>
                  <Field label='Amount Collected (₹)'><input type='number' value={appt.amount} onChange={e => setAppt(a => ({ ...a, amount: e.target.value }))} className={inputCls} placeholder='e.g. 600' /></Field>
                  <div className='sm:col-span-2 flex justify-between pt-2 border-t border-rd-border mt-2'>
                    <button onClick={() => setStep(1)} className='px-5 py-2.5 bg-rd-info-bg text-rd-muted rounded-rd font-bold text-sm'>← Back</button>
                    <button onClick={doBookWalkIn} disabled={busy} className='px-6 py-2.5 bg-rd-primary text-white rounded-rd font-bold text-sm disabled:opacity-60'>
                      {busy ? 'Booking…' : 'Book & Generate Token'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const Field = ({ label, required, children }) => (
  <div className='space-y-1.5'>
    <label className='block text-xs font-bold text-rd-muted'>
      {label}{required && <span className='text-rd-critical'> *</span>}
    </label>
    {children}
  </div>
)

// ─── Booking Detail Modal ─────────────────────────────────────────────────────
const BookingModal = ({ appt: a, onClose, onPayCollected, onSendCheckin, busy }) => {
  if (!a) return null
  const pName = patientName(a)
  const needsPayment = isInClinicUnpaid(a)
  const canCheckin = !needsPayment || a.paid

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4' onClick={onClose}>
      <div className='rd-panel w-full max-w-lg overflow-hidden' onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className='bg-rd-primary px-6 py-5 flex items-center gap-4'>
          <Avatar name={pName} src={a.userData?.image} className='w-14 h-14' />
          <div className='flex-1 min-w-0'>
            <p className='text-white font-bold text-lg truncate'>{pName}</p>
            <p className='text-white/70 text-sm'>{a.bookingId || a.publicId || `#${a._id}`}</p>
          </div>
          <button onClick={onClose} className='w-8 h-8 rounded-rd-sm bg-white/20 text-white flex items-center justify-center hover:bg-white/30'>✕</button>
        </div>

        <div className='px-6 py-5 space-y-4'>
          {/* Core info */}
          <div className='grid grid-cols-2 gap-3'>
            {[
              { label: 'Mobile',       value: a.userData?.phone || a.actualPatient?.phone || '—' },
              { label: 'Gender / Age', value: [a.userData?.gender || a.actualPatient?.gender, a.userData?.dob || a.actualPatient?.age].filter(Boolean).join(' / ') || '—' },
              { label: 'Email',        value: a.userData?.email || a.actualPatient?.email || '—', span: true },
              { label: 'Patient ID',   value: a.userData?.publicId || a.actualPatient?.publicId || '—' },
              { label: 'Doctor',       value: doctorName(a) },
              { label: 'Slot Time',    value: a.slotTime || '—' },
            ].map(({ label, value, span }) => (
              <div key={label} className={`${span ? 'col-span-2' : ''} bg-rd-canvas rounded-rd px-4 py-3`}>
                <p className='text-[10px] font-bold uppercase tracking-wider text-rd-muted mb-1'>{label}</p>
                <p className='text-sm font-semibold text-rd-text truncate'>{value}</p>
              </div>
            ))}
          </div>

          {/* Booking info */}
          <div className='border-t border-rd-border pt-4'>
            <p className='text-[10px] font-bold uppercase tracking-wider text-rd-muted mb-3'>Booking Info</p>
            <div className='grid grid-cols-2 gap-3'>
              <div className='bg-rd-canvas rounded-rd px-4 py-3'>
                <p className='text-[10px] font-bold uppercase tracking-wider text-rd-muted mb-1'>Booking Type</p>
                <TypeBadge type={a.type} />
              </div>
              <div className='bg-rd-canvas rounded-rd px-4 py-3'>
                <p className='text-[10px] font-bold uppercase tracking-wider text-rd-muted mb-1'>Payment Mode</p>
                <ModeBadge mode={a.mode} />
              </div>
              <div className='bg-rd-canvas rounded-rd px-4 py-3'>
                <p className='text-[10px] font-bold uppercase tracking-wider text-rd-muted mb-1'>Payment</p>
                <p className='text-sm font-semibold text-rd-text'>{fmtPayMethod(a.paymentMethod)}</p>
              </div>
              <div className='bg-rd-canvas rounded-rd px-4 py-3'>
                <p className='text-[10px] font-bold uppercase tracking-wider text-rd-muted mb-1'>Paid</p>
                <PaidBadge paid={a.paid} />
              </div>
              <div className='bg-rd-canvas rounded-rd px-4 py-3 col-span-2'>
                <p className='text-[10px] font-bold uppercase tracking-wider text-rd-muted mb-1'>Booking</p>
                <BookingBadge cancelled={a.cancelled} />
              </div>
            </div>
          </div>

          {/* Payment gate for in-clinic */}
          {needsPayment && !a.paid && (
            <div className='bg-rd-pending-bg border border-rd-pending rounded-rd p-4'>
              <p className='text-sm font-bold text-amber-800 mb-1'>⚠️ In-Clinic Payment Required</p>
              <p className='text-xs text-rd-pending mb-3'>Collect payment from patient before sending to Check-In.</p>
              <button
                onClick={() => onPayCollected(a._id)}
                disabled={busy}
                className='w-full py-2.5 bg-rd-pending hover:opacity-90 text-white rounded-rd font-bold text-sm disabled:opacity-60 transition-colors'
              >
                {busy ? 'Collecting…' : '✅ Mark Payment Collected'}
              </button>
            </div>
          )}

          {/* Send to Check-In */}
          <button
            onClick={() => onSendCheckin(a._id)}
            disabled={!canCheckin || busy}
            className='w-full py-3 bg-rd-primary hover:bg-rd-primary-hover text-white rounded-rd font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed transition-colors'
          >
            {canCheckin ? '🚀 Send to Check-In' : '🔒 Collect Payment First'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Today's Ops Tab ──────────────────────────────────────────────────────────
const TodaysOpsTab = ({ onSwitchToCheckin }) => {
  const { getOnlineBookings, collectPayment, generateToken } = useContext(ReceptionContext)
  const [rows, setRows]     = useState([])
  const [loading, setLoading] = useState(true)
  const [viewing, setViewing] = useState(null)
  const [busy, setBusy]     = useState(false)
  const [query, setQuery]   = useState('')
  const [showWalkin, setShowWalkin] = useState(false)

  const load = async () => {
    const res = await getOnlineBookings(todayStr())
    if (res?.success) setRows(res.appointments || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const today = todayStr()
  const todayRows = useMemo(() => {
    const base = rows.filter(r => {
      const d = r.slotDate || r.date || ''
      return !d || d.includes(today.split('-').reverse().join('_')) || d.includes(today)
    })
    if (!query.trim()) return base
    const q = query.toLowerCase()
    return base.filter(r => {
      const pn = patientName(r).toLowerCase()
      const dn = doctorName(r).toLowerCase()
      const id = (r.bookingId || r.publicId || '').toLowerCase()
      return pn.includes(q) || dn.includes(q) || id.includes(q)
    })
  }, [rows, query, today])

  const handlePayCollected = async (id) => {
    setBusy(true)
    const res = await collectPayment(id, 'cash')
    if (res?.success) {
      toast.success('✅ Payment collected!')
      await load()
      setViewing(prev => prev ? { ...prev, paid: true } : null)
    }
    setBusy(false)
  }

  const handleSendCheckin = async (id) => {
    setBusy(true)
    const res = await generateToken(id)
    if (res?.success) {
      toast.success('✅ Patient sent to Check-In!')
      setViewing(null)
      await load()
      onSwitchToCheckin?.()
    } else {
      toast.error(res?.message || 'Failed to send to check-in')
    }
    setBusy(false)
  }

  return (
    <div className='space-y-4'>
      {/* Search & Actions toolbar */}
      <div className='flex items-center justify-between gap-3 flex-wrap rd-panel p-4'>
        <div className='relative w-full sm:w-72'>
          <svg className='w-4 h-4 text-rd-muted absolute left-3 top-1/2 -translate-y-1/2' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z' /></svg>
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder='Search patient, doctor or booking ID'
            className='w-full pl-9 pr-3 py-2 rounded-rd border border-rd-border bg-rd-canvas focus:bg-rd-surface focus:border-rd-primary outline-none text-sm' />
        </div>
        <div className='flex items-center gap-2'>
          <button onClick={load} className='px-4 py-2 bg-rd-surface border border-rd-border rounded-rd text-sm font-bold text-rd-muted hover:bg-rd-canvas transition-colors'>↻ Refresh</button>
          <button onClick={() => setShowWalkin(true)} className='px-4 py-2 bg-rd-good hover:opacity-90 text-white rounded-rd text-sm font-bold transition-colors'>
            ➕ Walk-In Registration
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className='grid grid-cols-3 gap-3'>
        {[
          { label: "Today's Bookings", value: todayRows.length, accent: 'bg-rd-info', bg: 'bg-rd-info-bg' },
          { label: 'Paid', value: todayRows.filter(r => r.paid).length, accent: 'bg-rd-good', bg: 'bg-rd-good-bg' },
          { label: 'Pending Payment', value: todayRows.filter(r => isInClinicUnpaid(r)).length, accent: 'bg-rd-pending', bg: 'bg-rd-pending-bg' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-rd p-3 flex items-center gap-3`}>
            <span className={`w-2.5 h-2.5 rounded-rd-sm ${s.accent} shrink-0`} />
            <div>
              <p className='text-lg font-bold text-rd-text'>{s.value}</p>
              <p className='text-[11px] font-semibold text-rd-muted leading-tight'>{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className='rd-panel overflow-hidden'>
        {loading ? <Spinner /> : todayRows.length === 0 ? (
          <EmptyState title="No bookings today" sub="Online bookings for today will appear here." />
        ) : (
          <div className='overflow-x-auto'>
            <table className='w-full text-sm border-collapse'>
              <thead>
                <tr className='text-left text-[11px] uppercase tracking-wider text-rd-muted border-b border-rd-border bg-rd-canvas/60'>
                  <th className='px-4 py-3 font-bold w-10'>#</th>
                  <th className='px-4 py-3 font-bold'>Patient</th>
                  <th className='px-4 py-3 font-bold'>Last Visit</th>
                  <th className='px-4 py-3 font-bold text-center'>View</th>
                </tr>
              </thead>
              <tbody>
                {todayRows.map((a, idx) => {
                  const pn = patientName(a)
                  const lastVisit = a.userData?.lastVisit || a.slotDate || ''
                  return (
                    <tr key={a._id} className='border-b border-rd-border  transition-colors'>
                      <td className='px-4 py-3 text-xs font-bold text-rd-muted tabular-nums'>{idx + 1}</td>
                      <td className='px-4 py-3'>
                        <div className='flex items-center gap-2'>
                          <Avatar name={pn} src={a.userData?.image} />
                          <div>
                            <p className='font-semibold text-rd-text'>{pn}</p>
                            <p className='text-xs text-rd-muted'>{a.slotTime || '—'} · {doctorName(a)}</p>
                          </div>
                        </div>
                      </td>
                      <td className='px-4 py-3 text-xs text-rd-muted whitespace-nowrap'>{fmtDate(lastVisit)}</td>
                      <td className='px-4 py-3 text-center'>
                        <button
                          onClick={() => setViewing(a)}
                          className='inline-flex items-center gap-1.5 px-3 py-1.5 rounded-rd bg-rd-info-bg text-rd-primary hover:bg-rd-primary hover:text-white text-xs font-bold transition-all'
                        >
                          <svg className='w-3.5 h-3.5' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M15 12a3 3 0 11-6 0 3 3 0 016 0z'/><path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z'/></svg>
                          View
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail modal */}
      {viewing && (
        <BookingModal
          appt={viewing}
          onClose={() => setViewing(null)}
          onPayCollected={handlePayCollected}
          onSendCheckin={handleSendCheckin}
          busy={busy}
        />
      )}

      {/* Walk-in Registration Modal */}
      {showWalkin && (
        <WalkInModal
          onClose={() => setShowWalkin(false)}
          onComplete={load}
        />
      )}
    </div>
  )
}

// ─── Check-In Tab ─────────────────────────────────────────────────────────────
const CheckInTab = ({ doctorSessionActive }) => {
  const { checkIn, searchPatients, getQueue } = useContext(ReceptionContext)
  const navigate = useNavigate()
  const [bookingId, setBookingId] = useState('')
  const [busy, setBusy]           = useState(false)
  const [query, setQuery]         = useState('')
  const [results, setResults]     = useState([])
  const [queuePatients, setQueuePatients] = useState([])
  const [queueLoading, setQueueLoading]   = useState(true)
  const [lastSuccess, setLastSuccess] = useState(null)

  // Load checked-in queue patients
  const loadQueue = async () => {
    setQueueLoading(true)
    const res = await getQueue()
    if (res?.success && res.groups) {
      // Patients who are verified / checked-in and ready for queue
      const checkedInList = [
        ...(res.groups.waiting || []),
        ...(res.groups.ready || [])
      ]
      setQueuePatients(checkedInList)
    }
    setQueueLoading(false)
  }

  useEffect(() => {
    if (doctorSessionActive) {
      loadQueue()
      const t = setInterval(loadQueue, 15_000)
      return () => clearInterval(t)
    }
  }, [doctorSessionActive])

  const doCheckIn = useCallback(async (id, rawScan) => {
    const raw = rawScan || id || bookingId
    if (looksLikeVisitSummaryPayload(raw)) {
      return toast.error('This is a visit-summary QR, not a check-in booking code. Ask for the Scan at reception QR (BK…).')
    }
    const code = extractBookingId(raw)
    if (!code) {
      return toast.error('Enter a valid Booking ID (e.g. BK8X4P2Q)')
    }
    setBusy(true)
    const res = await checkIn(code)
    if (res?.success) {
      toast.success(res.message || 'Checked in successfully!')
      setLastSuccess({
        bookingId: res.bookingId || code,
        name: res.patientName || 'Patient',
        doctorName: res.doctorName,
        tokenNumber: res.tokenNumber,
        visitNumber: res.visitNumber,
        maxVisits: res.maxVisits,
      })
      setBookingId('')
      loadQueue()
    } else {
      toast.error(res?.message || 'Check-in failed')
    }
    setBusy(false)
  }, [bookingId, checkIn])

  const onScan = useCallback((code, raw) => {
    if (busy) return
    setBookingId(code || String(raw || '').trim())
    void doCheckIn(code, raw)
  }, [busy, doCheckIn])

  const { videoRef, camOn, toggleCam } = useQrBookingScanner({
    enabled: doctorSessionActive,
    onCode: onScan,
  })

  const handleToggleCam = async () => {
    const ok = await toggleCam()
    if (ok === false && !camOn) {
      toast.error('Could not access camera. Enter the Booking ID manually.')
    }
  }

  const doSearch = async (q) => {
    setQuery(q)
    if (q.trim().length < 2) { setResults([]); return }
    const res = await searchPatients(q)
    setResults(res?.patients || [])
  }

  if (!doctorSessionActive) {
    return (
      <div className='rd-panel p-8 text-center space-y-4'>
        <div className='w-16 h-16 bg-rd-info-bg rounded-rd-sm flex items-center justify-center mx-auto'>
          <svg className='w-8 h-8 text-rd-muted' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth={1.5} d='M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z'/></svg>
        </div>
        <p className='text-xl font-bold text-rd-text'>Check-In Locked</p>
        <p className='text-sm text-rd-muted max-w-sm mx-auto'>
          The doctor must start their session from the <strong>Queue Operations</strong> tab in the Doctor Panel before patients can be checked in.
        </p>
        <div className='inline-flex items-center gap-2 px-4 py-2 bg-rd-pending-bg border border-rd-pending rounded-rd text-rd-pending text-sm font-semibold'>
          <span className='w-2 h-2 rounded-rd-sm bg-rd-pending ' />
          Waiting for doctor to start session…
        </div>
      </div>
    )
  }

  return (
    <div className='grid grid-cols-1 lg:grid-cols-2 gap-6 items-start'>
      {/* ── Left Side: QR SCANNER & MANUAL SEARCH ── */}
      <div className='space-y-6'>
        {/* Card 1: Scanner & Manual ID */}
        <div className='rd-panel p-5 space-y-4'>
          <div className='flex items-center justify-between'>
            <h3 className='text-sm font-bold text-rd-text uppercase tracking-wider'>Scan booking QR</h3>
            <button type='button' onClick={handleToggleCam} className='flex items-center gap-2 text-xs font-bold text-rd-primary hover:underline'>
              <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z'/><path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M15 13a3 3 0 11-6 0 3 3 0 016 0'/></svg>
              {camOn ? 'Close Camera' : 'Open Camera'}
            </button>
          </div>

          <div className='flex gap-3'>
            <input value={bookingId} onChange={e => setBookingId(e.target.value)} onKeyDown={e => e.key === 'Enter' && doCheckIn()}
              placeholder='BK8X4P2Q' className={inputCls} autoComplete='off' />
            <button type='button' onClick={() => doCheckIn()} disabled={busy}
              className='px-5 py-2.5 bg-rd-primary text-white rounded-rd font-bold text-sm hover:bg-rd-primary-hover transition-colors disabled:opacity-60 shrink-0'>
              {busy ? '…' : 'Check In'}
            </button>
          </div>

          {camOn && (
            <div className='relative'>
              <video ref={videoRef} autoPlay playsInline muted className='w-full rounded-rd border border-rd-border max-h-64 object-cover' />
              <p className='text-[11px] text-rd-muted mt-2'>Point at the patient booking QR — check-in runs automatically</p>
            </div>
          )}

          {lastSuccess && (
            <div className='rounded-rd border border-emerald-200 bg-emerald-50/70 px-4 py-3 text-sm'>
              <p className='font-bold text-emerald-800'>Checked in · {lastSuccess.name}</p>
              <p className='text-xs text-rd-muted font-mono mt-1'>{lastSuccess.bookingId}</p>
              {lastSuccess.tokenNumber != null && lastSuccess.tokenNumber !== '' && (
                <p className='text-xs text-rd-muted mt-1'>Token #{lastSuccess.tokenNumber}</p>
              )}
            </div>
          )}
        </div>

        {/* Card 2: Manual Patient Search */}
        <div className='rd-panel p-5 space-y-3'>
          <h3 className='text-sm font-bold text-rd-text uppercase tracking-wider'>Quick Patient Search</h3>
          <input value={query} onChange={e => doSearch(e.target.value)} placeholder='Search patient name or mobile…' className={inputCls} />
          {results.length > 0 && (
            <div className='space-y-2 pt-2 border-t border-rd-border max-h-64 overflow-y-auto'>
              {results.map(p => (
                <div key={p._id} className='flex items-center justify-between bg-rd-canvas rounded-rd px-4 py-3 hover:bg-rd-info-bg transition-colors'>
                  <div className='flex items-center gap-3'>
                    <Avatar name={p.name} src={p.image} className='w-8 h-8' />
                    <div>
                      <p className='text-sm font-bold text-rd-text'>{p.name}</p>
                      <p className='text-xs text-rd-muted'>{p.phone || p.email}</p>
                    </div>
                  </div>
                  <button type='button' onClick={() => navigate('/reception-today', { state: { tab: 'ops' } })}
                    className='text-xs font-bold text-rd-primary hover:underline'>View Bookings →</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Right Side: PATIENTS TABLE READY FOR QUEUE ── */}
      <div className='rd-panel p-5 space-y-4'>
        <div className='flex items-center justify-between'>
          <div>
            <h3 className='text-sm font-bold text-rd-text uppercase tracking-wider'>Queue Status (Ready for Doctor)</h3>
            <p className='text-xs text-rd-muted mt-0.5'>Patients waiting to see the doctor</p>
          </div>
          <button onClick={loadQueue} className='p-2 bg-rd-canvas hover:bg-rd-info-bg border border-rd-border rounded-rd text-rd-muted text-xs font-bold transition-all'>↻ Refresh</button>
        </div>

        {queueLoading ? (
          <Spinner />
        ) : queuePatients.length === 0 ? (
          <div className='text-center py-10 space-y-2'>
            <div className='w-12 h-12 rounded-rd-sm bg-rd-canvas flex items-center justify-center mx-auto text-xl'>📋</div>
            <p className='text-xs font-bold text-rd-muted'>No patients checked-in today yet</p>
            <p className='text-[11px] text-rd-muted max-w-[200px] mx-auto'>Checked-in patients will appear here before moving to the doctor.</p>
          </div>
        ) : (
          <div className='overflow-x-auto border border-rd-border rounded-rd'>
            <table className='w-full text-xs text-left'>
              <thead>
                <tr className='bg-rd-canvas border-b border-rd-border text-rd-muted uppercase tracking-wider font-bold text-[10px]'>
                  <th className='px-3 py-2.5 w-10'>Token</th>
                  <th className='px-3 py-2.5'>Patient</th>
                  <th className='px-3 py-2.5'>Doctor</th>
                  <th className='px-3 py-2.5'>Status</th>
                </tr>
              </thead>
              <tbody className='divide-y divide-rd-border'>
                {queuePatients.map(apt => (
                  <tr key={apt._id} className='hover:bg-rd-canvas/50 transition-colors'>
                    <td className='px-3 py-2.5 font-mono font-bold text-rd-primary text-xs'>#{apt.token_number || '—'}</td>
                    <td className='px-3 py-2.5'>
                      <div className='font-semibold text-rd-text truncate max-w-[120px]'>{patientName(apt)}</div>
                      <div className='text-[10px] text-rd-muted'>{apt.slotTime || '—'}</div>
                    </td>
                    <td className='px-3 py-2.5 text-rd-muted truncate max-w-[100px]'>{doctorName(apt)}</td>
                    <td className='px-3 py-2.5'>
                      <Pill status={apt.lifecycle_status || apt.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Queue Tab ────────────────────────────────────────────────────────────────
const QueueTab = () => {
  const { getQueue, queueAction, getDoctors } = useContext(ReceptionContext)
  const navigate = useNavigate()
  const [groups, setGroups]       = useState({})
  const [loading, setLoading]     = useState(true)
  const [tab, setTab]             = useState('waiting')
  const [doctors, setDoctors]     = useState([])
  const [docFilter, setDocFilter] = useState('')
  const [busy, setBusy]           = useState(null)

  const load = async () => {
    setLoading(true)
    const res = await getQueue(docFilter || undefined)
    if (res?.success) setGroups(res.groups || {})
    setLoading(false)
  }

  useEffect(() => { load() }, [docFilter])
  useEffect(() => { getDoctors().then(r => { if (r?.success) setDoctors(r.doctors || []) }) }, [])
  useEffect(() => { const t = setInterval(load, 30_000); return () => clearInterval(t) }, [docFilter])

  const act = async (id, action) => {
    setBusy(id)
    const res = await queueAction(id, action)
    if (res?.success) await load()
    else toast.error(res?.message || 'Action failed')
    setBusy(null)
  }

  const rows = groups[tab] || []

  return (
    <div className='space-y-4'>
      <div className='flex items-center gap-3 flex-wrap rd-panel p-4'>
        <select value={docFilter} onChange={e => setDocFilter(e.target.value)}
          className='px-3 py-2 rounded-rd bg-rd-canvas border border-rd-border text-sm font-semibold text-rd-muted outline-none'>
          <option value=''>All Doctors</option>
          {doctors.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
        </select>
        <button onClick={load} className='px-4 py-2 bg-rd-surface border border-rd-border rounded-rd text-sm font-bold text-rd-muted hover:bg-rd-canvas'>↻ Refresh</button>
      </div>

      <div className='flex items-center gap-2 flex-wrap'>
        {QUEUE_TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-rd text-sm font-bold transition-all ${tab === t.id ? 'rd-tab-active' : 'rd-tab-idle'}`}>
            {t.label} <span className='opacity-70'>({(groups[t.id] || []).length})</span>
          </button>
        ))}
      </div>

      {loading ? <Spinner /> : rows.length === 0 ? (
        <EmptyState title='No patients in this queue right now.' />
      ) : (
        <div className='space-y-3'>
          {rows.map(apt => (
            <div key={apt._id} className='rd-panel p-4 flex items-center gap-4 flex-wrap'>
              <div className='text-2xl font-bold text-rd-primary w-12 text-center shrink-0'>#{apt.token_number ?? '—'}</div>
              <Avatar name={patientName(apt)} />
              <div className='flex-1 min-w-0'>
                <p className='font-bold text-rd-text truncate'>{patientName(apt)}</p>
                <p className='text-xs text-rd-muted truncate'>Dr. {doctorName(apt)} · {apt.slotTime || apt.slot_time || '—'}</p>
              </div>
              <Pill status={apt.lifecycle_status || apt.status} />
              <div className='flex gap-2 flex-wrap'>
                {tab === 'waiting' && <button onClick={() => act(apt._id, 'call')} disabled={busy === apt._id}
                  className='px-3 py-1.5 bg-rd-info text-white rounded-rd text-xs font-bold disabled:opacity-60'>Call</button>}
                {(tab === 'waiting' || tab === 'ready') && <button onClick={() => act(apt._id, 'skip')} disabled={busy === apt._id}
                  className='px-3 py-1.5 bg-rd-pending text-white rounded-rd text-xs font-bold disabled:opacity-60'>Skip</button>}
                {tab === 'inConsultation' && <button onClick={() => navigate(`/reception-summary/${apt._id}`)}
                  className='px-3 py-1.5 bg-green-500 text-white rounded-rd text-xs font-bold'>Summary</button>}
                {tab === 'waiting' && <button onClick={() => act(apt._id, 'noshow')} disabled={busy === apt._id}
                  className='px-3 py-1.5 bg-rd-border text-rd-text rounded-rd text-xs font-bold disabled:opacity-60'>No-Show</button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main Tabs ────────────────────────────────────────────────────────────────
const MAIN_TABS = [
  { id: 'ops',      label: "Today's Ops",   icon: 'calendar' },
  { id: 'bookings', label: 'Appointments',  icon: 'clipboard' },
  { id: 'checkin',  label: 'Check-In',      icon: 'badge' },
  { id: 'queue',    label: "Today's Queue", icon: 'clipboard' },
]

const TodaysOperations = ({ defaultTab }) => {
  const { backendUrl, recToken } = useContext(ReceptionContext)
  const location = useLocation()
  const initial = defaultTab || location.state?.tab || 'ops'
  const [activeTab, setActiveTab]         = useState(initial)
  const [doctorSessionActive, setDoctorSessionActive] = useState(false)

  const pollDoctorSession = useCallback(async () => {
    if (!recToken) return
    try {
      const { data: eventData } = await axios.get(`${backendUrl}/api/reception/doctor-status-events`, {
        headers: { rectoken: recToken },
        timeout: 8000,
      })
      const events = eventData?.events || []
      let isActive = Array.isArray(events) && events.some(e => {
        const s = String(e.status || '').toLowerCase()
        return s.includes('clinic') || s.includes('consult') || s.includes('available') || e.isActive === true
      })

      if (!isActive) {
        const { data: docData } = await axios.get(`${backendUrl}/api/reception/doctors`, {
          headers: { rectoken: recToken },
          timeout: 8000,
        })
        const docs = docData?.doctors || []
        isActive = Array.isArray(docs) && docs.some(d => {
          const s = String(d.status || '').toLowerCase()
          return s.includes('clinic') || s.includes('consult') || s.includes('available')
        })
      }

      setDoctorSessionActive(isActive)
    } catch {
      setDoctorSessionActive(true)
    }
  }, [backendUrl, recToken])

  useEffect(() => {
    pollDoctorSession()
    const t = setInterval(pollDoctorSession, 8_000)
    return () => clearInterval(t)
  }, [pollDoctorSession])

  return (
    <PageWrap>
      <RcHeader
        title="Today's Operations"
        subtitle='Manage today bookings, check-in patients, and monitor the live queue'
      />

      <div className='flex gap-2 mb-5 overflow-x-auto'>
        {MAIN_TABS.map(t => (
          <button
            key={t.id}
            type='button'
            onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-rd font-semibold text-sm shrink-0 ${
              activeTab === t.id ? 'rd-tab-active' : 'rd-tab-idle'
            }`}
          >
            <RdIcon name={t.icon} className='w-4 h-4' />
            <span>{t.label}</span>
            {t.id === 'checkin' && !doctorSessionActive && (
              <span className='w-2 h-2 rounded-rd-sm bg-rd-pending ml-0.5' title='Locked — doctor not started' />
            )}
          </button>
        ))}
      </div>

      {activeTab === 'ops'      && <TodaysOpsTab onSwitchToCheckin={() => setActiveTab('checkin')} />}
      {activeTab === 'bookings' && <OnlineBookingsList showHeader={false} />}
      {activeTab === 'checkin'  && <CheckInTab doctorSessionActive={doctorSessionActive} />}
      {activeTab === 'queue'    && <QueueTab />}
    </PageWrap>
  )
}

const QUEUE_TABS = [
  { id: 'waiting',        label: 'Waiting' },
  { id: 'ready',          label: 'Ready' },
  { id: 'inConsultation', label: 'In Consultation' },
  { id: 'completed',      label: 'Completed' },
]

export default TodaysOperations
