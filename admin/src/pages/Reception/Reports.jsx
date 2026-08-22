import React, { useContext, useEffect, useState } from 'react'
import { ReceptionContext } from '../../context/ReceptionContext'
import { PageWrap, RcHeader, KpiTile, Spinner, fmtMoney } from './components'
import { RecGlyph } from './icons'
import { ExportMenu } from '../../components/mc'

const Reports = () => {
  const { getDashboard } = useContext(ReceptionContext)
  const [s, setS] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { (async () => { const r = await getDashboard(); if (r?.success) setS(r.stats); setLoading(false) })() }, [])

  const summaryRows = () => ([
    { metric: 'Online Patients', value: s?.onlineToday ?? 0 },
    { metric: 'Walk-in Patients', value: s?.walkInToday ?? 0 },
    { metric: 'No Shows', value: s?.noShows ?? 0 },
    { metric: 'Follow-Ups', value: s?.followUps ?? 0 },
    { metric: 'Waiting Queue', value: s?.waitingQueue ?? 0 },
    { metric: 'Pending Refunds', value: s?.pendingRefunds ?? 0 },
    { metric: 'Revenue Today', value: fmtMoney(s?.revenueToday) },
  ])

  return (
    <PageWrap>
      <RcHeader title='Reports' subtitle="Today's front-desk activity overview"
        right={
          <ExportMenu
            columns={[{ key: 'metric', label: 'Metric' }, { key: 'value', label: 'Value' }]}
            rows={summaryRows}
            filename='reception_daily_report'
            title='Reception · Daily Report'
            subtitle={new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
            orientation='portrait'
          />
        } />
      {loading ? <Spinner /> : (
        <>
          <div className='grid grid-cols-2 lg:grid-cols-4 gap-3'>
            <KpiTile label='Online Patients' value={s?.onlineToday ?? 0} tone='info' icon={<RecGlyph name='online' className='w-5 h-5' />} />
            <KpiTile label='Walk-in Patients' value={s?.walkInToday ?? 0} tone='good' icon={<RecGlyph name='walkin' className='w-5 h-5' />} />
            <KpiTile label='No Shows' value={s?.noShows ?? 0} tone='critical' icon={<RecGlyph name='noshow' className='w-5 h-5' />} />
            <KpiTile label='Follow-Ups' value={s?.followUps ?? 0} tone='pending' icon={<RecGlyph name='calendar' className='w-5 h-5' />} />
          </div>
          <div className='grid grid-cols-1 lg:grid-cols-3 gap-3 mt-3'>
            <KpiTile label='Waiting Queue' value={s?.waitingQueue ?? 0} tone='pending' icon={<RecGlyph name='queue' className='w-5 h-5' />} />
            <KpiTile label='Pending Refunds' value={s?.pendingRefunds ?? 0} tone='critical' icon={<RecGlyph name='refund' className='w-5 h-5' />} />
            <KpiTile label='Revenue Today' value={fmtMoney(s?.revenueToday)} tone='good' icon={<RecGlyph name='revenue' className='w-5 h-5' />} />
          </div>
        </>
      )}
    </PageWrap>
  )
}

export default Reports
