import React, { useContext, useEffect, useState } from 'react'
import { ReceptionContext } from '../../context/ReceptionContext'
import { PageWrap, RcHeader, Pill, Spinner, EmptyState, ReceptionTabs, RECEPTION_TAB_GROUPS } from './components'

const GraceRequests = () => {
  const { getGraceRequests, approveGraceRequest, rejectGraceRequest } = useContext(ReceptionContext)
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)

  const load = async () => {
    setLoading(true)
    const r = await getGraceRequests()
    if (r?.success) setRows(r.requests || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const onApprove = async (id) => {
    setBusyId(id)
    const r = await approveGraceRequest(id)
    setBusyId(null)
    if (r?.success) await load()
  }

  const onReject = async (id) => {
    setBusyId(id)
    const r = await rejectGraceRequest(id)
    setBusyId(null)
    if (r?.success) await load()
  }

  return (
    <PageWrap>
      <RcHeader
        title='Queue'
        subtitle='Missed-slot reschedule requests — check availability, then accept or decline'
        right={
          <button
            onClick={load}
            className='px-3 py-2 rounded-rd bg-rd-primary text-white text-sm font-semibold hover:bg-rd-primary-hover'
          >
            Refresh
          </button>
        }
      />
      <ReceptionTabs items={RECEPTION_TAB_GROUPS.queue} />
      <div className='rd-panel overflow-hidden'>
        {loading ? (
          <Spinner />
        ) : rows.length === 0 ? (
          <EmptyState title='No pending reschedule requests' />
        ) : (
          <div className='overflow-x-auto'>
            <table className='w-full text-sm'>
              <thead>
                <tr className='text-left text-[11px] uppercase tracking-wider text-rd-muted border-b border-rd-border bg-rd-canvas/60'>
                  <th className='px-5 py-3 font-bold'>Patient</th>
                  <th className='px-5 py-3 font-bold'>Booking</th>
                  <th className='px-5 py-3 font-bold'>Requested date</th>
                  <th className='px-5 py-3 font-bold'>Status</th>
                  <th className='px-5 py-3 font-bold'>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className='border-b border-rd-border'>
                    <td className='px-5 py-3 font-semibold text-rd-text'>{r.patient_name || '—'}</td>
                    <td className='px-5 py-3 font-mono text-xs text-rd-muted'>
                      {r.booking_id || r.public_id || `#${r.appointment_id}`}
                    </td>
                    <td className='px-5 py-3 text-rd-muted'>
                      {r.requested_date
                        ? new Date(r.requested_date).toLocaleDateString()
                        : '—'}
                    </td>
                    <td className='px-5 py-3'>
                      <Pill status='PENDING' label={r.status || 'Pending'} />
                    </td>
                    <td className='px-5 py-3'>
                      <div className='flex gap-2'>
                        <button
                          disabled={busyId === r.id}
                          onClick={() => onApprove(r.id)}
                          className='px-3 py-1.5 rounded-rd bg-rd-primary text-white text-xs font-semibold disabled:opacity-50'
                        >
                          Accept
                        </button>
                        <button
                          disabled={busyId === r.id}
                          onClick={() => onReject(r.id)}
                          className='px-3 py-1.5 rounded-rd border border-rd-border text-rd-text text-xs font-semibold disabled:opacity-50'
                        >
                          Decline
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <p className='text-xs text-rd-muted mt-3'>
        Accept only after confirming doctor availability for the requested date. Accepting moves the appointment once (grace extension).
      </p>
    </PageWrap>
  )
}

export default GraceRequests
