import React, { useContext, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ReceptionContext } from '../../context/ReceptionContext'
import {
  PageWrap, RcHeader, KpiTile, RevenueTile, DonutChart,
  PatientOverviewCard, BedOccupancyCard,
  Pill, Spinner, Avatar, EmptyState, RdBtn,
  fmtMoney, patientName, doctorName, tokenLabel,
} from './components'
import { RecGlyph } from './icons'

const greeting = () => {
  const h = new Date().getHours()
  if (h < 12) return 'Good Morning'
  if (h < 17) return 'Good Afternoon'
  return 'Good Evening'
}

const QUICK_ACTIONS = [
  { label: 'New Walk-in', to: '/reception-walkin', icon: 'walkin', tone: 'bg-[#E8F1FB] text-[#2563EB]' },
  { label: 'Scan QR', to: '/reception-checkin', icon: 'qr', tone: 'bg-[#E6F7F2] text-[#0D9488]' },
  { label: 'Generate Token', to: '/reception-queue', icon: 'token', tone: 'bg-[#F3E8FF] text-[#9333EA]' },
  { label: 'Verify Follow-up', to: '/reception-followups', icon: 'check', tone: 'bg-[#E6F7F2] text-[#0D9488]' },
  { label: 'Check Payment', to: '/reception-payments', icon: 'billing', tone: 'bg-[#E8F1FB] text-[#3B82F6]' },
  { label: 'Search Patient', to: '/reception-patients', icon: 'search', tone: 'bg-[#FFF4E5] text-[#D97706]' },
]

const statusKey = (a) => String(a?.deskStatus || a?.lifecycle_status || a?.status || '').toUpperCase()

const CARD = 'rd-card bg-rd-surface text-rd-text rounded-[16px] border border-rd-border shadow-[0_2px_8px_rgba(15,39,68,0.06),0_8px_24px_rgba(15,39,68,0.05)]'

const MiniStat = ({ label, value, color }) => (
  <div className='rd-soft rounded-xl bg-[#F7F9FC] px-3 py-2.5 min-w-0'>
    <p className='text-[10px] font-semibold uppercase tracking-wide text-rd-muted truncate'>{label}</p>
    <p className='text-lg font-bold tabular-nums mt-0.5' style={{ color: color || 'var(--rd-text-primary)' }}>{value}</p>
  </div>
)

