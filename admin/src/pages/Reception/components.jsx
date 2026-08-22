import React from 'react'
import { NavLink } from 'react-router-dom'
import { labelForLifecycle } from '../../utils/lifecycleLabels'
import { RdIcon, RecGlyph } from './icons'

export { RdIcon, RecGlyph } from './icons'

export const fmtMoney = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`

export const RECEPTION_TAB_GROUPS = {
  checkin: [
    { label: 'Online Bookings', to: '/reception-online' },
    { label: 'Walk-In', to: '/reception-walkin' },
    { label: 'QR Check-In', to: '/reception-checkin' },
  ],
  queue: [
    { label: 'Live Queue', to: '/reception-queue' },
    { label: 'No-Shows', to: '/reception-noshows' },
    { label: 'Reschedule Requests', to: '/reception-grace' },
  ],
  patients: [
    { label: 'All Patients', to: '/reception-patients' },
    { label: 'Follow-Ups', to: '/reception-followups' },
  ],
  billing: [
    { label: 'Payments', to: '/reception-payments' },
    { label: 'Refund Requests', to: '/reception-refunds' },
  ],
}

export const ReceptionTabs = ({ items = [] }) => (
  <div className='flex items-center gap-0 mb-4 bg-rd-surface border border-rd-border rounded-rd w-fit max-w-full overflow-x-auto'>
    {items.map((it) => (
      <NavLink
        key={it.to}
        to={it.to}
        end
        className={({ isActive }) =>
          `px-4 py-2 text-sm font-semibold whitespace-nowrap border-r border-rd-border last:border-r-0 transition-[color,background-color] duration-100 ${
            isActive ? 'rd-tab-active' : 'rd-tab-idle'
          }`
        }
      >
        {it.label}
      </NavLink>
    ))}
  </div>
)

export const patientName = (a) =>
  a?.actualPatient?.name || a?.userData?.name || 'Patient'

export const patientPhone = (a) => a?.userData?.phone || a?.actualPatient?.phone || ''

export const patientImage = (a) => a?.userData?.image || null

export const doctorName = (a) => {
  const n = a?.docData?.name || 'Doctor'
  return n.startsWith('Dr') ? n : `Dr. ${n}`
}

export const tokenLabel = (a) => {
  const t = a?.todayToken || a?.tokenNumber
  return t ? `T-${String(t).padStart(3, '0')}` : '—'
}

export const todayLabel = () =>
  new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

export const PageWrap = ({ children }) => (
  <div className='p-4 sm:p-5 lg:p-6 max-w-[1500px] mx-auto w-full font-rd text-rd-text space-y-4 sm:space-y-5'>{children}</div>
)

export const RcHeader = ({ title, subtitle, right }) => (
  <div className='flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-1'>
    <div className='min-w-0'>
      <h1 className='text-2xl sm:text-[1.75rem] font-bold text-rd-text tracking-tight leading-tight'>{title}</h1>
      {subtitle && <p className='text-sm text-rd-muted mt-1.5'>{subtitle}</p>}
    </div>
    <div className='flex items-center gap-2 flex-wrap shrink-0'>
      <span className='inline-flex items-center gap-2 px-3 py-2 rounded-2xl bg-rd-surface text-sm font-medium text-rd-muted shadow-[0_2px_8px_rgba(15,39,68,0.06)] border border-rd-border'>
        <RdIcon name='calendar' className='w-4 h-4 text-rd-info' />
        {todayLabel()}
      </span>
      {right}
    </div>
  </div>
)

/** Mockup accent colours on navy brand */
const KPI_TONES = {
  good: { icon: 'bg-[#E6F7F2] text-[#0D9488]', sub: 'text-[#0D9488]', stroke: '#14B8A6' },
  pending: { icon: 'bg-[#FFF4E5] text-[#D97706]', sub: 'text-[#D97706]', stroke: '#F59E0B' },
  critical: { icon: 'bg-[#FDECEC] text-[#DC2626]', sub: 'text-[#DC2626]', stroke: '#EF4444' },
  info: { icon: 'bg-[#E8F1FB] text-[#2563EB]', sub: 'text-[#2563EB]', stroke: '#3B82F6' },
  violet: { icon: 'bg-[#F3E8FF] text-[#9333EA]', sub: 'text-[#9333EA]', stroke: '#A855F7' },
  rose: { icon: 'bg-[#FCE7F3] text-[#DB2777]', sub: 'text-[#DB2777]', stroke: '#EC4899' },
}

const TONE_ALIASES = {
  blue: 'info', green: 'good', amber: 'pending', cyan: 'info', pink: 'rose',
}

const resolveTone = (tone) => KPI_TONES[TONE_ALIASES[tone] || tone] || KPI_TONES.info

let _kpiSparkSeq = 0

const CARD =
  'rd-card bg-rd-surface text-rd-text rounded-[16px] border border-rd-border shadow-[0_2px_8px_rgba(15,39,68,0.06),0_8px_24px_rgba(15,39,68,0.05)]'

const KpiSparkline = ({ toneId, stroke }) => {
  const gid = `kpi-spark-${toneId}-${++_kpiSparkSeq}`
  return (
    <svg className='rd-kpi-spark w-full h-6 block' viewBox='0 0 200 28' preserveAspectRatio='none' aria-hidden>
      <defs>
        <linearGradient id={gid} x1='0' y1='0' x2='0' y2='1'>
          <stop offset='0%' stopColor={stroke} stopOpacity='0.35' />
          <stop offset='100%' stopColor={stroke} stopOpacity='0.02' />
        </linearGradient>
      </defs>
      <path
        d='M0 20 C20 20 28 8 48 10 C68 12 72 22 92 18 C112 14 118 6 140 8 C162 10 168 20 200 16 L200 28 L0 28 Z'
        fill={`url(#${gid})`}
      />
      <path
        d='M0 20 C20 20 28 8 48 10 C68 12 72 22 92 18 C112 14 118 6 140 8 C162 10 168 20 200 16'
        fill='none'
        stroke={stroke}
        strokeWidth='2'
        strokeLinecap='round'
        opacity='0.9'
      />
    </svg>
  )
}

