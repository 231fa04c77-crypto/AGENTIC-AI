import React, { useState, useEffect, useContext, useCallback, useMemo } from 'react'
import axios from 'axios'
import { toast } from 'react-toastify'
import { DoctorContext } from '../context/DoctorContext'
import PatientReportsViewer from './PatientReportsViewer'
import ReferralDoctorPicker, { doctorSpec } from './ReferralDoctorPicker'

const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition'
const labelCls = 'block text-xs font-semibold text-gray-600 mb-1.5'

const ORDER_PRESETS = {
  investigation: ['CBC', 'Blood Sugar', 'Lipid Profile', 'Thyroid Panel', 'X-Ray', 'ECG', 'Urine Test', 'Other'],
  referral: ['Cardiology', 'Orthopedics', 'Neurology', 'ENT', 'Dermatology', 'Gynecology', 'Other'],
  followup: ['General Review', 'Post-Surgery Check', 'Medication Review', 'Other'],
}

const resolvePrimaryLabel = (preset, freeText) => {
  const trimmed = freeText.trim()
  if (preset && preset !== 'Other') return preset
  if (trimmed) return trimmed
  return ''
}

const formatSlotDate = (slotDate) => {
  if (!slotDate) return 'N/A'
  const parts = slotDate.split('_')
  if (parts.length === 3) {
    const [d, m, y] = parts
    return new Date(`${y}-${m}-${d}`).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }
  return slotDate
}

