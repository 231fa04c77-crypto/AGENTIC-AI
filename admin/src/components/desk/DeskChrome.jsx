import React from 'react'

/** Shared desk page chrome — matches Reception PageWrap / RcHeader / cards */

export const DeskPage = ({ children, className = '' }) => (
  <div className={`p-4 sm:p-5 lg:p-6 max-w-[1500px] mx-auto w-full font-rd text-rd-text space-y-4 sm:space-y-5 ${className}`}>
    {children}
  </div>
)

export const DeskHeader = ({ title, subtitle, right }) => (
  <div className='flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-1'>
    <div className='min-w-0'>
      <h1 className='text-2xl sm:text-[1.75rem] font-bold text-rd-text tracking-tight leading-tight'>{title}</h1>
      {subtitle && <p className='text-sm text-rd-muted mt-1.5'>{subtitle}</p>}
    </div>
    {right && <div className='flex items-center gap-2 flex-wrap shrink-0'>{right}</div>}
  </div>
)

export const DESK_CARD =
  'rd-card bg-rd-surface text-rd-text rounded-[16px] border border-rd-border shadow-[0_2px_8px_rgba(15,39,68,0.06),0_8px_24px_rgba(15,39,68,0.05)]'

export const DeskCard = ({ children, className = '', onClick }) => (
  <div className={`${DESK_CARD} ${className}`} onClick={onClick} role={onClick ? 'button' : undefined}>
    {children}
  </div>
)

const TONES = {
  sky: { icon: 'bg-sky-50 text-sky-600', stroke: '#0ea5e9' },
  teal: { icon: 'bg-teal-50 text-teal-600', stroke: '#14b8a6' },
  indigo: { icon: 'bg-indigo-50 text-indigo-600', stroke: '#6366f1' },
  violet: { icon: 'bg-violet-50 text-violet-600', stroke: '#8b5cf6' },
  rose: { icon: 'bg-rose-50 text-rose-600', stroke: '#f43f5e' },
  amber: { icon: 'bg-amber-50 text-amber-600', stroke: '#f59e0b' },
  emerald: { icon: 'bg-emerald-50 text-emerald-600', stroke: '#10b981' },
  orange: { icon: 'bg-orange-50 text-orange-600', stroke: '#f97316' },
}

let _spark = 0

const Spark = ({ stroke }) => {
  const gid = `desk-spark-${++_spark}`
  return (
    <svg className='w-full h-6 block' viewBox='0 0 200 28' preserveAspectRatio='none' aria-hidden>
      <defs>
        <linearGradient id={gid} x1='0' y1='0' x2='0' y2='1'>
          <stop offset='0%' stopColor={stroke} stopOpacity='0.35' />
          <stop offset='100%' stopColor={stroke} stopOpacity='0.02' />
        </linearGradient>
      </defs>
      <path d='M0 20 C20 20 28 8 48 10 C68 12 72 22 92 18 C112 14 118 6 140 8 C162 10 168 20 200 16 L200 28 L0 28 Z' fill={`url(#${gid})`} />
      <path d='M0 20 C20 20 28 8 48 10 C68 12 72 22 92 18 C112 14 118 6 140 8 C162 10 168 20 200 16' fill='none' stroke={stroke} strokeWidth='2' strokeLinecap='round' opacity='0.9' />
    </svg>
  )
}

export const DeskKpi = ({ label, value, sub, icon, tone = 'sky', onClick }) => {
  const t = TONES[tone] || TONES.sky
  return (
    <div
      className={`${DESK_CARD} px-3.5 pt-3 pb-0 flex flex-col overflow-hidden h-full ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
    >
      <div className='flex items-start justify-between gap-2'>
        <div className='min-w-0'>
          <p className='text-[12px] font-medium text-rd-muted truncate'>{label}</p>
          <p className='text-[22px] font-bold text-rd-text leading-none mt-1 tabular-nums tracking-tight'>{value}</p>
          {sub && <p className='text-[10px] font-semibold mt-1 text-rd-muted'>{sub}</p>}
        </div>
        {icon && (
          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${t.icon}`}>
            {icon}
          </div>
        )}
      </div>
      <div className='mt-2 -mx-3.5'>
        <Spark stroke={t.stroke} />
      </div>
    </div>
  )
}

export const DeskBtn = ({ children, onClick, className = '' }) => (
  <button
    type='button'
    onClick={onClick}
    className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold rd-btn-primary ${className}`}
  >
    {children}
  </button>
)