export const KpiTile = ({ label, value, sub, icon, tone = 'info' }) => {
  const toneId = TONE_ALIASES[tone] || tone || 'info'
  const t = resolveTone(tone)
  return (
    <div className={`${CARD} px-3.5 pt-3 pb-0 flex flex-col overflow-hidden h-full`}>
      <div className='flex items-start justify-between gap-2'>
        <div className='min-w-0'>
          <p className='text-[12px] font-medium text-rd-muted truncate'>{label}</p>
          <p className='text-[22px] font-bold text-rd-text leading-none mt-1 tabular-nums tracking-tight'>{value}</p>
          {sub && <p className={`text-[10px] font-semibold mt-1 ${t.sub}`}>{sub}</p>}
        </div>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${t.icon}`}>
          {icon}
        </div>
      </div>
      <div className='mt-2 -mx-3.5'>
        <KpiSparkline toneId={toneId} stroke={t.stroke} />
      </div>
    </div>
  )
}

export const RevenueTile = ({ value, amount = 0, sub = 'Collected at desk', icon }) => {
  const n = Number(amount) || 0
  const bars = n <= 0 ? [10, 10, 10, 10, 10, 10, 10] : [22, 34, 28, 48, 40, 58, 72]
  const gid = `rev-bar-${++_kpiSparkSeq}`

  return (
    <div className={`${CARD} p-3.5 flex flex-col overflow-hidden h-full`}>
      <div className='flex items-start justify-between gap-2'>
        <div className='min-w-0'>
          <p className='text-[12px] font-medium text-rd-muted'>Revenue Today</p>
          <p className='text-[22px] sm:text-[24px] font-bold text-rd-text mt-1 tabular-nums tracking-tight'>{value}</p>
          <p className='text-[10px] font-semibold text-[#0D9488] mt-1'>{sub}</p>
        </div>
        <div className='w-8 h-8 rounded-full bg-[#E6F7F2] text-[#0D9488] flex items-center justify-center shrink-0'>
          {icon}
        </div>
      </div>
      <div className='rd-rev-bars mt-auto pt-3 flex items-end justify-between gap-1 h-[48px]' aria-hidden>
        {bars.map((h, i) => (
          <div
            key={`${gid}-${i}`}
            className='flex-1 rounded-t-md'
            style={{
              height: `${h}%`,
              minHeight: 6,
              backgroundColor: i === bars.length - 1 ? '#14B8A6' : 'rgba(20,184,166,0.28)',
            }}
          />
        ))}
      </div>
      {n <= 0 && <p className='text-[10px] text-rd-muted pt-1.5'>No desk collections yet today</p>}
    </div>
  )
}

export const PatientOverviewCard = ({ total = 0 }) => {
  const pts = total <= 0
    ? [8, 10, 9, 11, 10, 12, 11]
    : [0.3, 0.4, 0.45, 0.55, 0.7, 0.85, 1].map((f) => f * Math.max(total, 4))
  const max = Math.max(...pts, 1)
  const w = 280
  const h = 72
  const line = pts
    .map((v, i) => {
      const x = (i / (pts.length - 1)) * w
      const y = h - (v / max) * (h - 10) - 4
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`
    })
    .join(' ')
  const area = `${line} L${w} ${h} L0 ${h} Z`
  const gid = `pat-ov-${++_kpiSparkSeq}`

  return (
    <div className={`${CARD} p-5 h-full min-h-[210px] flex flex-col`}>
      <h2 className='text-sm font-bold text-rd-text'>Patient Overview</h2>
      <p className='text-[28px] font-bold text-rd-text mt-3 tabular-nums tracking-tight'>{total}</p>
      <p className='text-[11px] font-semibold text-rd-muted mt-1'>Total patients today (online + walk-in)</p>
      <svg className='w-full h-[72px] mt-auto' viewBox={`0 0 ${w} ${h}`} preserveAspectRatio='none' aria-hidden>
        <defs>
          <linearGradient id={gid} x1='0' y1='0' x2='0' y2='1'>
            <stop offset='0%' stopColor='#3B82F6' stopOpacity='0.35' />
            <stop offset='100%' stopColor='#3B82F6' stopOpacity='0.02' />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#${gid})`} />
        <path d={line} fill='none' stroke='#3B82F6' strokeWidth='2.5' strokeLinecap='round' />
      </svg>
    </div>
  )
}