const DoctorPatientHistoryModal = ({ isOpen, onClose, appointmentId, userId, patientName }) => {
  const { backendUrl, dToken, profileData } = useContext(DoctorContext)
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState(null)
  const [activeTab, setActiveTab] = useState('visits')

  // Phase 5: lazy loaded orders state
  const [orders, setOrders] = useState([])
  const [loadingOrders, setLoadingOrders] = useState(false)

  // Create order form state
  const [showOrderForm, setShowOrderForm] = useState(false)
  const [orderType, setOrderType] = useState('investigation')
  const [orderPreset, setOrderPreset] = useState('')
  const [orderNotes, setOrderNotes] = useState('')
  const [orderPriority, setOrderPriority] = useState('ROUTINE')
  const [orderDueDate, setOrderDueDate] = useState('')
  const [submittingOrder, setSubmittingOrder] = useState(false)
  const [referralSpecialization, setReferralSpecialization] = useState('ALL')
  const [referralDoctorId, setReferralDoctorId] = useState('')
  const [referralToDept, setReferralToDept] = useState('')
  const [referralReason, setReferralReason] = useState('')
  const [reviewNotes, setReviewNotes] = useState({})
  const [reviewBusyId, setReviewBusyId] = useState(null)

  const patientId = userId || data?.patient?.id

  const doctorAuthHeaders = useMemo(() => ({ dtoken: dToken }), [dToken])

  const reportLink = (id, download = false) => {
    const q = new URLSearchParams()
    if (dToken) q.set('dtoken', dToken)
    else q.set('token', dToken || '')
    if (download) q.set('download', '1')
    return `${backendUrl}/api/investigations/${id}/report?${q.toString()}`
  }

  const handleMarkReviewed = async (item) => {
    setReviewBusyId(item.id)
    try {
      const { data: res } = await axios.patch(
        `${backendUrl}/api/investigations/${item.id}`,
        {
          reportReviewStatus: 'REVIEWED',
          reviewNotes: reviewNotes[item.id] || undefined,
          status: 'REVIEWED',
        },
        { headers: { dtoken: dToken } }
      )
      if (res.success) {
        toast.success('Report marked as reviewed')
        await fetchOrders()
      } else {
        toast.error(res.message || 'Failed to mark report reviewed')
      }
    } catch (e) {
      toast.error(e.response?.data?.detail || e.message || 'Failed to mark report reviewed')
    } finally {
      setReviewBusyId(null)
    }
  }

  const fetchOrders = useCallback(async () => {
    if (!patientId) return
    setLoadingOrders(true)
    try {
      const { data: res } = await axios.get(
        `${backendUrl}/api/patients/${patientId}/orders`,
        { headers: { dtoken: dToken } }
      )
      if (res.success) {
        setOrders(res.orders)
      } else {
        toast.error(res.message || 'Failed to load patient orders')
      }
    } catch (e) {
      console.error(e)
      toast.error('Failed to load patient orders')
    } finally {
      setLoadingOrders(false)
    }
  }, [patientId, backendUrl, dToken])

  const resetOrderForm = () => {
    setShowOrderForm(false)
    setOrderType('investigation')
    setOrderPreset('')
    setOrderNotes('')
    setOrderPriority('ROUTINE')
    setOrderDueDate('')
    setReferralSpecialization('ALL')
    setReferralDoctorId('')
    setReferralToDept('')
    setReferralReason('')
  }

  const handleSelectReferralDoctor = (id, doc) => {
    setReferralDoctorId(String(id))
    setReferralToDept(doctorSpec(doc))
  }

  useEffect(() => {
    if (isOpen && (appointmentId || userId)) {
      fetchHistory()
      setActiveTab('visits')
      setOrders([])
      resetOrderForm()
    } else {
      setData(null)
      setOrders([])
      resetOrderForm()
    }
  }, [isOpen, appointmentId, userId])

  useEffect(() => {
    if (activeTab === 'orders' && patientId) {
      fetchOrders()
    }
  }, [activeTab, patientId, fetchOrders])

  const fetchHistory = async () => {
    setLoading(true)
    try {
      const url = appointmentId
        ? `${backendUrl}/api/doctor/appointments/${appointmentId}/patient-history`
        : `${backendUrl}/api/doctor/patients/${userId}/history`
      const { data: res } = await axios.get(url, { headers: { dToken } })
      if (res.success) {
        setData(res)
      } else {
        toast.error(res.message || 'Failed to load patient history')
      }
    } catch (error) {
      console.error('Error fetching patient history:', error)
      toast.error('Failed to load patient history')
    } finally {
      setLoading(false)
    }
  }

  const primaryLabel = resolvePrimaryLabel(orderPreset, orderNotes)
  const notesForSubmit = orderPreset && orderPreset !== 'Other' ? orderNotes.trim() : ''
  const canSubmitOrder =
    orderType === 'followup'
      ? Boolean(primaryLabel && orderDueDate)
      : orderType === 'referral'
      ? Boolean(referralDoctorId && referralReason.trim())
      : Boolean(primaryLabel)

  const handleCreateOrder = async (e) => {
    e.preventDefault()
    if (!patientId || !canSubmitOrder) return

    setSubmittingOrder(true)
    try {
      const headers = { dtoken: dToken }
      let res

      if (orderType === 'investigation') {
        const { data } = await axios.post(
          `${backendUrl}/api/investigations`,
          {
            patient_id: patientId,
            test_name: primaryLabel,
            priority: orderPriority,
            notes: notesForSubmit || undefined,
          },
          { headers }
        )
        res = data
      } else if (orderType === 'referral') {
        const toDept =
          referralSpecialization && referralSpecialization !== 'ALL'
            ? referralSpecialization
            : referralToDept || 'General Medicine'
        const { data } = await axios.post(
          `${backendUrl}/api/referrals`,
          {
            patient_id: patientId,
            to_dept: toDept,
            specialistDoctorId: Number(referralDoctorId),
            reason: referralReason.trim(),
            notes: orderNotes.trim() || undefined,
          },
          { headers }
        )
        res = data
      } else {
        const { data } = await axios.post(
          `${backendUrl}/api/followups`,
          {
            patient_id: patientId,
            due_date: orderDueDate,
            reason: primaryLabel,
            notes: notesForSubmit || undefined,
          },
          { headers }
        )
        res = data
      }

      if (res.success) {
        toast.success(`${orderType.charAt(0).toUpperCase() + orderType.slice(1)} order created`)
        resetOrderForm()
        await fetchOrders()
      } else {
        toast.error(res.message || 'Failed to create order')
      }
    } catch (error) {
      console.error('Error creating order:', error)
      toast.error(error.response?.data?.detail || 'Failed to create order')
    } finally {
      setSubmittingOrder(false)
    }
  }

  const handleOrderTypeChange = (type) => {
    setOrderType(type)
    setOrderPreset('')
    setOrderNotes('')
    setOrderPriority('ROUTINE')
    setOrderDueDate('')
    setReferralSpecialization('ALL')
    setReferralDoctorId('')
    setReferralToDept('')
    setReferralReason('')
  }

  if (!isOpen) return null

  const patient = data?.patient
  const pastVisits = data?.pastVisits || []
  const healthRecords = data?.healthRecords || []
  const currentVisit = data?.currentVisit
  const summary = data?.summary

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="bg-gradient-to-r from-slate-800 to-slate-700 text-white px-5 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">{patientName || patient?.name || 'Patient History'}</h2>
            <p className="text-sm text-white/70 mt-0.5">
              {summary
                ? `${summary.totalPastVisits} past visit${summary.totalPastVisits !== 1 ? 's' : ''} · ${summary.totalHealthRecords} record${summary.totalHealthRecords !== 1 ? 's' : ''}`
                : 'Past visits, prescriptions & records'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {currentVisit && (
          <div className="px-5 py-3 bg-blue-50 border-b border-blue-100 text-sm">
            <span className="font-semibold text-blue-900">Today's visit: </span>
            <span className="text-blue-800">
              {formatSlotDate(currentVisit.slotDate)} at {currentVisit.slotTime || '—'}
              {currentVisit.tokenNumber ? ` · Token #${currentVisit.tokenNumber}` : ''}
            </span>
            {currentVisit.symptoms?.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {currentVisit.symptoms.filter((s) => !String(s).startsWith('Note:')).map((s, i) => (
                  <span key={i} className="px-2 py-0.5 bg-white text-blue-700 rounded text-xs border border-blue-200">
                    {s}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="border-b border-gray-200 flex overflow-x-auto">
          {[
            { id: 'profile', label: 'Profile' },
            { id: 'visits', label: `Past Visits (${pastVisits.length})` },
            { id: 'records', label: `Medical Records (${healthRecords.length})` },
            { id: 'reports', label: 'Uploaded Reports' },
            { id: 'orders', label: `Orders & Actions${orders.length > 0 ? ` (${orders.length})` : ''}` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
            </div>
          ) : (
            <>
              {activeTab === 'profile' && patient && (
                <div className="space-y-4">
                  <div className="flex items-start gap-4">
                    {patient.image && (
                      <img
                        src={patient.image}
                        alt={patient.name}
                        className="w-20 h-20 rounded-full border-2 border-gray-200 object-cover"
                      />
                    )}
                    <div className="grid grid-cols-2 gap-3 flex-1">
                      <div>
                        <p className="text-xs text-gray-500">Name</p>
                        <p className="text-sm font-semibold">{patient.name}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Phone</p>
                        <p className="text-sm font-semibold">{patient.phone || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Gender</p>
                        <p className="text-sm font-semibold">{patient.gender || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Age</p>
                        <p className="text-sm font-semibold">
                          {patient.age || (patient.dob ? new Date().getFullYear() - new Date(patient.dob).getFullYear() : 'N/A')}
                        </p>
                      </div>
                      {patient.bloodGroup && (
                        <div>
                          <p className="text-xs text-gray-500">Blood Group</p>
                          <p className="text-sm font-semibold">{patient.bloodGroup}</p>
                        </div>
                      )}
                      {patient.relationship && patient.relationship !== 'Self' && (
                        <div>
                          <p className="text-xs text-gray-500">Relationship</p>
                          <p className="text-sm font-semibold">{patient.relationship}</p>
                        </div>
                      )}
                    </div>
                  </div>
                  {patient.completedVisits > 0 && (
                    <p className="text-sm text-gray-600">
                      Total completed visits on platform: <strong>{patient.completedVisits}</strong>
                    </p>
                  )}
                </div>
              )}

              {activeTab === 'visits' && (
                <div className="space-y-4">
                  {pastVisits.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      <p className="font-medium">No past visits with you</p>
                      <p className="text-sm mt-1">This may be the patient's first consultation.</p>
                    </div>
                  ) : (
                    pastVisits.map((visit) => (
                      <div key={visit.appointmentId} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <p className="font-semibold text-gray-900">
                              {formatSlotDate(visit.slotDate)} · {visit.slotTime || '—'}
                            </p>
                            {visit.tokenNumber && (
                              <p className="text-xs text-gray-500 mt-0.5">Token #{visit.tokenNumber}</p>
                            )}
                          </div>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            visit.isCompleted ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                          }`}>
                            {visit.isCompleted ? 'Completed' : 'Past'}
                          </span>
                        </div>

                        {visit.symptoms?.length > 0 && (
                          <div className="mb-3">
                            <p className="text-xs text-gray-500 mb-1">Symptoms reported</p>
                            <div className="flex flex-wrap gap-1">
                              {visit.symptoms.filter((s) => !String(s).startsWith('Note:')).map((s, i) => (
                                <span key={i} className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs">{s}</span>
                              ))}
                            </div>
                          </div>
                        )}

                        {visit.diagnosis && (
                          <div className="mb-2">
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Diagnosis</p>
                            <p className="text-sm text-gray-800 mt-0.5 whitespace-pre-wrap">{visit.diagnosis}</p>
                          </div>
                        )}

                        {visit.prescription && (
                          <div className="mb-2 p-3 bg-emerald-50 border border-emerald-100 rounded-lg">
                            <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-1">Prescription Given</p>
                            <p className="text-sm text-gray-800 whitespace-pre-wrap">{visit.prescription}</p>
                          </div>
                        )}

                        {visit.advice && (
                          <div className="mb-2">
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Advice</p>
                            <p className="text-sm text-gray-700 mt-0.5 whitespace-pre-wrap">{visit.advice}</p>
                          </div>
                        )}

                        {visit.notes && (
                          <div className="mb-2">
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Notes</p>
                            <p className="text-sm text-gray-600 mt-0.5 whitespace-pre-wrap">{visit.notes}</p>
                          </div>
                        )}

                        {visit.followupDate && (
                          <p className="text-xs text-blue-600 mt-2">Follow-up: {visit.followupDate}</p>
                        )}

                        {!visit.diagnosis && !visit.prescription && !visit.notes && !visit.advice && (
                          <p className="text-sm text-gray-400 italic">No clinical notes recorded for this visit.</p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === 'records' && (
                <div className="space-y-3">
                  {healthRecords.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      <p>No medical records on file</p>
                    </div>
                  ) : (
                    healthRecords.map((record) => (
                      <div key={record._id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-semibold text-gray-900">{record.title}</h4>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {record.date ? new Date(record.date).toLocaleDateString() : ''} · {record.recordType?.replace('_', ' ')}
                            </p>
                          </div>
                          {record.recordType === 'prescription' && (
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded text-xs font-medium">Rx</span>
                          )}
                        </div>
                        {record.description && (
                          <p className="text-sm text-gray-700 mt-2 whitespace-pre-wrap">{record.description}</p>
                        )}
                        {record.doctorName && (
                          <p className="text-xs text-gray-500 mt-2">By: {record.doctorName}</p>
                        )}
                        {record.files?.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {record.files.map((file, i) => (
                              <a
                                key={i}
                                href={file.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-blue-600 hover:underline"
                              >
                                {file.fileName}
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === 'reports' && appointmentId && (
                <PatientReportsViewer
                  appointmentId={appointmentId}
                  patientName={patientName || patient?.name}
                />
              )}

              {activeTab === 'orders' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm text-gray-600">Investigations, referrals, and follow-ups for this patient.</p>
                    {!showOrderForm && (
                      <button
                        type="button"
                        onClick={() => setShowOrderForm(true)}
                        disabled={!patientId}
                        className="shrink-0 px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
                      >
                        + New Order
                      </button>
                    )}
                  </div>

                  {showOrderForm && (
                    <form onSubmit={handleCreateOrder} className="border border-blue-100 bg-blue-50/50 rounded-xl p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-gray-900">Create New Order</h3>
                        <button
                          type="button"
                          onClick={resetOrderForm}
                          className="text-xs text-gray-500 hover:text-gray-700 font-medium"
                        >
                          Cancel
                        </button>
                      </div>

                      <div className="flex rounded-lg border border-gray-200 bg-white p-1 gap-1">
                        {[
                          { id: 'investigation', label: 'Investigation' },
                          { id: 'referral', label: 'Referral' },
                          { id: 'followup', label: 'Follow-up' },
                        ].map((tab) => (
                          <button
                            key={tab.id}
                            type="button"
                            onClick={() => handleOrderTypeChange(tab.id)}
                            className={`flex-1 px-3 py-2 text-xs font-semibold rounded-md transition-colors ${
                              orderType === tab.id
                                ? 'bg-blue-600 text-white shadow-sm'
                                : 'text-gray-600 hover:bg-gray-50'
                            }`}
                          >
                            {tab.label}
                          </button>
                        ))}
                      </div>

                      {orderType !== 'referral' && (
                      <div>
                        <label className={labelCls}>
                          {orderType === 'investigation' ? 'Test / Investigation' : 'Follow-up reason'}
                        </label>
                          <select
                            className={inputCls}
                            value={orderPreset}
                            onChange={(e) => setOrderPreset(e.target.value)}
                          >
                            <option value="">— Select or type below —</option>
                            {ORDER_PRESETS[orderType].map((opt) => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                      </div>
                      )}

                      {orderType === 'referral' && (
                        <ReferralDoctorPicker
                          backendUrl={backendUrl}
                          authHeaders={doctorAuthHeaders}
                          excludeDoctorId={profileData?._id ?? profileData?.id}
                          hospitalId={profileData?.hospitalId ?? profileData?.hospital_id}
                          specialization={referralSpecialization}
                          onSpecializationChange={(v) => {
                            setReferralSpecialization(v)
                            setReferralDoctorId('')
                            setReferralToDept('')
                          }}
                          selectedDoctorId={referralDoctorId}
                          onSelectDoctor={handleSelectReferralDoctor}
                        />
                      )}

                      {orderType === 'referral' && (
                          <div>
                            <label className={labelCls}>Reason for referral</label>
                            <textarea
                              className={inputCls}
                              rows={2}
                              value={referralReason}
                              onChange={(e) => setReferralReason(e.target.value)}
                              placeholder="e.g. Patient requires cardiology consultation for chest pain evaluation"
                              required
                            />
                          </div>
                      )}

                      {orderType !== 'referral' && (
                      <div>
                        <label className={labelCls}>Additional notes / custom order details</label>
                        <textarea
                          className={inputCls}
                          rows={3}
                          value={orderNotes}
                          onChange={(e) => setOrderNotes(e.target.value)}
                          placeholder={
                            orderType === 'investigation'
                              ? 'e.g. CBC + ESR, patient has fatigue — or type a fully custom test name'
                              : 'e.g. Review BP meds after dose change — or type a custom follow-up reason'
                          }
                        />
                      </div>
                      )}

                      {orderType === 'referral' && (
                        <div>
                          <label className={labelCls}>Optional notes</label>
                          <textarea
                            className={inputCls}
                            rows={2}
                            value={orderNotes}
                            onChange={(e) => setOrderNotes(e.target.value)}
                            placeholder="Priority, preferred date, or coordination notes"
                          />
                        </div>
                      )}

                      {orderType === 'investigation' && (
                        <div>
                          <label className={labelCls}>Priority</label>
                          <select
                            className={inputCls}
                            value={orderPriority}
                            onChange={(e) => setOrderPriority(e.target.value)}
                          >
                            <option value="ROUTINE">Normal</option>
                            <option value="URGENT">Urgent</option>
                          </select>
                        </div>
                      )}

                      {orderType === 'followup' && (
                        <div>
                          <label className={labelCls}>Due date</label>
                          <input
                            type="date"
                            className={inputCls}
                            value={orderDueDate}
                            min={new Date().toISOString().slice(0, 10)}
                            onChange={(e) => setOrderDueDate(e.target.value)}
                            required
                          />
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={!canSubmitOrder || submittingOrder}
                        className="w-full px-4 py-2.5 bg-slate-800 hover:bg-slate-900 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg text-sm transition-colors"
                      >
                        {submittingOrder ? 'Creating…' : 'Create Order'}
                      </button>
                    </form>
                  )}

                  {loadingOrders ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                    </div>
                  ) : orders.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      <p className="font-medium">No orders or actions recorded</p>
                      <p className="text-xs mt-1">Investigations, referrals, and follow-ups will appear here.</p>
                    </div>
                  ) : (
                    <div className="space-y-3.5">
                      {orders.map((item) => {
                        const dateStr = new Date(item.created_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })
                        
                        const getStatusStyle = (status) => {
                          const s = String(status).toUpperCase()
                          if (['COMPLETED', 'REVIEWED'].includes(s)) {
                            return 'bg-green-100 text-green-700 border-green-200'
                          }
                          if (['ACCEPTED', 'SAMPLE_COLLECTED', 'TEST_PERFORMED', 'REPORT_AVAILABLE', 'APPOINTMENT_BOOKED', 'SPECIALIST_CONSULTATION', 'REMINDED'].includes(s)) {
                            return 'bg-blue-100 text-blue-700 border-blue-200'
                          }
                          if (['ORDERED', 'PENDING', 'SCHEDULED'].includes(s)) {
                            return 'bg-amber-100 text-amber-700 border-amber-200'
                          }
                          if (s === 'OVERDUE') {
                            return 'bg-rose-100 text-rose-700 border-rose-200'
                          }
                          return 'bg-gray-100 text-gray-700 border-gray-200'
                        }

                        return (
                          <div key={`${item.type}-${item.id}`} className="border border-gray-200 rounded-xl p-4 relative overflow-hidden shadow-sm hover:shadow-md transition-shadow bg-white text-gray-800">
                            
                            {item.needsReview && (
                              <div className="mb-3 px-3 py-2 bg-rose-50 border border-rose-100 rounded-lg text-xs text-rose-700 font-semibold">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <span>⚠️ Needs your review</span>
                                  {item.report_url && (
                                    <a href={reportLink(item.id)} target="_blank" rel="noreferrer" className="underline font-bold hover:text-rose-900">
                                      View report
                                    </a>
                                  )}
                                </div>
                                <div className="mt-2 flex flex-wrap gap-2 items-center">
                                  <input
                                    type="text"
                                    placeholder="Review notes (optional)"
                                    value={reviewNotes[item.id] || ''}
                                    onChange={(e) => setReviewNotes((prev) => ({ ...prev, [item.id]: e.target.value }))}
                                    className="flex-1 min-w-[140px] border border-rose-100 rounded px-2 py-1 text-[11px]"
                                  />
                                  <button
                                    type="button"
                                    disabled={reviewBusyId === item.id}
                                    onClick={() => handleMarkReviewed(item)}
                                    className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-colors disabled:opacity-60"
                                  >
                                    {reviewBusyId === item.id ? 'Saving…' : 'Mark as Reviewed'}
                                  </button>
                                </div>
                              </div>
                            )}

                            <div className="flex items-start justify-between gap-3 mb-2">
                              <div>
                                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                                  item.type === 'investigation' ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' :
                                  item.type === 'referral' ? 'bg-sky-50 text-sky-700 border border-sky-100' :
                                  'bg-purple-50 text-purple-700 border border-purple-100'
                                }`}>
                                  {item.type}
                                </span>
                                <h4 className="font-bold text-gray-900 mt-1.5 text-sm">
                                  {item.type === 'investigation' ? item.test_name :
                                   item.type === 'referral' ? (
                                     item.specialist_name
                                       ? `Referral to ${item.specialist_name} (${item.to_dept})`
                                       : `Referral to ${item.to_dept}`
                                   ) :
                                   (item.reason || item.instructions || 'Clinical Follow-up')}
                                </h4>
                              </div>
                              <div className="flex flex-col items-end gap-1 shrink-0">
                                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${getStatusStyle(item.status)}`}>
                                  {item.status}
                                </span>
                                {item.notes && (
                                  <p className="text-[11px] text-gray-400 max-w-[200px] text-right leading-snug">{item.notes}</p>
                                )}
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3 text-xs text-gray-500 mt-3 pt-3 border-t border-gray-100">
                              <div>
                                <p className="text-[10px] uppercase font-bold text-gray-400">Date Placed</p>
                                <p className="font-medium text-gray-700 mt-0.5">{dateStr}</p>
                              </div>
                              
                              {item.type === 'investigation' && item.priority && (
                                <div>
                                  <p className="text-[10px] uppercase font-bold text-gray-400">Priority</p>
                                  <p className={`font-bold mt-0.5 ${item.priority === 'STAT' || item.priority === 'URGENT' ? 'text-rose-600' : 'text-gray-700'}`}>
                                    {item.priority}
                                  </p>
                                </div>
                              )}

                              {item.type === 'referral' && item.appointment_date && (
                                <div>
                                  <p className="text-[10px] uppercase font-bold text-gray-400">Specialist Appointment</p>
                                  <p className="font-semibold text-blue-600 mt-0.5">
                                    {new Date(item.appointment_date).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                                  </p>
                                </div>
                              )}

                              {item.type === 'followup' && item.due_date && (
                                <div>
                                  <p className="text-[10px] uppercase font-bold text-gray-400">Follow-up Due Date</p>
                                  <p className={`font-semibold mt-0.5 ${item.status === 'OVERDUE' ? 'text-rose-600' : 'text-gray-700'}`}>
                                    {new Date(item.due_date).toLocaleDateString()}
                                  </p>
                                </div>
                              )}
                            </div>

                            {item.instructions && item.type !== 'followup' && (
                              <div className="mt-3 bg-gray-50 p-2.5 rounded-lg border border-gray-100 text-xs">
                                <span className="font-semibold text-gray-600 block mb-0.5">Instructions:</span>
                                <span className="text-gray-700 italic">&ldquo;{item.instructions}&rdquo;</span>
                              </div>
                            )}

                            {item.type === 'investigation' && item.report_url && (
                              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-100 text-xs">
                                <span className="font-medium text-slate-700">Lab report:</span>
                                <span className="flex gap-2">
                                  <a href={reportLink(item.id)} target="_blank" rel="noreferrer" className="px-3 py-1 rounded bg-indigo-500 hover:bg-indigo-600 text-white font-bold transition-colors">
                                    View report
                                  </a>
                                </span>
                              </div>
                            )}

                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <div className="px-5 py-3 border-t border-gray-100 bg-gray-50">
          <button
            onClick={onClose}
            className="w-full px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-medium rounded-lg text-sm transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

export default DoctorPatientHistoryModal
