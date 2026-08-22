import React, { useContext, useEffect, useMemo, useState } from 'react'
import { ReceptionContext } from '../../context/ReceptionContext'
import { PageWrap, RcHeader, Avatar, EmptyState, Spinner, ReceptionTabs, RECEPTION_TAB_GROUPS, RdIcon } from './components'
import { ExportMenu } from '../../components/mc'

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

// ─── Badges ───────────────────────────────────────────────────────────────────
const PaidBadge = ({ paid }) => (
  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-rd-sm text-xs font-bold ${paid ? 'bg-rd-good-bg text-rd-good' : 'bg-rd-critical-bg text-rd-critical'}`}>
    <span className={`w-1.5 h-1.5 rounded-rd-sm ${paid ? 'bg-rd-good' : 'bg-rd-critical'}`} />
    {paid ? 'Paid' : 'Unpaid'}
  </span>
)

const BookingBadge = ({ cancelled }) => (
  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-rd-sm text-xs font-bold ${cancelled ? 'bg-rd-critical-bg text-rd-critical' : 'bg-rd-good-bg text-rd-good'}`}>
    <span className={`w-1.5 h-1.5 rounded-rd-sm ${cancelled ? 'bg-rd-critical' : 'bg-rd-good'}`} />
    {cancelled ? 'Cancelled' : 'Active'}
  </span>
)

const ModeBadge = ({ mode }) => {
  const k = String(mode || '').toLowerCase()
  if (!k) return <span className='text-rd-muted'>—</span>
  const isVideo = k === 'video' || k.includes('online')
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-rd-sm text-xs font-bold ${isVideo ? 'bg-rd-info-bg text-rd-info' : 'bg-rd-good-bg text-rd-good'}`}>
      {isVideo ? 'Online (Video)' : 'In-clinic'}
    </span>
  )
}

const TypeBadge = ({ type }) => (
  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-rd-sm text-xs font-bold ${type === 'Online' ? 'bg-rd-info-bg text-rd-info' : 'bg-rd-pending-bg text-rd-pending'}`}>
    <span className={`w-1.5 h-1.5 rounded-rd-sm ${type === 'Online' ? 'bg-rd-info' : 'bg-rd-pending'}`} />
    {type || '—'}
  </span>
)

