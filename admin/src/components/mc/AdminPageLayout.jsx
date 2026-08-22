import React from 'react'
import PageShell from '../PageShell'

const AdminPageLayout = ({ children, className = '', maxWidth = 'max-w-[1400px] mx-auto' }) => (
  <PageShell className={`mc-admin-page ${className}`} maxWidth={maxWidth}>
    <div className="mc-admin-page__inner flex flex-col gap-3 sm:gap-3.5">
      {children}
    </div>
  </PageShell>
)

export default AdminPageLayout
