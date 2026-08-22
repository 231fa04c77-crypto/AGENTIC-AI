import React, { useContext, useEffect, useState } from 'react'
import axios from 'axios'
import { toast } from 'react-toastify'
import { AdminContext } from '../../context/AdminContext'
import { AppContext } from '../../context/AppContext'
import { AdminPageLayout, PageHero, KpiCard, McCard } from '../../components/mc'

const RefundManagement = () => {
  const { aToken } = useContext(AdminContext)
  const { backendUrl } = useContext(AppContext)
  const [refunds, setRefunds] = useState([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const { data } = await axios.get(`${backendUrl}/api/admin/refunds/pending`, {
        headers: { atoken: aToken },
      })
      if (data.success) setRefunds(data.refunds || [])
    } catch {
      toast.error('Could not load refunds')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const complete = async (id) => {
    try {
      await axios.post(
        `${backendUrl}/api/admin/refunds/${id}/complete`,
        {},
        { headers: { atoken: aToken } }
      )
      toast.success('Refund marked completed')
      load()
    } catch {
      toast.error('Failed to update refund')
    }
  }

  return (
    <AdminPageLayout maxWidth='max-w-5xl mx-auto'>
      <PageHero
        title='Refund Queue'
        subtitle='Pending cancellations awaiting settlement.'
        features={['Fast clearance', 'Audit trail']}
      />

      <div className='mc-kpi-grid' style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', maxWidth: 420 }}>
        <KpiCard
          label='Pending'
          value={refunds.length}
          iconBg='bg-amber-100 text-amber-600'
          icon={
            <svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
              <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' />
            </svg>
          }
        />
        <KpiCard
          label='Total value'
          value={`₹${refunds.reduce((s, r) => s + (r.refund_amount_paise || 0) / 100, 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
          iconBg='bg-rose-100 text-rose-600'
          icon={
            <svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
              <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z' />
            </svg>
          }
        />
      </div>

      <McCard title={`Queue (${refunds.length})`}>
        {loading ? (
          <div className='flex justify-center py-8'>
            <div className='w-7 h-7 border-2 border-teal-200 border-t-teal-600 rounded-full animate-spin' />
          </div>
        ) : refunds.length === 0 ? (
          <p className='text-sm text-rd-muted py-4 text-center'>No pending refunds</p>
        ) : (
          <div className='divide-y divide-slate-100 -mx-1'>
            {refunds.map((r) => (
              <div
                key={r.id}
                className='flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 py-2.5 px-1'
              >
                <div className='min-w-0 flex-1'>
                  <div className='flex items-center gap-2 flex-wrap'>
                    <p className='text-sm font-semibold text-rd-text truncate'>
                      {r.patient_name || `User #${r.user_id}`}
                    </p>
                    <span className='text-xs font-bold tabular-nums text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded-md'>
                      ₹{((r.refund_amount_paise || 0) / 100).toFixed(2)}
                    </span>
                  </div>
                  <p className='text-[11px] text-rd-muted truncate mt-0.5'>
                    {r.public_id || r.booking_id}
                    {r.refund_reason ? ` · ${r.refund_reason}` : ''}
                  </p>
                </div>
                <button
                  type='button'
                  className='shrink-0 self-stretch sm:self-auto px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold'
                  onClick={() => complete(r.id)}
                >
                  Mark refunded
                </button>
              </div>
            ))}
          </div>
        )}
      </McCard>
    </AdminPageLayout>
  )
}

export default RefundManagement
