import React from 'react'

const GlassCard = ({ children, className = '', hover = true, onClick }) => {
  return (
    <div
      onClick={onClick}
      className={`
        bg-mc-surface/90 dark:bg-mc-surface/95 backdrop-blur-xl 
        border border-mc-border
        rounded-2xl 
        shadow-[0_8px_32px_0_rgba(15,23,42,0.12)]
        dark:shadow-[0_8px_32px_0_rgba(0,0,0,0.35)]
        ${hover ? 'hover:shadow-[0_8px_36px_0_rgba(15,23,42,0.16)] dark:hover:shadow-[0_8px_36px_0_rgba(0,0,0,0.45)] transition-all duration-300' : ''}
        ${onClick ? 'cursor-pointer' : ''}
        ${className}
      `}
    >
      {children}
    </div>
  )
}

export default GlassCard
