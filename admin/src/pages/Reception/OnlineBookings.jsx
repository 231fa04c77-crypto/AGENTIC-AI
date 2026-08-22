import React, { useContext, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ReceptionContext } from '../../context/ReceptionContext'
import {
  PageWrap, RcHeader, Pill, Spinner, Avatar, EmptyState,
  patientName, doctorName, ReceptionTabs, RECEPTION_TAB_GROUPS,
} from './components'

const TABS = [
  { id: 'all', label: 'All' },
  { id: 'arrived', label: 'Arrived' },
  { id: 'verified', label: 'Verified' },
  { id: 'queue', label: 'In Queue' },
]

const PAGE_SIZE = 8

export const OnlineBookingsList = ({ showHeader = false }) => {
  const { getOnlineBookings, verifyAppointment, generateToken } = useContext(ReceptionContext)
  const navigate = useNavigate()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('all')
  const [page, setPage] = useState(1)
  const [busy, setBusy] = useState(null)

  const load = async () => {
    const res = await getOnlineBookings()
    if (res?.success) setRows(res.appointments || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const counts = useMemo(() => ({
    all: rows.length,
    arrived: rows.filter((r) => ['ARRIVED', 'VERIFIED', 'IN_QUEUE', 'READY_FOR_DOCTOR'].includes(r.deskStatus)).length,
    verified: rows.filter((r) => r.deskStatus === 'VERIFIED').length,
    queue: rows.filter((r) => r.deskStatus === 'IN_QUEUE' || r.receptionStatus === 'READY_FOR_DOCTOR').length,
  }), [rows])

  const filtered = useMemo(() => {
    if (tab === 'arrived') return rows.filter((r) => ['ARRIVED', 'VERIFIED', 'IN_QUEUE', 'READY_FOR_DOCTOR'].includes(r.deskStatus))
    if (tab === 'verified') return rows.filter((r) => r.deskStatus === 'VERIFIED')
    if (tab === 'queue') return rows.filter((r) => r.deskStatus === 'IN_QUEUE' || r.receptionStatus === 'READY_FOR_DOCTOR')
    return rows
  }, [rows, tab])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const act = async (fn, id) => {
    setBusy(id)
    const res = await fn(id)
    if (res?.success) await load()
    setBusy(null)
  }

  return (
    <div className="space-y-4">
      {showHeader && (
        <RcHeader title='Check-In' subtitle="Verify and manage today's online appointments"
          right={<button onClick={load} className='px-3 py-2 rounded-rd bg-rd-primary text-white text-sm font-semibold hover:bg-rd-primary-hover'>Refresh</button>} />
      )}

      <div className='flex items-center gap-2 mb-1 flex-wrap'>
        {TABS.map((t) => (
          <button key={t.id} onClick={() => { setTab(t.id); setPage(1) }}
            className={`px-4 py-2 rounded-rd text-sm font-bold transition-all ${tab === t.id ? 'rd-tab-active' : 'rd-tab-idle'}`}>
            {t.label} <span className='opacity-70'>({counts[t.id]})</span>
          </button>
        ))}
      </div>

      <div className='rd-panel overflow-hidden'>
        {loading ? <Spinner /> : pageRows.length === 0 ? (
          <EmptyState title='No bookings found' />
        ) : (
          <div className='overflow-x-auto'>
            <table className='w-full text-sm'>
              <thead>
                <tr className='text-left text-[11px] uppercase tracking-wider text-rd-muted border-b border-rd-border bg-rd-canvas/60'>
                  <th className='px-4 py-3 font-bold'>Booking ID</th>
                  <th className='px-4 py-3 font-bold'>Patient</th>
                  <th className='px-4 py-3 font-bold'>Doctor</th>
                  <th className='px-4 py-3 font-bold'>Time</th>
                  <th className='px-4 py-3 font-bold'>Payment</th>
                  <th className='px-4 py-3 font-bold'>Validity</th>
                  <th className='px-4 py-3 font-bold'>Follow-up</th>
                  <th className='px-4 py-3 font-bold'>Status</th>
                  <th className='px-4 py-3 font-bold text-right'>Action</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((a) => {
                  const v = a.verification || {}
                  return (
                    <tr key={a._id} className='border-b border-rd-border '>
                      <td className='px-4 py-3 font-mono text-xs font-semibold text-rd-muted'>{a.bookingId || a.publicId || `#${a._id}`}</td>
                      <td className='px-4 py-3'>
                        <div className='flex items-center gap-2'>
                          <Avatar name={patientName(a)} src={a.userData?.image} />
                          <span className='font-semibold text-rd-text'>{patientName(a)}</span>
                        </div>
                      </td>
                      <td className='px-4 py-3 text-rd-muted'>{doctorName(a)}</td>
                      <td className='px-4 py-3 text-rd-muted'>{a.slotTime || '—'}</td>
                      <td className='px-4 py-3'><Pill status={v.paymentOk ? 'PAID' : 'UNPAID'} /></td>
                      <td className='px-4 py-3'><Pill status={v.validityOk ? 'VALID' : 'EXPIRED'} /></td>
                      <td className='px-4 py-3'><Pill status={v.followupAvailable ? 'ELIGIBLE' : 'USED'} /></td>
                      <td className='px-4 py-3'><Pill status={a.deskStatus} /></td>
                      <td className='px-4 py-3'>
                        <div className='flex items-center justify-end gap-2'>
                          {a.deskStatus === 'PENDING' && (
                            <button disabled={busy === a._id} onClick={() => act(verifyAppointment, a._id)}
                              className='px-3 py-1.5 rounded-rd bg-rd-good text-white text-xs font-bold hover:opacity-90 disabled:opacity-50'>Verify</button>
                          )}
                          {(a.deskStatus === 'VERIFIED' || a.deskStatus === 'ARRIVED') && (
                            <button disabled={busy === a._id} onClick={() => act(generateToken, a._id)}
                              className='px-3 py-1.5 rounded-rd bg-rd-primary text-white text-xs font-bold hover:bg-rd-primary-hover disabled:opacity-50'>Token</button>
                          )}
                          <button onClick={() => navigate(`/reception-summary/${a._id}`)}
                            className='px-2.5 py-1.5 rounded-rd border border-rd-border text-rd-muted text-xs font-bold hover:bg-rd-canvas'>View</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className='flex items-center justify-between px-4 py-3 border-t border-rd-border'>
          <p className='text-xs text-rd-muted'>Showing {pageRows.length} of {filtered.length} bookings</p>
          <div className='flex items-center gap-1'>
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className='px-2.5 py-1.5 rounded-rd border border-rd-border text-rd-muted text-xs font-bold disabled:opacity-40'>‹</button>
            <span className='px-3 text-xs font-bold text-rd-muted'>{page} / {totalPages}</span>
            <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className='px-2.5 py-1.5 rounded-rd border border-rd-border text-rd-muted text-xs font-bold disabled:opacity-40'>›</button>
          </div>
        </div>
      </div>

      <div className='mt-5 rd-panel p-4'>
        <p className='text-xs font-bold text-rd-muted uppercase tracking-wider mb-3'>Status Guide</p>
        <div className='grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-rd-muted'>
          <div className='flex items-center gap-2'><Pill status='VERIFIED' /> Booking verified</div>
          <div className='flex items-center gap-2'><Pill status='PENDING' /> Awaiting verification</div>
          <div className='flex items-center gap-2'><Pill status='IN_QUEUE' /> In doctor queue</div>
          <div className='flex items-center gap-2'><Pill status='INVALID' /> Invalid / expired</div>
        </div>
      </div>
    </div>
  )
}

const OnlineBookings = () => {
  return (
    <PageWrap>
      <OnlineBookingsList showHeader={true} />
    </PageWrap>
  )
}

export default OnlineBookings