const ReceptionDashboard = () => {
  const { getDashboard, recInfo } = useContext(ReceptionContext)
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    const res = await getDashboard()
    if (res?.success) setData(res)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const s = data?.stats || {}
  const queue = data?.liveQueue || []

  const analytics = useMemo(() => {
    let waiting = 0
    let inProgress = 0
    let ready = 0
    for (const a of queue) {
      const st = statusKey(a)
      if (st.includes('PROGRESS') || st.includes('CONSULT')) inProgress += 1
      else if (st.includes('READY') || st === 'ARRIVED' || st === 'VERIFIED') ready += 1
      else waiting += 1
    }
    const online = s.onlineToday ?? 0
    const walkIn = s.walkInToday ?? 0
    const noShows = s.noShows ?? 0
    const waitingQ = s.waitingQueue ?? waiting
    const totalToday = online + walkIn
    const completed = Math.max(0, totalToday - waitingQ - noShows)
    const cancelled = noShows
    const segments = [
      { label: 'Completed', value: completed, color: '#14B8A6' },
      { label: 'In Progress', value: inProgress || 0, color: '#F59E0B' },
      { label: 'Scheduled', value: Math.max(totalToday - completed - inProgress, 0), color: '#3B82F6' },
      { label: 'Cancelled', value: cancelled, color: '#EF4444' },
    ].filter((x) => x.value > 0)
    const donutSegments = segments.length
      ? segments
      : [{ label: 'None', value: 1, color: '#E5E7EB' }]
    const donutTotal = segments.reduce((a, b) => a + b.value, 0)
    return {
      waiting: waiting || waitingQ,
      inProgress,
      ready,
      totalToday,
      completed,
      cancelled,
      donutSegments,
      donutTotal,
      hasData: totalToday > 0 || waitingQ > 0 || noShows > 0,
    }
  }, [queue, s])

  return (
    <PageWrap>
      <RcHeader
        title={`${greeting()}, ${recInfo?.name || 'Receptionist'}`}
        subtitle={`Here's what's happening at ${recInfo?.hospitalName || 'your hospital'} today.`}
        right={
          <RdBtn onClick={load} className='gap-2 rounded-2xl px-4'>
            <RecGlyph name='refresh' className='w-4 h-4' />
            Refresh
          </RdBtn>
        }
      />

      {loading ? <Spinner /> : (
        <>
          {/* KPI block: 3+3 left, Revenue tall on right */}
          <div className='grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4'>
            <KpiTile label='Online Patients' value={s.onlineToday ?? 0} sub='Today' tone='info' icon={<RecGlyph name='online' className='w-4 h-4' />} />
            <KpiTile label='Walk-in Patients' value={s.walkInToday ?? 0} sub='Today' tone='good' icon={<RecGlyph name='walkin' className='w-4 h-4' />} />
            <KpiTile label='Waiting Queue' value={s.waitingQueue ?? 0} sub='Now' tone='pending' icon={<RecGlyph name='queue' className='w-4 h-4' />} />
            <div className='col-span-2 lg:col-span-1 lg:row-span-2 order-last lg:order-none'>
              <RevenueTile
                value={fmtMoney(s.revenueToday)}
                amount={s.revenueToday}
                icon={<RecGlyph name='revenue' className='w-5 h-5' />}
              />
            </div>
            <KpiTile label='No Shows' value={s.noShows ?? 0} sub='Today' tone='critical' icon={<RecGlyph name='noshow' className='w-4 h-4' />} />
            <KpiTile label='Follow-Ups' value={s.followUps ?? 0} sub='Today' tone='violet' icon={<RecGlyph name='calendar' className='w-4 h-4' />} />
            <KpiTile label='Pending Refunds' value={s.pendingRefunds ?? 0} sub='Requests' tone='rose' icon={<RecGlyph name='refund' className='w-4 h-4' />} />
          </div>

          {/* Quick Actions — single row, above Today's Appointments */}
          <div className={`${CARD} px-3.5 py-3`}>
            <div className='flex items-center gap-3'>
              <h2 className='text-sm font-bold text-rd-text shrink-0 hidden sm:block pr-1'>Quick Actions</h2>
              <div className='grid grid-cols-3 sm:grid-cols-6 gap-2 flex-1 min-w-0'>
                {QUICK_ACTIONS.map((a) => (
                  <button
                    key={a.label}
                    type='button'
                    onClick={() => navigate(a.to)}
                    className='rd-soft rounded-xl bg-[#F7F9FC] hover:bg-white hover:shadow-[0_4px_14px_rgba(15,39,68,0.1)] border border-transparent hover:border-[#E8EEF5] px-2 py-2.5 flex flex-col items-center gap-1.5 text-center transition-[background-color,box-shadow,border-color] duration-150'
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${a.tone}`}>
                      <RecGlyph name={a.icon} className='w-4 h-4' />
                    </div>
                    <span className='text-[10px] font-semibold text-rd-text leading-tight'>{a.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Appointments | Patient Overview | Bed Occupancy */}
          <div className='grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4'>
            <div className={`${CARD} p-5 lg:col-span-5 min-h-[210px]`}>
              <h2 className='text-sm font-bold text-rd-text'>Today&apos;s Appointments</h2>
              <p className='text-xs text-rd-muted mt-0.5 mb-3'>Desk volume breakdown</p>
              <div className='grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4'>
                <MiniStat label='Total' value={analytics.totalToday} color='#2563EB' />
                <MiniStat label='Completed' value={analytics.completed} color='#0D9488' />
                <MiniStat label='In Progress' value={analytics.inProgress} color='#D97706' />
                <MiniStat label='Cancelled' value={analytics.cancelled} color='#DC2626' />
              </div>
              <div className='flex flex-col sm:flex-row items-center gap-5'>
                <DonutChart
                  segments={analytics.donutSegments}
                  centerLabel={String(analytics.hasData ? analytics.donutTotal || analytics.totalToday : 0)}
                  centerSub='Total'
                />
                <ul className='flex-1 w-full space-y-2.5'>
                  {analytics.donutSegments.map((seg) => {
                    const pct = analytics.donutTotal
                      ? Math.round((seg.value / analytics.donutTotal) * 100)
                      : 0
                    return (
                      <li key={seg.label} className='flex items-center justify-between text-sm'>
                        <span className='flex items-center gap-2 font-medium text-rd-text'>
                          <span className='w-2.5 h-2.5 rounded-full shrink-0' style={{ background: seg.color }} />
                          {seg.label}
                        </span>
                        <span className='font-bold tabular-nums text-rd-muted'>
                          {seg.label === 'None' ? '0%' : `${pct}%`}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              </div>
            </div>
            <div className='lg:col-span-4'>
              <PatientOverviewCard total={(s.onlineToday ?? 0) + (s.walkInToday ?? 0)} />
            </div>
            <div className='lg:col-span-3'>
              <BedOccupancyCard />
            </div>
          </div>

          {/* Live Queue */}
          <div className={`${CARD} overflow-hidden`}>
            <div className='flex items-center justify-between px-4 py-3 border-b border-[#EEF2F7]'>
              <h2 className='text-sm font-bold text-rd-text'>Today&apos;s Queue (Live)</h2>
              <button type='button' onClick={() => navigate('/reception-queue')} className='text-xs font-semibold text-[#2563EB] hover:underline'>
                View Full Queue →
              </button>
            </div>
            {queue.length === 0 ? (
              <EmptyState title='Queue is empty' sub='Checked-in patients will appear here when ready for the doctor.' />
            ) : (
              <div className='overflow-x-auto'>
                <table className='w-full text-sm rd-table'>
                  <thead>
                    <tr className='text-left'>
                      <th className='px-4 py-2.5'>#</th>
                      <th className='px-4 py-2.5'>Token No.</th>
                      <th className='px-4 py-2.5'>Patient Name</th>
                      <th className='px-4 py-2.5'>Type</th>
                      <th className='px-4 py-2.5'>Doctor</th>
                      <th className='px-4 py-2.5'>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {queue.map((a, i) => (
                      <tr key={a._id}>
                        <td className='px-4 py-2.5 text-rd-muted tabular-nums'>{i + 1}</td>
                        <td className='px-4 py-2.5 font-semibold text-[#2563EB]'>{tokenLabel(a)}</td>
                        <td className='px-4 py-2.5'>
                          <div className='flex items-center gap-2'>
                            <Avatar name={patientName(a)} src={a.userData?.image} />
                            <span className='font-medium text-rd-text'>{patientName(a)}</span>
                          </div>
                        </td>
                        <td className='px-4 py-2.5 text-rd-muted'>{a.isOnline ? 'Online' : 'Walk-in'}</td>
                        <td className='px-4 py-2.5 text-rd-muted'>{doctorName(a)}</td>
                        <td className='px-4 py-2.5'><Pill status={a.deskStatus} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </PageWrap>
  )
}

export default ReceptionDashboard