export const QueueLoadRing = ({ waiting = 0, inProgress = 0, ready = 0 }) => {
  const total = waiting + inProgress + ready
  const pct = total <= 0 ? 0 : Math.min(100, Math.round(((inProgress + ready) / Math.max(total, 1)) * 100))
  const size = 112
  const thickness = 10
  const r = (size - thickness) / 2
  const c = 2 * Math.PI * r
  const filled = (pct / 100) * c

  return (
    <div className={`${CARD} p-5 h-full min-h-[210px] flex flex-col items-center text-center`}>
      <h2 className='text-sm font-bold text-rd-text self-start w-full mb-3'>Queue Load</h2>
      <div className='relative flex-1 flex items-center justify-center' style={{ width: size, height: size }}>
        <svg width={size} height={size} className='-rotate-90'>
          <circle cx={size / 2} cy={size / 2} r={r} fill='none' stroke='#E8F1FB' strokeWidth={thickness} />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill='none'
            stroke='#2563EB'
            strokeWidth={thickness}
            strokeDasharray={`${filled} ${c - filled}`}
            strokeLinecap='round'
          />
        </svg>
        <div className='absolute inset-0 flex flex-col items-center justify-center'>
          <p className='text-xl font-bold text-rd-text tabular-nums'>{pct}%</p>
          <p className='text-[10px] font-semibold text-rd-muted uppercase'>Active</p>
        </div>
      </div>
      <p className='text-xs text-rd-muted mt-3'>
        Waiting <span className='font-bold text-rd-text'>{waiting}</span>
        {' · '}
        Ready <span className='font-bold text-[#0D9488]'>{ready}</span>
      </p>
    </div>
  )
}

