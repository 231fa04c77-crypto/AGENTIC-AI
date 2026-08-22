import React, { useContext, useEffect, useState } from 'react'
import { ReceptionContext } from '../../context/ReceptionContext'
import { PageWrap, RcHeader, Pill, Spinner, Avatar, EmptyState, patientName, doctorName, ReceptionTabs, RECEPTION_TAB_GROUPS } from './components'

const NoShows = () => {
  const { getNoShows } = useContext(ReceptionContext)
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  const load = async () => { const r = await getNoShows(); if (r?.success) setRows(r.appointments || []); setLoading(false) }
  useEffect(() => { load() }, [])

  return (
    <PageWrap>
      <RcHeader title='Queue' subtitle='Patients who missed their appointment'
        right={<button onClick={load} className='px-3 py-2 rounded-rd bg-rd-primary text-white text-sm font-semibold hover:bg-rd-primary-hover'>Refresh</button>} />
      <ReceptionTabs items={RECEPTION_TAB_GROUPS.queue} />
      <div className='rd-panel overflow-hidden'>
        {loading ? <Spinner /> : rows.length === 0 ? <EmptyState title='No no-shows recorded' /> : (
          <div className='overflow-x-auto'>
            <table className='w-full text-sm'>
              <thead><tr className='text-left text-[11px] uppercase tracking-wider text-rd-muted border-b border-rd-border bg-rd-canvas/60'>
                <th className='px-5 py-3 font-bold'>Patient</th><th className='px-5 py-3 font-bold'>Doctor</th><th className='px-5 py-3 font-bold'>Date</th><th className='px-5 py-3 font-bold'>Status</th>
              </tr></thead>
              <tbody>
                {rows.map((a) => (
                  <tr key={a._id} className='border-b border-rd-border '>
                    <td className='px-5 py-3'><div className='flex items-center gap-2'><Avatar name={patientName(a)} src={a.userData?.image} /><span className='font-semibold text-rd-text'>{patientName(a)}</span></div></td>
                    <td className='px-5 py-3 text-rd-muted'>{doctorName(a)}</td>
                    <td className='px-5 py-3 text-rd-muted'>{a.slotDate || '—'}</td>
                    <td className='px-5 py-3'><Pill status='NO_SHOW' /></td>
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

export default NoShows
