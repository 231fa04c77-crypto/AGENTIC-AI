import React from 'react'

const FilterToolbar = ({ children, actions, className = '' }) => (
  <div className={`mc-filter-bar ${className}`}>
    <div className="mc-filter-bar__fields">{children}</div>
    {actions && <div className="mc-filter-bar__actions">{actions}</div>}
  </div>
)

export const McSelect = ({ className = '', ...props }) => (
  <select className={`mc-input mc-select ${className}`} {...props} />
)

export const McSearch = ({ className = '', ...props }) => (
  <div className={`mc-search ${className}`}>
    <svg className="mc-search__icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
    <input className="mc-input mc-search__input" type="search" {...props} />
  </div>
)

export const McButton = ({ variant = 'primary', className = '', children, ...props }) => {
  const v = variant === 'outline' ? 'mc-btn mc-btn--outline' : variant === 'ghost' ? 'mc-btn mc-btn--ghost' : 'mc-btn mc-btn--primary'
  return (
    <button type="button" className={`${v} ${className}`} {...props}>
      {children}
    </button>
  )
}

export default FilterToolbar