// ─── Patient Detail Modal ─────────────────────────────────────────────────────
const PatientModal = ({ patient: p, onClose }) => {
  if (!p) return null
  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4' onClick={onClose}>
      <div
        className='rd-panel w-full max-w-md max-h-[min(560px,85vh)] overflow-y-auto shadow-none'
        onClick={e => e.stopPropagation()}
      >
        {/* Header — navy bar with visible close */}
        <div className='rd-modal-header px-5 py-4 flex items-center gap-3'>
          <Avatar name={p.name} src={p.image} className='w-12 h-12 ring-2 ring-white/30' />
          <div className='flex-1 min-w-0'>
            <p className='text-white font-bold text-base truncate'>{p.name}</p>
            <p className='text-white/75 text-xs mt-0.5 font-mono'>{p.publicId || '—'}</p>
          </div>
          <button
            type='button'
            onClick={onClose}
            aria-label='Close'
            className='w-9 h-9 shrink-0 rounded-rd-sm border border-white/40 bg-white/15 text-white flex items-center justify-center hover:bg-white/25'
          >
            <RdIcon name='close' className='w-5 h-5' />
          </button>
        </div>

        {/* Details grid */}
        <div className='px-5 py-4 space-y-4 bg-rd-surface'>
          <div className='grid grid-cols-2 gap-2.5'>
            {[
              { label: 'Mobile',         value: p.phone || '—', icon: 'phone' },
              { label: 'Gender / Age',   value: [p.gender, p.age].filter(v => v && v !== 'Not Selected').join(' / ') || '—' },
              { label: 'Email',          value: p.email || '—', span: true, icon: 'mail' },
              { label: 'Patient ID',     value: p.publicId || '—' },
              { label: 'Appointments',   value: p.appointments ?? p.visits ?? 0 },
            ].map(({ label, value, span, icon }) => (
              <div key={label} className={`${span ? 'col-span-2' : ''} bg-rd-canvas border border-rd-border rounded-rd px-3 py-2.5`}>
                <p className='text-[10px] font-bold uppercase tracking-wider text-rd-muted mb-1 flex items-center gap-1.5'>
                  {icon && <RdIcon name={icon} className='w-3 h-3 text-rd-accent' />}
                  {label}
                </p>
                <p className='text-sm font-semibold text-rd-text truncate'>{value}</p>
              </div>
            ))}
          </div>

          <div className='border-t border-rd-border pt-4'>
            <p className='text-[10px] font-bold uppercase tracking-wider text-rd-muted mb-3'>Booking Info</p>
            <div className='grid grid-cols-2 gap-2.5'>
              <div className='bg-rd-canvas border border-rd-border rounded-rd px-3 py-2.5'>
                <p className='text-[10px] font-bold uppercase tracking-wider text-rd-muted mb-1'>Booking Type</p>
                <TypeBadge type={p.type} />
              </div>
              <div className='bg-rd-canvas border border-rd-border rounded-rd px-3 py-2.5'>
                <p className='text-[10px] font-bold uppercase tracking-wider text-rd-muted mb-1'>Payment Mode</p>
                <ModeBadge mode={p.mode} />
              </div>
              <div className='bg-rd-canvas border border-rd-border rounded-rd px-3 py-2.5'>
                <p className='text-[10px] font-bold uppercase tracking-wider text-rd-muted mb-1'>Payment</p>
                <p className='text-sm font-semibold text-rd-text'>{fmtPayMethod(p.paymentMethod)}</p>
              </div>
              <div className='bg-rd-canvas border border-rd-border rounded-rd px-3 py-2.5'>
                <p className='text-[10px] font-bold uppercase tracking-wider text-rd-muted mb-1'>Paid</p>
                <PaidBadge paid={p.paid} />
              </div>
              <div className='bg-rd-canvas border border-rd-border rounded-rd px-3 py-2.5 col-span-2'>
                <p className='text-[10px] font-bold uppercase tracking-wider text-rd-muted mb-1'>Booking</p>
                <BookingBadge cancelled={p.cancelled} />
              </div>
            </div>
          </div>

          <div className='pt-1 flex justify-end'>
            <button type='button' onClick={onClose} className='rd-tab-idle px-4 py-2 text-sm font-semibold rounded-rd'>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Stat strip ───────────────────────────────────────────────────────────────
const Stat = ({ label, value, accent }) => (
  <div className='flex-1 min-w-[110px] px-5 py-4'>
    <div className='flex items-center gap-2'>
      <span className={`w-2 h-2 rounded-rd-sm ${accent}`} />
      <p className='text-[11px] font-semibold uppercase tracking-wider text-rd-muted'>{label}</p>
    </div>
    <p className='text-2xl font-bold text-rd-text mt-1.5 tabular-nums'>{value}</p>
  </div>
)

// ─── Main ─────────────────────────────────────────────────────────────────────
const Patients = () => {
  const { getPatients } = useContext(ReceptionContext)
  const [query, setQuery]   = useState('')
  const [date, setDate]     = useState('')
  const [all, setAll]       = useState([])
  const [loading, setLoading] = useState(true)
  const [viewing, setViewing] = useState(null)

  useEffect(() => {
    let active = true
    ;(async () => {
      setLoading(true)
      const r = await getPatients(date || undefined)
      if (active && r?.success) setAll(r.patients || [])
      if (active) setLoading(false)
    })()
    return () => { active = false }
  }, [date])

  const stats = useMemo(() => ({
    total:     all.length,
    online:    all.filter(p => p.type === 'Online' && !p.cancelled).length,
    walkIn:    all.filter(p => p.type === 'Walk-in' && !p.cancelled).length,
    cancelled: all.filter(p => p.cancelled).length,
  }), [all])

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return all
    return all.filter(p =>
      [p.name, p.phone, p.email, p.publicId]
        .filter(Boolean)
        .some(v => String(v).toLowerCase().includes(q))
    )
  }, [all, query])

  const prettyDate = date
    ? new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : 'All dates'

  const exportColumns = [
    { key: 'name',       label: 'Patient' },
    { key: 'publicId',   label: 'Patient ID' },
    { key: 'phone',      label: 'Mobile' },
    { key: 'gender',     label: 'Gender' },
    { key: 'age',        label: 'Age' },
    { key: 'email',      label: 'Email' },
    { key: p => fmtDate(p.lastVisit, p.lastVisitDate), label: 'Last Visit' },
    { key: p => p.appointments ?? p.visits ?? 0, label: 'Appointments' },
    { key: 'type',       label: 'Booking Type' },
    { key: p => fmtPayMethod(p.paymentMethod), label: 'Payment' },
    { key: p => (p.paid ? 'Paid' : 'Unpaid'), label: 'Paid' },
    { key: p => (p.cancelled ? 'Cancelled' : 'Active'), label: 'Booking' },
  ]

  return (
    <PageWrap>
      <RcHeader title='Patients' subtitle='All patients registered at your hospital' />
      <ReceptionTabs items={RECEPTION_TAB_GROUPS.patients} />

      {/* Stat strip */}
      <div className='rd-panel mb-5 flex flex-wrap divide-x divide-rd-border'>
        <Stat label='Total Patients' value={stats.total}     accent='bg-rd-muted' />
        <Stat label='Online (App)'   value={stats.online}    accent='bg-rd-info' />
        <Stat label='Walk-in (Desk)' value={stats.walkIn}    accent='bg-rd-pending' />
        <Stat label='Cancelled'      value={stats.cancelled} accent='bg-rd-critical' />
      </div>

      {/* Table card */}
      <div className='rd-panel overflow-hidden'>
        {/* Toolbar */}
        <div className='px-5 py-4 border-b border-rd-border flex flex-col lg:flex-row lg:items-center justify-between gap-3'>
          <div>
            <h2 className='text-sm font-bold text-rd-text'>Patient Directory</h2>
            <p className='text-xs text-rd-muted mt-0.5'>{prettyDate} · {rows.length} of {all.length} {all.length === 1 ? 'patient' : 'patients'}</p>
          </div>
          <div className='flex flex-col sm:flex-row items-stretch sm:items-center gap-2'>
            <div className='flex items-center gap-1.5 rounded-rd border border-rd-border bg-rd-canvas px-2.5 py-1.5'>
              <svg className='w-4 h-4 text-rd-primary shrink-0' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' /></svg>
              <input type='date' value={date} onChange={e => setDate(e.target.value)} className='bg-transparent outline-none text-sm text-rd-text w-[140px]' />
              {date && (
                <button onClick={() => setDate('')} className='text-rd-muted hover:text-rd-critical'>
                  <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M6 18L18 6M6 6l12 12' /></svg>
                </button>
              )}
            </div>
            <div className='relative w-full sm:w-64'>
              <svg className='w-4 h-4 text-rd-muted absolute left-3 top-1/2 -translate-y-1/2' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z' /></svg>
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder='Search name, mobile, email or ID'
                className='w-full pl-9 pr-3 py-2 rounded-rd border border-rd-border bg-rd-canvas focus:bg-rd-surface focus:border-rd-primary outline-none text-sm' />
            </div>
            <ExportMenu columns={exportColumns} rows={() => rows} filename='reception_patients' title='Reception · Patients' subtitle={`${prettyDate} · ${rows.length} record(s)`} />
          </div>
        </div>

        {loading ? <Spinner /> : rows.length === 0 ? (
          <EmptyState
            title={all.length === 0 ? (date ? 'No patients on this date' : 'No patients yet') : 'No matches'}
            sub={all.length === 0
              ? (date ? 'Try another date or clear the filter.' : 'Patients appear here after their first appointment.')
              : 'Try a different search.'} />
        ) : (
          <div className='overflow-x-auto'>
            <table className='w-full text-sm border-collapse'>
              <thead>
                <tr className='text-left text-[11px] uppercase tracking-wider text-rd-muted bg-rd-canvas border-b border-rd-border'>
                  <th className='px-4 py-3 font-semibold w-10'>#</th>
                  <th className='px-4 py-3 font-semibold'>Patient</th>
                  <th className='px-4 py-3 font-semibold'>Last Visit</th>
                  <th className='px-4 py-3 font-semibold text-center'>View</th>
                </tr>
              </thead>
              <tbody className='divide-y divide-rd-border'>
                {rows.map((p, idx) => (
                  <tr key={p._id} className={`transition-colors ${p.cancelled ? 'bg-rd-critical-bg/40 hover:bg-rd-critical-bg' : 'hover:bg-rd-canvas/70'}`}>
                    <td className='px-4 py-3 text-xs font-bold text-rd-muted tabular-nums'>{idx + 1}</td>
                    <td className='px-4 py-3'>
                      <div className='flex items-center gap-3'>
                        <Avatar name={p.name} src={p.image} />
                        <div>
                          <p className={`font-semibold ${p.cancelled ? 'text-rd-muted' : 'text-rd-text'}`}>{p.name}</p>
                          <p className='text-xs text-rd-muted'>{p.phone || p.email || '—'}</p>
                        </div>
                      </div>
                    </td>
                    <td className='px-4 py-3 text-rd-muted text-xs whitespace-nowrap'>{fmtDate(p.lastVisit, p.lastVisitDate)}</td>
                    <td className='px-4 py-3 text-center'>
                      <button
                        onClick={() => setViewing(p)}
                        className='inline-flex items-center gap-1.5 px-3 py-1.5 rounded-rd bg-rd-info-bg text-rd-primary hover:bg-rd-primary hover:text-white text-xs font-bold transition-all'
                      >
                        <svg className='w-3.5 h-3.5' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M15 12a3 3 0 11-6 0 3 3 0 016 0z'/><path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z'/></svg>
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Patient detail modal */}
      {viewing && <PatientModal patient={viewing} onClose={() => setViewing(null)} />}
    </PageWrap>
  )
}

export default Patients
