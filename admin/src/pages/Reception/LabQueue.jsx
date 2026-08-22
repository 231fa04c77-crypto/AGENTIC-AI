import React, { useContext, useEffect, useRef, useState } from 'react'
import axios from 'axios'
import { ReceptionContext } from '../../context/ReceptionContext'
import { PageWrap, RcHeader, Pill, Spinner, Avatar, EmptyState } from './components'
import { toast } from 'react-toastify'

const labBucket = (status) => {
  const s = String(status || '').toUpperCase()
  if (s === 'ORDERED') return 'ORDERED'
  if (['ACCEPTED', 'SAMPLE_COLLECTED', 'TEST_PERFORMED'].includes(s)) return 'IN PROGRESS'
  if (['REPORT_AVAILABLE', 'REVIEWED'].includes(s)) return 'COMPLETED'
  return s || '—'
}

const LabQueue = () => {
  const { recToken, backendUrl } = useContext(ReceptionContext)

  const [queue, setQueue] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(null)
  const [uploadTargetId, setUploadTargetId] = useState(null)
  const fileRef = useRef(null)

  const headers = { Token: recToken }

  const reportLink = (id, download = false) => {
    const q = new URLSearchParams({ token: recToken || '' })
    if (download) q.set('download', '1')
    return `${backendUrl}/api/investigations/${id}/report?${q.toString()}`
  }

  const loadQueue = async () => {
    try {
      const { data } = await axios.get(`${backendUrl}/api/lab/queue`, { headers })
      if (data.success) setQueue(data.queue)
      else toast.error(data.message || 'Failed to load lab queue')
    } catch (e) {
      toast.error(e.response?.data?.detail || e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (recToken) loadQueue()
  }, [recToken])

  const patchStatus = async (id, newStatus, successMsg) => {
    setBusy(id)
    try {
      const { data } = await axios.patch(
        `${backendUrl}/api/investigations/${id}`,
        { status: newStatus },
        { headers }
      )
      if (data.success) {
        toast.success(successMsg || `Status updated to ${newStatus}`)
        await loadQueue()
      } else {
        toast.error(data.message || 'Update failed')
      }
    } catch (e) {
      toast.error(e.response?.data?.detail || e.message)
    } finally {
      setBusy(null)
    }
  }

  const uploadReport = async (id, file) => {
    if (!file) return
    setBusy(id)
    try {
      const form = new FormData()
      form.append('file', file)
      const { data } = await axios.post(
        `${backendUrl}/api/investigations/${id}/report`,
        form,
        { headers: { ...headers, 'Content-Type': 'multipart/form-data' } }
      )
      if (data.success) {
        toast.success(data.message || 'Report uploaded successfully')
        setUploadTargetId(null)
        await loadQueue()
      } else {
        toast.error(data.message || 'Upload failed')
      }
    } catch (e) {
      toast.error(e.response?.data?.detail || e.message)
    } finally {
      setBusy(null)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const publishReport = async (id) => {
    setBusy(id)
    try {
      const { data } = await axios.post(`${backendUrl}/api/investigations/${id}/publish`, {}, { headers })
      if (data.success) {
        toast.success(data.message || 'Report published successfully')
        await loadQueue()
      } else {
        toast.error(data.message || 'Publish failed')
      }
    } catch (e) {
      toast.error(e.response?.data?.detail || e.message)
    } finally {
      setBusy(null)
    }
  }

  const renderActions = (item) => {
    const st = String(item.status || '').toUpperCase()
    const hasUploadedReport = Boolean(item.report_url) && st === 'TEST_PERFORMED'

    if (busy === item.id) {
      return <span className='text-xs text-rd-muted animate-pulse'>Processing…</span>
    }

    if (st === 'ORDERED') {
      return (
        <button
          type='button'
          onClick={() => patchStatus(item.id, 'ACCEPTED', 'Investigation accepted successfully.')}
          className='px-3 py-1.5 rounded-xl bg-rd-primary text-white text-xs font-bold hover:bg-rd-primary-hover shadow-sm'
        >
          Accept
        </button>
      )
    }

    if (st === 'ACCEPTED' || st === 'SAMPLE_COLLECTED') {
      return (
        <button
          type='button'
          onClick={() => patchStatus(item.id, 'TEST_PERFORMED', 'Test marked as performed.')}
          className='px-3 py-1.5 rounded-xl bg-indigo-500 text-white text-xs font-bold hover:bg-indigo-600 shadow-sm'
        >
          Mark Test Performed
        </button>
      )
    }

    if (st === 'TEST_PERFORMED' && !hasUploadedReport) {
      return (
        <div className='flex flex-col items-end gap-2 max-w-xs ml-auto'>
          <input
            ref={uploadTargetId === item.id ? fileRef : null}
            type='file'
            accept='.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png'
            className='text-xs w-full'
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) uploadReport(item.id, f)
            }}
          />
          <span className='text-[10px] text-rd-muted'>PDF, JPG, or PNG (max 10 MB)</span>
        </div>
      )
    }

    if (st === 'TEST_PERFORMED' && hasUploadedReport) {
      return (
        <div className='flex flex-col items-end gap-1.5'>
          <a href={reportLink(item.id)} target='_blank' rel='noreferrer' className='text-[10px] text-indigo-600 font-bold'>
            Preview uploaded file
          </a>
          <button
            type='button'
            onClick={() => publishReport(item.id)}
            className='px-3 py-1.5 rounded-xl bg-emerald-500 text-white text-xs font-bold hover:bg-emerald-600 shadow-sm'
          >
            Publish
          </button>
        </div>
      )
    }

    if (st === 'REPORT_AVAILABLE' || st === 'REVIEWED') {
      return item.report_url ? (
        <a
          href={reportLink(item.id)}
          target='_blank'
          rel='noreferrer'
          className='px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200'
        >
          View Report
        </a>
      ) : (
        <span className='text-xs text-rd-muted'>No file</span>
      )
    }

    return null
  }

  return (
    <PageWrap>
      <RcHeader
        title='Lab Staff Worklist'
        subtitle='Manage patient investigation orders, sample collection, and pathology test publishing.'
        right={
          <button
            type='button'
            onClick={() => { setLoading(true); loadQueue() }}
            className='px-4 py-2 rounded-xl bg-rd-primary text-white text-sm font-semibold hover:bg-rd-primary-hover shadow-sm transition-colors'
          >
            Refresh Queue
          </button>
        }
      />

      <div className='rd-panel overflow-hidden border border-rd-border rounded-2xl bg-rd-surface'>
        {loading ? (
          <Spinner />
        ) : queue.length === 0 ? (
          <EmptyState title='No active laboratory investigations' sub='Doctor orders will appear here automatically.' />
        ) : (
          <div className='overflow-x-auto'>
            <table className='w-full text-sm text-left border-collapse'>
              <thead>
                <tr className='text-left text-[11px] uppercase tracking-wider text-rd-muted border-b border-rd-border bg-rd-canvas/60'>
                  <th className='px-5 py-3 font-bold'>Patient</th>
                  <th className='px-5 py-3 font-bold'>Patient ID</th>
                  <th className='px-5 py-3 font-bold'>Order Details</th>
                  <th className='px-5 py-3 font-bold'>Doctor / Priority</th>
                  <th className='px-5 py-3 font-bold'>Ordered</th>
                  <th className='px-5 py-3 font-bold'>Status</th>
                  <th className='px-5 py-3 font-bold text-right'>Workflow Action</th>
                </tr>
              </thead>
              <tbody className='divide-y divide-rd-border'>
                {queue.map((item) => {
                  const patientName = item.patient_name || 'Patient'
                  const doctorName = item.doctor_name || 'Doctor'
                  const isUrgent = item.priority === 'URGENT' || item.priority === 'STAT'
                  return (
                    <tr key={item.id} className='hover:bg-rd-canvas/30 transition-colors'>
                      <td className='px-5 py-4'>
                        <div className='flex items-center gap-3'>
                          <Avatar name={patientName} src={item.patient_image} />
                          <div>
                            <span className='font-semibold text-rd-text block'>{patientName}</span>
                            <span className='text-xs text-rd-muted'>{item.patient_phone || '—'}</span>
                          </div>
                        </div>
                      </td>
                      <td className='px-5 py-4 text-xs font-mono text-rd-muted'>#{item.patient_id}</td>
                      <td className='px-5 py-4'>
                        <span className='font-medium text-rd-text block'>{item.test_name}</span>
                        {item.notes && <span className='text-xs text-rd-muted italic'>&ldquo;{item.notes}&rdquo;</span>}
                      </td>
                      <td className='px-5 py-4'>
                        <span className='font-medium text-rd-text block'>{doctorName}</span>
                        <span className={`text-xs font-bold uppercase ${isUrgent ? 'text-rose-500' : 'text-slate-400'}`}>
                          {item.priority}
                        </span>
                      </td>
                      <td className='px-5 py-4 text-xs text-rd-muted'>
                        {item.created_at ? new Date(item.created_at).toLocaleDateString() : '—'}
                      </td>
                      <td className='px-5 py-4'>
                        <Pill status={labBucket(item.status)} />
                        <span className='block text-[10px] text-rd-muted mt-1'>{item.status}</span>
                      </td>
                      <td className='px-5 py-4 text-right'>{renderActions(item)}</td>
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

export default LabQueue
