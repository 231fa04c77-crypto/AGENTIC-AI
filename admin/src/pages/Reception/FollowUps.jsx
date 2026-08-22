import React, { useContext, useEffect, useState } from 'react'
import { ReceptionContext } from '../../context/ReceptionContext'
import { PageWrap, RcHeader, Pill, Spinner, Avatar, EmptyState, patientName, doctorName, ReceptionTabs, RECEPTION_TAB_GROUPS } from './components'

const FollowUps = () => {
  const { getFollowups, useFollowup } = useContext(ReceptionContext)
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(null)

  const load = async () => { const r = await getFollowups(); if (r?.success) setRows(r.appointments || []); setLoading(false) }
  useEffect(() => { load() }, [])

  const act = async (id) => { setBusy(id); const r = await useFollowup(id); if (r?.success) await load(); setBusy(null) }

  return (
    <PageWrap>
      <RcHeader title='Patients' subtitle='Patients eligible for a follow-up visit'
        right={<button onClick={load} className='px-3 py-2 rounded-rd bg-rd-primary text-white text-sm font-semibold hover:bg-rd-primary-hover'>Refresh</button>} />
      <ReceptionTabs items={RECEPTION_TAB_GROUPS.patients} />
      <div className='rd-panel overflow-hidden'>
        {loading ? <Spinner /> : rows.length === 0 ? <EmptyState title='No follow-ups available' /> : (
          <div className='overflow-x-auto'>
            <table className='w-full text-sm'>
              <thead><tr className='text-left text-[11px] uppercase tracking-wider text-rd-muted border-b border-rd-border bg-rd-canvas/60'>
                <th className='px-5 py-3 font-bold'>Patient</th><th className='px-5 py-3 font-bold'>Doctor</th><th className='px-5 py-3 font-bold'>Remaining</th><th className='px-5 py-3 font-bold'>Status</th><th className='px-5 py-3 font-bold text-right'>Action</th>
              </tr></thead>
              <tbody>
                {rows.map((a) => {
                  const v = a.verification || {}
                  return (
                    <tr key={a._id} className='border-b border-rd-border '>
                      <td className='px-5 py-3'><div className='flex items-center gap-2'><Avatar name={patientName(a)} src={a.userData?.image} /><span className='font-semibold text-rd-text'>{patientName(a)}</span></div></td>
                      <td className='px-5 py-3 text-rd-muted'>{doctorName(a)}</td>
                      <td className='px-5 py-3 text-rd-muted'>{v.followupRemaining ?? 0}</td>
                      <td className='px-5 py-3'><Pill status={v.followupAvailable ? 'ELIGIBLE' : 'USED'} /></td>
                      <td className='px-5 py-3 text-right'>
                        <button disabled={busy === a._id || !v.followupAvailable} onClick={() => act(a._id)} className='px-3 py-1.5 rounded-rd bg-rd-primary text-white text-xs font-bold hover:bg-rd-primary-hover disabled:opacity-40'>Use Follow-up</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PageWrap>
  )
}

export default FollowUps
