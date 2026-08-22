import React from 'react'

const McCard = ({ title, action, children, className = '', bodyClassName = '', noPadding = false }) => (
  <div className={`mc-card ${className}`}>
    {(title || action) && (
      <div className="mc-card__header">
        {title && <h3 className="mc-card__title">{title}</h3>}
        {action && <div className="mc-card__action">{action}</div>}
      </div>
    )}
    <div className={noPadding ? bodyClassName : `mc-card__body ${bodyClassName}`}>
      {children}
    </div>
  </div>
)

export default McCard