/** Visual match for bed occupancy when bed inventory is not wired */
export const BedOccupancyCard = ({ occupied = null, total = null }) => {
  const linked = Number.isFinite(occupied) && Number.isFinite(total) && total > 0
  const pct = linked ? Math.min(100, Math.round((occupied / total) * 100)) : 0
  const available = linked ? Math.max(0, total - occupied) : null
  const size = 112
  const thickness = 10
  const r = (size - thickness) / 2
  const c = 2 * Math.PI * r
  const filled = (pct / 100) * c

  return (
    <div className={`${CARD} p-5 h-full min-h-[210px] flex flex-col items-center text-center`}>
      <h2 className='text-sm font-bold text-rd-text self-start w-full mb-3'>Bed Occupancy</h2>
      <div className='relative flex-1 flex items-center justify-center' style={{ width: size, height: size }}>
        <svg width={size} height={size} className='-rotate-90'>
          <circle cx={size / 2} cy={size / 2} r={r} fill='none' stroke='#E8F1FB' strokeWidth={thickness} />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill='none'
            stroke={linked ? '#14B8A6' : '#CBD5E1'}
            strokeWidth={thickness}
            strokeDasharray={`${filled} ${c - filled}`}
            strokeLinecap='round'
          />
        </svg>
        <div className='absolute inset-0 flex flex-col items-center justify-center'>
          <p className='text-xl font-bold text-rd-text tabular-nums'>{linked ? `${pct}%` : '—'}</p>
          <p className='text-[10px] font-semibold text-rd-muted uppercase'>{linked ? 'Occupied' : 'N/A'}</p>
        </div>
      </div>
      {linked ? (
        <div className='mt-3 space-y-0.5'>
          <p className='text-xs font-semibold text-rd-text'>{occupied} / {total} Beds</p>
          <p className='text-xs font-semibold text-[#0D9488]'>Available: {available} Beds</p>
        </div>
      ) : (
        <p className='text-xs text-rd-muted mt-3'>Bed inventory not linked yet</p>
      )}
    </div>
  )
}

export const DonutChart = ({ segments = [], size = 132, thickness = 16, centerLabel, centerSub }) => {
  const total = segments.reduce((s, x) => s + (Number(x.value) || 0), 0) || 1
  const r = (size - thickness) / 2
  const c = 2 * Math.PI * r
  let offset = 0
  return (
    <div className='relative inline-flex items-center justify-center' style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className='-rotate-90'>
        <circle cx={size / 2} cy={size / 2} r={r} fill='none' stroke='#EEF2F7' strokeWidth={thickness} />
        {segments.map((seg) => {
          const v = Number(seg.value) || 0
          const len = (v / total) * c
          const dash = `${len} ${c - len}`
          const el = (
            <circle
              key={seg.label}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill='none'
              stroke={seg.color}
              strokeWidth={thickness}
              strokeDasharray={dash}
              strokeDashoffset={-offset}
              strokeLinecap='butt'
            />
          )
          offset += len
          return el
        })}
      </svg>
      <div className='absolute inset-0 flex flex-col items-center justify-center text-center px-2'>
        <p className='text-xl font-bold text-rd-text tabular-nums leading-none'>{centerLabel}</p>
        {centerSub && <p className='text-[10px] font-semibold text-rd-muted mt-1 uppercase tracking-wide'>{centerSub}</p>}
      </div>
    </div>
  )
}

