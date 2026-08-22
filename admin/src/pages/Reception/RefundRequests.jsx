import React, { useContext, useEffect, useState } from 'react'
import { ReceptionContext } from '../../context/ReceptionContext'
import { PageWrap, RcHeader, Pill, Spinner, EmptyState, fmtMoney, ReceptionTabs, RECEPTION_TAB_GROUPS } from './components'

const RefundRequests = () => {
  const { getRefundRequests } = useContext(ReceptionContext)
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  const load = async () => { const r = await getRefundRequests(); if (r?.success) setRows(r.refunds || []); setLoading(false) }
  useEffect(() => { load() }, [])

  return (
    <PageWrap>
      <RcHeader title='Billing' subtitle='Pending refunds for hospital appointments'
        right={<button onClick={load} className='px-3 py-2 rounded-rd bg-rd-primary text-white text-sm font-semibold hover:bg-rd-primary-hover'>Refresh</button>} />
      <ReceptionTabs items={RECEPTION_TAB_GROUPS.billing} />
      <div className='rd-panel overflow-hidden'>
        {loading ? <Spinner /> : rows.length === 0 ? <EmptyState title='No pending refunds' /> : (
          <div className='overflow-x-auto'>
            <table className='w-full text-sm'>
              <thead><tr className='text-left text-[11px] uppercase tracking-wider text-rd-muted border-b border-rd-border bg-rd-canvas/60'>
                <th className='px-5 py-3 font-bold'>Booking</th><th className='px-5 py-3 font-bold'>Patient</th><th className='px-5 py-3 font-bold'>Amount</th><th className='px-5 py-3 font-bold'>Status</th><th className='px-5 py-3 font-bold'>Requested</th>
              </tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className='border-b border-rd-border '>
                    <td className='px-5 py-3 font-mono text-xs text-rd-muted'>{r.booking_id || r.public_id || `#${r.appointment_id}`}</td>
                    <td className='px-5 py-3 font-semibold text-rd-text'>{r.patient_name || '—'}</td>
                    <td className='px-5 py-3 font-bold text-rd-text'>{fmtMoney(r.refund_amount ?? r.amount)}</td>
                    <td className='px-5 py-3'><Pill status='PENDING' label={r.status || 'Pending'} /></td>
                    <td className='px-5 py-3 text-rd-muted text-xs'>{r.created_at ? new Date(r.created_at).toLocaleString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <p className='text-xs text-rd-muted mt-3'>Refund approvals are processed by the Dean / Admin. This list is read-only for reception.</p>
    </PageWrap>
  )
}

export default RefundRequests
