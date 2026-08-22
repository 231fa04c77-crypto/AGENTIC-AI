import React from 'react'
import LiveClock from './LiveClock'

const CheckIcon = () => (
  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
  </svg>
)

/**
 * Compact page banner — dense desk strip (not a tall marketing hero).
 * widget: { type: 'clock' } | { type: 'metric', label, value, sublabel? }
 */
const PageHero = ({
  title,
  subtitle,
  features = [],
  widget = { type: 'clock' },
  icon,
  className = '',
}) => {
  const chips = features.slice(0, 3)

  return (
    <section className={`mc-page-hero ${className}`}>
      <div className="mc-page-hero__bg" aria-hidden="true" />
      <div className="mc-page-hero__content">
        <div className="mc-page-hero__text min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {icon && <div className="mc-page-hero__icon shrink-0 opacity-90">{icon}</div>}
            <h1 className="mc-page-hero__title truncate">{title}</h1>
          </div>
          {subtitle && <p className="mc-page-hero__subtitle">{subtitle}</p>}
          {chips.length > 0 && (
            <ul className="mc-page-hero__features">
              {chips.map((f) => (
                <li key={f}>
                  <CheckIcon />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="mc-page-hero__widget shrink-0">
          {widget.type === 'metric' ? (
            <div className="mc-hero-metric">
              <div className="mc-hero-metric__header">
                <span className="mc-live-dot" />
                <span className="mc-live-label">{widget.label || 'LIVE'}</span>
              </div>
              <p className="mc-hero-metric__value">{widget.value}</p>
              {widget.sublabel && <p className="mc-hero-metric__sub">{widget.sublabel}</p>}
            </div>
          ) : (
            <LiveClock variant="compact" />
          )}
        </div>
      </div>
    </section>
  )
}

export default PageHero
