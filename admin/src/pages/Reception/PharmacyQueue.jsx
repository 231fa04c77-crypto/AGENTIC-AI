import React, { useContext, useEffect, useState } from 'react'
import axios from 'axios'
import { ReceptionContext } from '../../context/ReceptionContext'
import { PageWrap, RcHeader, Pill, Spinner, EmptyState } from './components'
import { toast } from 'react-toastify'
import HumanReviewModal from '../../components/HumanReviewModal'
import { submitFindingReview } from '../../utils/findingReview'

const statusLabel = (status) => {
  const s = String(status || '').toLowerCase()
  if (s === 'placed') return 'ORDER PLACED'
  if (s === 'billed') return 'PAYMENT PENDING'
  if (s === 'ready') return 'READY FOR PICKUP'
  if (s === 'paid') return 'PAID'
  if (s === 'delivered') return 'DELIVERED'
  return (status || '—').toUpperCase()
}

const PharmacyQueue = () => {
  const { recToken, backendUrl } = useContext(ReceptionContext)

  const [findings, setFindings] = useState([])
  const [loading, setLoading] = useState(true)
  const [reviewFinding, setReviewFinding] = useState(null)
  const [findingReviewBusy, setFindingReviewBusy] = useState(false)

  const loadData = async () => {
    try {
      const headers = { Token: recToken }
      const resFindings = await axios.get(`${backendUrl}/api/findings?assigned_role=pharmacy_coordinator`, { headers })
      if (resFindings.data.success) setFindings(resFindings.data.findings)
    } catch (e) {
      toast.error(e.response?.data?.detail || e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (recToken) loadData()
  }, [recToken])

  const handleFindingReview = async (findingId, decision, comment, modifications = {}) => {
    setFindingReviewBusy(true)
    try {
      const data = await submitFindingReview(
        backendUrl,
        { Token: recToken },
        findingId,
        decision,
        comment,
        modifications
      )
      if (data.success) {
        toast.success(data.resolved ? 'Finding reviewed and resolved' : 'Human review recorded')
        setReviewFinding(null)
        await loadData()
      } else {
        toast.error(data.message || 'Review failed')
      }
    } catch (e) {
      toast.error(e.response?.data?.detail || e.message)
    } finally {
      setFindingReviewBusy(false)
    }
  }

  return (
    <PageWrap>
      <RcHeader
        title='Pharmacy Coordination Hub'
        subtitle='Review AI pharmacy findings — order acceptance, payment, and pickup coordination.'
        right={
          <button
            onClick={() => { setLoading(true); loadData() }}
            className='px-4 py-2 rounded-xl bg-rd-primary text-white text-sm font-semibold hover:bg-rd-primary-hover shadow-sm transition-colors'
          >
            Refresh Hub
          </button>
        }
      />

      <div className='rd-panel overflow-hidden border border-rd-border rounded-2xl bg-rd-surface'>
        <div className='px-5 py-4 border-b border-rd-border'>
          <h3 className='text-sm font-bold text-rd-text'>AI Pharmacy Findings</h3>
          <p className='text-xs text-rd-muted mt-1'>Approve to notify the patient; reject to dismiss if already handled.</p>
        </div>

        {loading ? (
          <Spinner />
        ) : findings.length === 0 ? (
          <EmptyState title='No open pharmacy findings' sub='All pharmacy orders are on track.' />
        ) : (
          <div className='divide-y divide-rd-border'>
            {findings.map((f) => {
              const ev = f.evidence || {}
              return (
                <div key={f.id} className='px-5 py-4 hover:bg-rd-canvas/30 transition-colors'>
                  <div className='flex flex-wrap items-start justify-between gap-3'>
                    <div className='min-w-0 flex-1'>
                      <div className='flex items-center gap-2 flex-wrap mb-1'>
                        <span className={`text-[10px] font-black uppercase ${f.priority === 'HIGH' ? 'text-rose-600' : f.priority === 'MEDIUM' ? 'text-amber-600' : 'text-sky-600'}`}>
                          {f.priority === 'HIGH' ? '🔴' : f.priority === 'MEDIUM' ? '🟠' : '🔵'} {String(f.finding_type || '').replaceAll('_', ' ')}
                        </span>
                        {ev.status && <Pill status={statusLabel(ev.status)} />}
                      </div>
                      <p className='text-sm font-semibold text-rd-text'>{ev.patient || `Patient #${f.patient_id}`}</p>
                      <p className='text-xs text-rd-muted mt-0.5'>
                        {ev.pharmacy ? `${ev.pharmacy} · ` : ''}
                        Order {ev.public_id || ev.order_id || f.entity_id}
                      </p>
                      <p className='text-sm text-rd-text mt-2'>{f.message}</p>
                      {f.recommended_action && (
                        <p className='text-xs text-indigo-700 mt-1 font-semibold'>AI recommendation: {f.recommended_action}</p>
                      )}
                    </div>
                    <button
                      type='button'
                      onClick={() => setReviewFinding(f)}
                      className='px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold shrink-0'
                    >
                      Review Finding
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <HumanReviewModal
        open={Boolean(reviewFinding)}
        finding={reviewFinding}
        busy={findingReviewBusy}
        onClose={() => setReviewFinding(null)}
        onSubmit={handleFindingReview}
      />
    </PageWrap>
  )
}

export default PharmacyQueue
