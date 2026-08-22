import React, { useContext, useEffect, useState } from 'react'
import axios from 'axios'
import { ReceptionContext } from '../../context/ReceptionContext'
import { AppContext } from '../../context/AppContext'
import { PageWrap, RcHeader, Pill, Spinner, Avatar, EmptyState } from './components'
import { toast } from 'react-toastify'
import HumanReviewModal from '../../components/HumanReviewModal'
import { submitFindingReview } from '../../utils/findingReview'

const ReferralsQueue = () => {
  const { recToken, backendUrl } = useContext(ReceptionContext)
  const { slotDateFormat } = useContext(AppContext)
  
  const [queue, setQueue] = useState([])
  const [findings, setFindings] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(null)
  
  // State for booking appointment
  const [activeBookingId, setActiveBookingId] = useState(null)
  const [appointmentDateInput, setAppointmentDateInput] = useState('')
  const [reviewFinding, setReviewFinding] = useState(null)
  const [findingReviewBusy, setFindingReviewBusy] = useState(false)

  const loadData = async () => {
    try {
      const headers = { Token: recToken }
      
      // Load referrals queue
      const resQueue = await axios.get(`${backendUrl}/api/referrals/queue`, { headers })
      if (resQueue.data.success) setQueue(resQueue.data.queue)

      // Load open coordinator findings
      const resFindings = await axios.get(`${backendUrl}/api/findings?assigned_role=referral_coordinator`, { headers })
      if (resFindings.data.success) setFindings(resFindings.data.findings)
      
    } catch (e) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (recToken) loadData()
  }, [recToken])

  const transitionStatus = async (id, newStatus, extra = {}) => {
    setBusy(id)
    try {
      const { data } = await axios.patch(
        `${backendUrl}/api/referrals/${id}`,
        { status: newStatus, ...extra },
        { headers: { Token: recToken } }
      )
      if (data.success) {
        toast.success(`Referral updated to ${newStatus}`)
        await loadData()
      } else {
        toast.error(data.message || 'Failed to update referral')
      }
    } catch (e) {
      toast.error(e.message)
    } finally {
      setBusy(null)
      setActiveBookingId(null)
      setAppointmentDateInput('')
    }
  }

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

  const handleBookAppointment = (id) => {
    if (!appointmentDateInput) {
      toast.warn('Please select a valid appointment date')
      return
    }
    const isoDateTime = new Date(appointmentDateInput).toISOString()
    transitionStatus(id, 'APPOINTMENT_BOOKED', { appointmentDate: isoDateTime })
  }

  return (
    <PageWrap>
      <RcHeader 
        title='Referrals Coordination Hub' 
        subtitle='Accept clinical referrals, coordinate specialist consultations, and address SLA alerts.'
        right={
          <button 
            onClick={() => { setLoading(true); loadData(); }} 
            className='px-4 py-2 rounded-xl bg-rd-primary text-white text-sm font-semibold hover:bg-rd-primary-hover shadow-sm transition-colors'
          >
            Refresh Hub
          </button>
        }
      />

      <div className='grid grid-cols-1 lg:grid-cols-12 gap-6'>
        
        {/* Main Referrals Queue */}
        <div className='lg:col-span-8 space-y-4'>
          <div className='rd-panel overflow-hidden border border-rd-border rounded-2xl bg-rd-surface'>
            <div className='px-5 py-4 border-b border-rd-border'>
              <h3 className='text-sm font-bold text-rd-text'>Active Referral Orders</h3>
            </div>
            
            {loading ? (
              <Spinner />
            ) : queue.length === 0 ? (
              <EmptyState title='No active referrals' sub='All patient referral requests are processed.' />
            ) : (
              <div className='overflow-x-auto'>
                <table className='w-full text-sm text-left border-collapse'>
                  <thead>
                    <tr className='text-left text-[11px] uppercase tracking-wider text-rd-muted border-b border-rd-border bg-rd-canvas/60'>
                      <th className='px-5 py-3 font-bold'>Patient</th>
                      <th className='px-5 py-3 font-bold'>Routing</th>
                      <th className='px-5 py-3 font-bold'>Reason</th>
                      <th className='px-5 py-3 font-bold'>Status</th>
                      <th className='px-5 py-3 font-bold text-right'>Action</th>
                    </tr>
                  </thead>
                  <tbody className='divide-y divide-rd-border'>
                    {queue.map((item) => {
                      const patientName = item.patient_name || 'Patient'
                      const doctorName = item.doctor_name || 'Doctor'
                      
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
                          <td className='px-5 py-4'>
                            <span className='font-medium text-rd-text block'>To: {item.to_dept}</span>
                            <span className='text-xs text-rd-muted'>From: {item.from_dept || 'General OPD'} · {doctorName}</span>
                          </td>
                          <td className='px-5 py-4'>
                            <span className='text-xs text-rd-text block max-w-xs truncate' title={item.reason}>{item.reason}</span>
                          </td>
                          <td className='px-5 py-4'>
                            <Pill status={item.status === 'PENDING' ? 'REFERRED' : item.status === 'APPOINTMENT_BOOKED' ? 'APPOINTMENT SCHEDULED' : item.status} />
                          </td>
                          <td className='px-5 py-4 text-right'>
                            {busy === item.id ? (
                              <span className='text-xs text-rd-muted animate-pulse'>Updating…</span>
                            ) : activeBookingId === item.id ? (
                              <div className='flex flex-col gap-2 items-end max-w-xs ml-auto'>
                                <input 
                                  type='datetime-local' 
                                  value={appointmentDateInput}
                                  onChange={(e) => setAppointmentDateInput(e.target.value)}
                                  className='px-3 py-1.5 rounded-lg border border-rd-border bg-rd-canvas text-xs w-full focus:outline-none focus:border-rd-primary text-rd-text'
                                />
                                <div className='flex gap-1.5'>
                                  <button 
                                    onClick={() => setActiveBookingId(null)}
                                    className='px-2.5 py-1 rounded-lg border border-rd-border text-rd-muted text-[11px] font-semibold hover:bg-rd-canvas'
                                  >
                                    Cancel
                                  </button>
                                  <button 
                                    onClick={() => handleBookAppointment(item.id)}
                                    className='px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-[11px] font-semibold'
                                  >
                                    Confirm Slot
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className='flex justify-end gap-2'>
                                {item.status === 'PENDING' && (
                                  <button 
                                    onClick={() => transitionStatus(item.id, 'ACCEPTED')}
                                    className='px-3 py-1.5 rounded-xl bg-rd-primary text-white text-xs font-bold hover:bg-rd-primary-hover shadow-sm'
                                  >
                                    ✓ Accept
                                  </button>
                                )}
                                {item.status === 'ACCEPTED' && (
                                  <button 
                                    onClick={() => {
                                      setActiveBookingId(item.id)
                                      setAppointmentDateInput('')
                                    }}
                                    className='px-3 py-1.5 rounded-xl bg-amber-500 text-white text-xs font-bold hover:bg-amber-600 shadow-sm'
                                  >
                                    📅 Book Specialist Slot
                                  </button>
                                )}
                                {item.status === 'APPOINTMENT_BOOKED' && (
                                  <button 
                                    onClick={() => transitionStatus(item.id, 'COMPLETED')}
                                    className='px-3 py-1.5 rounded-xl bg-emerald-500 text-white text-xs font-bold hover:bg-emerald-600 shadow-sm'
                                  >
                                    Complete Referral
                                  </button>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* AI Findings Alerts Sidebar */}
        <div className='lg:col-span-4 space-y-4'>
          <div className='rd-panel border border-rd-border rounded-2xl bg-rd-surface p-5'>
            <h3 className='text-sm font-bold text-rd-text mb-1.5 flex items-center gap-2'>
              <span className='w-2 h-2 rounded-full bg-rose-500 animate-pulse' />
              AI Agent Alert Findings
            </h3>
            <p className='text-xs text-rd-muted mb-4'>Real-time workflow SLA breaches identified by Medclues AI monitoring.</p>

            {findings.length === 0 ? (
              <div className='text-center py-8 bg-rd-canvas/30 rounded-xl border border-dashed border-rd-border'>
                <p className='text-xs text-rd-muted font-medium'>No active SLA breaches detected</p>
              </div>
            ) : (
              <div className='space-y-3 max-h-[500px] overflow-y-auto pr-1'>
                {findings.map((finding) => (
                  <div key={finding.id} className='p-4 rounded-xl border border-rd-border bg-rd-canvas/40 flex flex-col gap-2.5 relative overflow-hidden shadow-sm'>
                    <div className='absolute left-0 top-0 bottom-0 w-1 bg-rose-500' />
                    <div className='flex items-start justify-between gap-2'>
                      <span className='px-1.5 py-0.5 rounded text-[10px] font-black tracking-wide uppercase bg-rose-50 text-rose-600 border border-rose-100'>
                        {finding.priority} SLA Breach
                      </span>
                      <span className='text-[10px] text-rd-muted'>
                        {new Date(finding.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className='text-xs font-medium text-rd-text leading-relaxed'>{finding.message}</p>
                    <div className='flex justify-between items-center pt-1 border-t border-rd-border/60'>
                      <span className='text-[10px] text-rd-muted font-bold'>Patient: {finding.patient_name}</span>
                      <button 
                        onClick={() => setReviewFinding(finding)}
                        className='px-2.5 py-1 rounded-lg bg-rd-primary text-white text-[10px] font-bold hover:bg-rd-primary-hover shadow-sm transition-colors'
                      >
                        Review Finding
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>

      {reviewFinding && (
        <HumanReviewModal
          finding={reviewFinding}
          patientName={reviewFinding.patient_name}
          reviewerName="Referral coordinator"
          journeyEvidence={[]}
          busy={findingReviewBusy}
          onClose={() => setReviewFinding(null)}
          onSubmit={(decision, comment, mods) => handleFindingReview(reviewFinding.id, decision, comment, mods)}
        />
      )}
    </PageWrap>
  )
}

export default ReferralsQueue
