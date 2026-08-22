import React from 'react'

/**
 * Consistent page wrapper for admin / dean / doctor views.
 * Handles mobile safe-area padding and horizontal overflow.
 */
const PageShell = ({ children, className = '', maxWidth = 'max-w-7xl mx-auto' }) => (
  <div
    className={`w-full min-h-full overflow-x-hidden page-container mobile-safe-area pb-6 sm:pb-8 ${maxWidth} ${className}`}
  >
    {children}
  </div>
)

export default PageShell