const PILL_STYLES = {
  BOOKED: 'bg-rd-pending-bg text-rd-pending',
  CONFIRMED: 'bg-rd-info-bg text-rd-info',
  CHECKED_IN: 'bg-rd-good-bg text-rd-good',
  ARRIVED: 'bg-rd-good-bg text-rd-good',
  VERIFIED: 'bg-rd-good-bg text-rd-good',
  PENDING: 'bg-rd-pending-bg text-rd-pending',
  IN_QUEUE: 'bg-rd-good-bg text-rd-good',
  READY: 'bg-rd-good-bg text-rd-good',
  READY_FOR_DOCTOR: 'bg-rd-good-bg text-rd-good',
  WAITING: 'bg-rd-pending-bg text-rd-pending',
  IN_CONSULTATION: 'bg-rd-info-bg text-rd-info',
  IN_PROGRESS: 'bg-rd-info-bg text-rd-info',
  COMPLETED: 'bg-rd-info-bg text-rd-muted',
  NO_SHOW: 'bg-rd-critical-bg text-rd-critical',
  INVALID: 'bg-rd-critical-bg text-rd-critical',
  CANCELLED: 'bg-rd-critical-bg text-rd-critical',
  REFUND_PENDING: 'bg-rd-pending-bg text-rd-pending',
  REFUNDED: 'bg-rd-info-bg text-rd-muted',
  PAID: 'bg-rd-good-bg text-rd-good',
  UNPAID: 'bg-rd-critical-bg text-rd-critical',
  VALID: 'bg-rd-good-bg text-rd-good',
  EXPIRED: 'bg-rd-critical-bg text-rd-critical',
  ELIGIBLE: 'bg-rd-good-bg text-rd-good',
  USED: 'bg-rd-info-bg text-rd-muted',
}

export const Pill = ({ status, label }) => {
  const styleKey = String(status || '').toUpperCase().replace(/-/g, '_')
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-rd text-[11px] font-semibold uppercase tracking-wide ${PILL_STYLES[styleKey] || PILL_STYLES[status] || 'bg-rd-info-bg text-rd-muted'}`}>
      {label || labelForLifecycle(status)}
    </span>
  )
}

export const RdBtn = ({ variant = 'primary', className = '', children, ...props }) => {
  const base = 'inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-rd transition-[background-color,color,border-color] duration-100 disabled:opacity-50'
  const styles =
    variant === 'secondary'
      ? 'rd-btn-secondary'
      : variant === 'critical'
        ? 'bg-rd-critical-bg text-rd-critical border border-rd-critical rounded-rd hover:opacity-90'
        : 'rd-btn-primary'
  return (
    <button type='button' className={`${base} ${styles} ${className}`} {...props}>
      {children}
    </button>
  )
}

export const RdPanel = ({ className = '', children }) => (
  <div className={`rd-panel ${className}`}>{children}</div>
)

export const EmptyState = ({ title = 'Nothing here yet', sub }) => (
  <div className='py-14 text-center'>
    <div className='mx-auto w-14 h-14 rounded-2xl bg-[#E8F1FB] text-[#2563EB] flex items-center justify-center mb-3'>
      <RdIcon name='inbox' className='w-7 h-7' />
    </div>
    <p className='text-sm font-semibold text-rd-text'>{title}</p>
    {sub && <p className='text-xs text-rd-muted mt-1'>{sub}</p>}
  </div>
)

export const Spinner = () => (
  <div className='py-20 flex items-center justify-center'>
    <div className='w-7 h-7 border-2 border-rd-border border-t-[#2563EB] rounded-full animate-spin' />
  </div>
)

export const Avatar = ({ name, src, className = 'w-9 h-9' }) => {
  if (src)
    return <img src={src} alt='' className={`${className} rounded-full object-cover bg-[#E8F1FB]`} />
  return (
    <div className={`${className} rounded-full bg-[#2563EB] text-white flex items-center justify-center font-semibold text-sm`}>
      {(name || '?').charAt(0).toUpperCase()}
    </div>
  )
}
