import React, { useEffect, useState } from 'react'

const LiveClock = ({ variant = 'default', label = 'LIVE', className = '' }) => {
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const time = now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  })

  const date = now.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  if (variant === 'compact') {
    return (
      <div className={`mc-live-clock mc-live-clock--compact ${className}`}>
        <span className="mc-live-dot" />
        <span className="mc-live-label">{label}</span>
        <span className="mc-live-time">{time}</span>
      </div>
    )
  }

  return (
    <div className={`mc-live-clock ${className}`}>
      <div className="mc-live-clock__header">
        <span className="mc-live-dot" />
        <span className="mc-live-label">{label}</span>
      </div>
      <p className="mc-live-time">{time}</p>
      <p className="mc-live-date">{date}</p>
    </div>
  )
}

export default LiveClock
