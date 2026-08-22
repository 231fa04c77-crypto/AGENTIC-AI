import React, { useContext, useEffect, useState } from 'react'
import axios from 'axios'
import { AdminContext } from '../../context/AdminContext'
import { DeskPage, DeskHeader, DeskCard } from '../../components/desk/DeskChrome'
import { toast } from 'react-toastify'

const SloDashboard = () => {
  const { aToken } = useContext(AdminContext)
  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000'
  const [loading, setLoading] = useState(true)
  const [payload, setPayload] = useState(null)

  const load = async () => {
    if (!aToken) return
    setLoading(true)
    try {
      const { data } = await axios.get(`${backendUrl}/api/ops/slo`, {
        headers: { aToken },
      })
      if (data.success) setPayload(data)
      else toast.error(data.message || 'Failed to load SLO snapshot')
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Failed to load SLO')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [aToken, backendUrl])

  const checks = payload?.checks || {}
  const slos = payload?.slos || {}

  return (
    <DeskPage>
      <DeskHeader
        title='SLO & Health'
        subtitle='Availability targets and dependency checks (Prometheus: /metrics)'
        right={
          <button
            type='button'
            onClick={load}
            className='px-3 py-1.5 text-sm rounded-md bg-rd-primary text-white'
          >
            Refresh
          </button>
        }
      />
      {loading && !payload ? (
        <p className='text-rd-muted text-sm'>Loading…</p>
      ) : (
        <div className='grid gap-4 md:grid-cols-2'>
          <DeskCard className='p-4'>
            <h2 className='text-sm font-semibold mb-3'>SLO targets</h2>
            <ul className='text-sm space-y-2'>
              <li>Availability: {slos.availability_target || '—'}</li>
              <li>Booking p95: {slos.booking_p95_target_ms ?? '—'} ms</li>
              <li>Queue p95: {slos.queue_p95_target_ms ?? '—'} ms</li>
              <li>RPO: {slos.rpo_minutes ?? '—'} min · RTO: {slos.rto_minutes ?? '—'} min</li>
            </ul>
            <p className='text-xs text-rd-muted mt-3'>
              Scrape {payload?.scrape || '/metrics'} · Deep {payload?.deep_health || '/health/deep'}
            </p>
          </DeskCard>
          <DeskCard className='p-4'>
            <h2 className='text-sm font-semibold mb-3'>Live checks</h2>
            <ul className='text-sm space-y-2 font-mono'>
              {Object.entries(checks).map(([k, v]) => (
                <li key={k} className='flex justify-between gap-2'>
                  <span className='text-rd-muted'>{k}</span>
                  <span>{String(v)}</span>
                </li>
              ))}
            </ul>
          </DeskCard>
        </div>
      )}
    </DeskPage>
  )
}

export default SloDashboard
