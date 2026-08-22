import React from 'react'

const trendColors = {
  up: 'text-emerald-600',
  down: 'text-rose-600',
  neutral: 'text-slate-500',
}

const KpiCard = ({
  label,
  value,
  icon,
  iconBg = 'bg-sky-100 text-sky-600',
  trend,
  trendLabel,
  onClick,
  className = '',
}) => (
  <div
    className={`mc-kpi-card ${onClick ? 'mc-kpi-card--clickable' : ''} ${className}`}
    onClick={onClick}
    role={onClick ? 'button' : undefined}
    tabIndex={onClick ? 0 : undefined}
    onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
  >
    {icon && (
      <div className={`mc-kpi-card__icon ${iconBg}`}>{icon}</div>
    )}
    <div className="mc-kpi-card__body">
      <p className="mc-kpi-card__label">{label}</p>
      <p className="mc-kpi-card__value">{value}</p>
      {(trend != null || trendLabel) && (
        <p className={`mc-kpi-card__trend ${trendColors[trend?.direction || 'neutral']}`}>
          {trend?.direction === 'up' && '↑ '}
          {trend?.direction === 'down' && '↓ '}
          {trend?.value != null && `${trend.value} `}
          {trendLabel && <span className="text-slate-400 font-medium">{trendLabel}</span>}
        </p>
      )}
    </div>
  </div>
)

export default KpiCard
