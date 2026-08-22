import React from 'react'

const variants = {
  active: 'mc-pill mc-pill--success',
  available: 'mc-pill mc-pill--success',
  paid: 'mc-pill mc-pill--success',
  approved: 'mc-pill mc-pill--success',
  confirmed: 'mc-pill mc-pill--success',
  settled: 'mc-pill mc-pill--info',
  pending: 'mc-pill mc-pill--warning',
  invited: 'mc-pill mc-pill--info',
  review: 'mc-pill mc-pill--info',
  inactive: 'mc-pill mc-pill--danger',
  suspended: 'mc-pill mc-pill--danger',
  cancelled: 'mc-pill mc-pill--danger',
  offline: 'mc-pill mc-pill--danger',
  default: 'mc-pill mc-pill--neutral',
}

const StatusPill = ({ status, children, dot = true, className = '' }) => {
  const key = (status || '').toLowerCase().replace(/\s+/g, '_')
  const cls = variants[key] || variants.default

  return (
    <span className={`${cls} ${className}`}>
      {dot && <span className="mc-pill__dot" />}
      {children || status}
    </span>
  )
}

export default StatusPill
