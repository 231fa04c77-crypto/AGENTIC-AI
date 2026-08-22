import React, { useCallback, useContext, useEffect, useState } from 'react'
import { toast } from 'react-toastify'
import { ReceptionContext } from '../../context/ReceptionContext'
import { useQrBookingScanner } from '../../hooks/useQrBookingScanner'
import { extractBookingId, looksLikeVisitSummaryPayload } from '../../utils/bookingId'
import { PageWrap, RcHeader, Avatar, Pill, EmptyState, ReceptionTabs, RECEPTION_TAB_GROUPS } from './components'

const inputCls = 'w-full px-3 py-2 rounded-rd border border-rd-border bg-rd-surface focus:border-rd-primary outline-none text-sm font-medium text-rd-text'

const QRCheckIn = () => {
  const { checkIn, searchPatients } = useContext(ReceptionContext)
  const [bookingId, setBookingId] = useState('')
  const [busy, setBusy] = useState(false)
  const [lastSuccess, setLastSuccess] = useState(null)
  const [recent, setRecent] = useState([])
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])

  const doCheckIn = useCallback(async (id, rawScan) => {
    const raw = rawScan || id || bookingId
    // Reject visit-summary before BK extract (URLs embed BK…).
    if (looksLikeVisitSummaryPayload(raw)) {
      toast.error('This is a visit-summary QR, not a check-in booking code. Ask the patient for the Scan at reception QR (BK…).')
      return
    }
    const code = extractBookingId(raw)
    if (!code) {
      toast.error('Enter a valid Booking ID (e.g. BK8X4P2Q)')
      return
    }
    setBusy(true)
    const res = await checkIn(code)
    setBusy(false)
    if (res?.success) {
      const name = res.patientName || res.appointment?.userData?.name || 'Patient'
      const token = res.tokenNumber
      toast.success(res.message || 'Checked in')
      setLastSuccess({
        bookingId: res.bookingId || code,
        name,
        doctorName: res.doctorName,
        tokenNumber: token,
        visitNumber: res.visitNumber,
        maxVisits: res.maxVisits,
      })
      setRecent((r) => [{
        bookingId: res.bookingId || code,
        name,
        doctorName: res.doctorName,
        tokenNumber: token,
        time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        status: 'CHECKED_IN',
        image: res.appointment?.userData?.image,
      }, ...r].slice(0, 8))
      setBookingId('')
    } else {
      toast.error(res?.message || 'Check-in failed')
      setRecent((r) => [{
        bookingId: code,
        name: '—',
        time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        status: 'NO_SHOW',
      }, ...r].slice(0, 8))
    }
  }, [bookingId, checkIn])

  const onScan = useCallback((code, raw) => {
    if (busy) return
    const display = code || String(raw || '').trim()
    setBookingId(display)
    void doCheckIn(code, raw)
  }, [busy, doCheckIn])

  const { videoRef, camOn, toggleCam } = useQrBookingScanner({
    enabled: true,
    onCode: onScan,
  })

  const handleToggleCam = async () => {
    const ok = await toggleCam()
    if (ok === false && !camOn) {
      toast.error('Could not access camera. Enter the Booking ID manually.')
    }
  }

  useEffect(() => {
    const t = setTimeout(async () => {
      if (query.trim().length < 2) { setResults([]); return }
      const r = await searchPatients(query.trim())
      if (r?.success) setResults(r.patients || [])
    }, 350)
    return () => clearTimeout(t)
  }, [query, searchPatients])

  return (
    <PageWrap>
      <RcHeader title='Check-In' subtitle='Scan patient booking QR to check in' />
      <ReceptionTabs items={RECEPTION_TAB_GROUPS.checkin} />

      <div className='grid lg:grid-cols-2 gap-5'>
        <div className='rd-panel p-5'>
          <p className='text-sm font-bold text-rd-text mb-4'>Scan patient booking QR</p>
          <div className='aspect-square max-w-xs mx-auto rounded-rd bg-rd-sidebar overflow-hidden flex items-center justify-center relative'>
            {camOn ? (
              <video ref={videoRef} autoPlay playsInline muted className='w-full h-full object-cover' />
            ) : (
              <svg className='w-28 h-28 text-rd-muted' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth={1.2} d='M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z' /></svg>
            )}
            <div className='absolute inset-6 border-2 border-blue-400/60 rounded-rd pointer-events-none' />
          </div>
          <p className='text-center text-xs text-rd-muted mt-3'>
            {camOn ? 'Point the camera at the booking QR — check-in runs automatically' : 'Turn on the camera or enter the Booking ID'}
          </p>
          <button type='button' onClick={handleToggleCam} className='mt-4 w-full py-3 rounded-rd bg-rd-primary text-white text-sm font-bold hover:bg-rd-primary-hover'>
            {camOn ? 'Turn off Camera' : 'Turn on Camera'}
          </button>
        </div>

        <div className='space-y-5'>
          <div className='rd-panel p-5'>
            <p className='text-sm font-bold text-rd-text mb-3'>Or enter Booking ID</p>
            <div className='flex gap-2'>
              <input
                className={inputCls}
                value={bookingId}
                onChange={(e) => setBookingId(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && doCheckIn()}
                placeholder='BK8X4P2Q'
                autoComplete='off'
              />
              <button type='button' disabled={busy} onClick={() => doCheckIn()} className='px-5 py-2.5 rounded-rd bg-rd-primary text-white text-sm font-bold hover:bg-rd-primary-hover disabled:opacity-50 shrink-0'>
                {busy ? '…' : 'Check In'}
              </button>
            </div>
            <p className='text-[11px] text-rd-muted mt-2'>USB barcode scanners type into this field — press Enter to check in.</p>
          </div>

          {lastSuccess && (
            <div className='rd-panel p-5 border border-emerald-200 bg-emerald-50/60'>
              <p className='text-sm font-bold text-emerald-800 mb-2'>Checked in</p>
              <p className='text-sm text-rd-text font-semibold'>{lastSuccess.name}</p>
              {lastSuccess.doctorName && (
                <p className='text-xs text-rd-muted mt-1'>Doctor: {lastSuccess.doctorName}</p>
              )}
              <p className='text-xs text-rd-muted mt-1 font-mono'>{lastSuccess.bookingId}</p>
              {(lastSuccess.tokenNumber != null && lastSuccess.tokenNumber !== '') && (
                <p className='text-xs text-rd-muted mt-1'>Token: #{lastSuccess.tokenNumber}</p>
              )}
              {lastSuccess.visitNumber != null && (
                <p className='text-xs text-rd-muted mt-1'>
                  Visit {lastSuccess.visitNumber}
                  {lastSuccess.maxVisits != null ? ` of ${lastSuccess.maxVisits}` : ''}
                </p>
              )}
            </div>
          )}

          <div className='rd-panel p-5'>
            <p className='text-sm font-bold text-rd-text mb-3'>Search Patient</p>
            <input className={inputCls} value={query} onChange={(e) => setQuery(e.target.value)} placeholder='Search by name or mobile number' />
            <div className='mt-3 space-y-2 max-h-44 overflow-y-auto'>
              {results.map((p) => (
                <div key={p._id} className='flex items-center gap-3 p-2.5 rounded-rd bg-rd-canvas'>
                  <Avatar name={p.name} src={p.image} />
                  <div className='min-w-0'>
                    <p className='text-sm font-bold text-rd-text truncate'>{p.name}</p>
                    <p className='text-xs text-rd-muted'>{p.phone || p.email}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className='rd-panel mt-5 overflow-hidden'>
        <div className='px-5 py-4 border-b border-rd-border'><p className='text-sm font-bold text-rd-text'>Recent Check-Ins</p></div>
        {recent.length === 0 ? <EmptyState title='No check-ins yet' /> : (
          <div className='overflow-x-auto'>
            <table className='w-full text-sm'>
              <thead><tr className='text-left text-[11px] uppercase tracking-wider text-rd-muted border-b border-rd-border bg-rd-canvas/60'>
                <th className='px-5 py-3 font-bold'>Patient</th><th className='px-5 py-3 font-bold'>Booking ID</th><th className='px-5 py-3 font-bold'>Time</th><th className='px-5 py-3 font-bold'>Status</th>
              </tr></thead>
              <tbody>
                {recent.map((r, i) => (
                  <tr key={i} className='border-b border-rd-border'>
                    <td className='px-5 py-3'><div className='flex items-center gap-2'><Avatar name={r.name} src={r.image} /><span className='font-semibold text-rd-text'>{r.name}</span></div></td>
                    <td className='px-5 py-3 font-mono text-xs text-rd-muted'>{r.bookingId}</td>
                    <td className='px-5 py-3 text-rd-muted'>{r.time}</td>
                    <td className='px-5 py-3'><Pill status={r.status} label={r.status === 'COMPLETED' ? 'Success' : 'Failed'} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PageWrap>
  )
}

export default QRCheckIn
