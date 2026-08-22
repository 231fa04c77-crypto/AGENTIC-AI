import React, { useState, useEffect, useContext, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { toast } from 'react-toastify'
import { DoctorContext } from '../../context/DoctorContext'
import PatientReportsViewer from '../../components/PatientReportsViewer'

const formatSlotDate = (slotDate) => {
  if (!slotDate) return '—'
  const parts = slotDate.split('_')
  if (parts.length === 3) {
    const [d, m, y] = parts
    return new Date(`${y}-${m}-${d}`).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
  }
  return slotDate
}

const Field = ({ label, required, children }) => (
  <label className="block">
    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
      {label}{required ? ' *' : ''}
    </span>
    <div className="mt-1.5">{children}</div>
  </label>
)

const inputCls =
  'w-full text-sm border border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none resize-y bg-white'

const TABS = [
  { id: 'profile', label: 'Profile' },
  { id: 'past', label: 'Past Visits' },
  { id: 'present', label: 'Present Visit' },
]

const DoctorConsultation = () => {
  const { appointmentId } = useParams()
  const navigate = useNavigate()
  const { dToken, backendUrl, completeAppointment } = useContext(DoctorContext)

  const [activeTab, setActiveTab] = useState('present')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [ending, setEnding] = useState(false)
  const [lastSaved, setLastSaved] = useState(null)
  const [patientHistory, setPatientHistory] = useState(null)
  const [appointment, setAppointment] = useState(null)

  const [diagnosis, setDiagnosis] = useState('')
  const [tablets, setTablets] = useState('')
  const [prescription, setPrescription] = useState('')
  const [notes, setNotes] = useState('')
  const [advice, setAdvice] = useState('')
  const [followupDate, setFollowupDate] = useState('')

  const saveTimer = useRef(null)
  const initialLoad = useRef(true)

  const loadData = useCallback(async () => {
    if (!dToken || !appointmentId) return
    setLoading(true)
    try {
      const headers = { dToken }
      const [aptRes, consultRes, historyRes] = await Promise.all([
        axios.get(`${backendUrl}/api/doctor/appointments/${appointmentId}`, { headers }),
        axios.get(`${backendUrl}/api/doctor/appointments/${appointmentId}/consultation`, { headers }),
        axios.get(`${backendUrl}/api/doctor/appointments/${appointmentId}/patient-history`, { headers }),
      ])

      if (aptRes.data.success) setAppointment(aptRes.data.appointment)
      if (historyRes.data.success) setPatientHistory(historyRes.data)

      if (consultRes.data.success) {
        const c = consultRes.data.consultation || {}
        setDiagnosis(c.diagnosis || '')
        setTablets(c.tablets || '')
        setPrescription(c.prescription || '')
        setNotes(c.notes || '')
        setAdvice(c.advice || '')
        setFollowupDate(c.followupDate ? String(c.followupDate).slice(0, 10) : '')
      }

      await axios.post(
        `${backendUrl}/api/doctor/start-consultation`,
        { appointmentId },
        { headers }
      )
    } catch (err) {
      console.error(err)
      toast.error('Failed to load consultation')
    } finally {
      setLoading(false)
      initialLoad.current = false
    }
  }, [dToken, backendUrl, appointmentId])

  useEffect(() => {
    loadData()
  }, [loadData])

  const saveDraft = useCallback(
    async (silent = true) => {
      if (!dToken || initialLoad.current) return
      setSaving(true)
      try {
        const { data } = await axios.post(
          `${backendUrl}/api/doctor/appointments/${appointmentId}/save-consultation`,
          { diagnosis, tablets, prescription, notes, advice, followupDate: followupDate || undefined },
          { headers: { dToken } }
        )
        if (data.success) {
          setLastSaved(new Date())
          if (!silent) toast.success('Saved')
        }
      } catch {
        if (!silent) toast.error('Save failed')
      } finally {
        setSaving(false)
      }
    },
    [dToken, backendUrl, appointmentId, diagnosis, tablets, prescription, notes, advice, followupDate]
  )

  useEffect(() => {
    if (initialLoad.current || loading) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => saveDraft(true), 1500)
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [diagnosis, tablets, prescription, notes, advice, followupDate, loading, saveDraft])

  const handleEndConsultation = async () => {
    if (!tablets.trim() && !prescription.trim()) {
      toast.error('Please enter tablets or prescription before ending consultation')
      setActiveTab('present')
      return
    }
    setEnding(true)
    await saveDraft(true)
    const ok = await completeAppointment(appointmentId, {
      diagnosis: diagnosis.trim() || undefined,
      tablets: tablets.trim() || undefined,
      prescription: prescription.trim() || undefined,
      notes: notes.trim() || undefined,
      advice: advice.trim() || undefined,
      followupDate: followupDate || undefined,
    })
    setEnding(false)
    if (ok) {
      toast.success('Consultation completed — prescription sent to patient app')
      navigate(-1)
    }
  }

  const patient = patientHistory?.patient
  const currentVisit = patientHistory?.currentVisit
  const pastVisits = patientHistory?.pastVisits || []
  const symptoms = currentVisit?.symptoms?.filter((s) => !String(s).startsWith('Note:')) || []
  const patientName = patient?.name || appointment?.userData?.name || 'Patient'
  const patientImage = patient?.image || appointment?.userData?.image

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
      </div>
    )
  }

  return (
    <div className="w-full max-w-6xl mx-auto p-4 sm:p-6 pb-12">
      {/* Top bar */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 shrink-0"
              aria-label="Back to queue"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            {patientImage && (
              <img src={patientImage} alt="" className="w-12 h-12 rounded-full object-cover ring-2 ring-indigo-100 shrink-0" />
            )}
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-slate-900 truncate">{patientName}</h1>
              <p className="text-sm text-slate-500">
                Token #{currentVisit?.tokenNumber || '—'} · {formatSlotDate(currentVisit?.slotDate)} ·{' '}
                {currentVisit?.slotTime || '—'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {saving && <span className="text-xs text-slate-400">Saving…</span>}
            {!saving && lastSaved && (
              <span className="text-xs text-emerald-600 hidden sm:inline">Auto-saved {lastSaved.toLocaleTimeString()}</span>
            )}
            <button
              type="button"
              onClick={handleEndConsultation}
              disabled={ending}
              className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold rounded-xl shadow-sm disabled:opacity-50"
            >
              {ending ? 'Completing…' : 'End Consultation'}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-5 border-b border-slate-100 -mb-px overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 text-sm font-semibold whitespace-nowrap rounded-t-lg transition-colors ${
                activeTab === tab.id
                  ? 'text-indigo-700 bg-indigo-50 border-b-2 border-indigo-600'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
              }`}
            >
              {tab.label}
              {tab.id === 'past' && pastVisits.length > 0 && (
                <span className="ml-1.5 text-xs bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded-full">{pastVisits.length}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Profile */}
      {activeTab === 'profile' && patient && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex flex-col sm:flex-row gap-6">
            {patientImage && (
              <img src={patientImage} alt={patientName} className="w-24 h-24 rounded-2xl object-cover ring-2 ring-slate-100" />
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1">
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wide">Full Name</p>
                <p className="font-semibold text-slate-900 mt-0.5">{patient.name}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wide">Phone</p>
                <p className="font-semibold text-slate-900 mt-0.5">{patient.phone || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wide">Email</p>
                <p className="font-semibold text-slate-900 mt-0.5 truncate">{patient.email || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wide">Gender</p>
                <p className="font-semibold text-slate-900 mt-0.5">{patient.gender || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wide">Age</p>
                <p className="font-semibold text-slate-900 mt-0.5">
                  {patient.age ||
                    (patient.dob ? new Date().getFullYear() - new Date(patient.dob).getFullYear() : '—')}
                </p>
              </div>
              {patient.bloodGroup && (
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wide">Blood Group</p>
                  <p className="font-semibold text-slate-900 mt-0.5">{patient.bloodGroup}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Past Visits — consultations with this doctor only */}
      {activeTab === 'past' && (
        <div className="space-y-4">
          {pastVisits.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
              <p className="text-slate-600 font-medium">No past visits with you</p>
              <p className="text-sm text-slate-400 mt-1">First consultation with this patient</p>
            </div>
          ) : (
            pastVisits.map((visit) => (
              <div key={visit.appointmentId} className="bg-white rounded-2xl border border-slate-200 p-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="font-semibold text-slate-900">
                    {formatSlotDate(visit.slotDate)} · {visit.slotTime || '—'}
                  </p>
                  <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-semibold">Completed</span>
                </div>
                {visit.symptoms?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {visit.symptoms
                      .filter((s) => !String(s).startsWith('Note:'))
                      .map((s, i) => (
                        <span key={i} className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md text-xs">
                          {s}
                        </span>
                      ))}
                  </div>
                )}
                {visit.diagnosis && (
                  <div className="mb-2">
                    <p className="text-xs font-semibold text-slate-400 uppercase">Diagnosis</p>
                    <p className="text-sm text-slate-800 mt-0.5 whitespace-pre-wrap">{visit.diagnosis}</p>
                  </div>
                )}
                {visit.prescription && (
                  <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
                    <p className="text-xs font-semibold text-emerald-700 uppercase mb-1">Prescription</p>
                    <p className="text-sm text-slate-800 whitespace-pre-wrap">{visit.prescription}</p>
                  </div>
                )}
                {visit.advice && (
                  <p className="text-sm text-slate-600 mt-2">
                    <span className="font-medium">Advice:</span> {visit.advice}
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Present Visit — symptoms, reports, prescription */}
      {activeTab === 'present' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <h3 className="text-sm font-bold text-slate-800 mb-3">Symptoms for this visit</h3>
              {symptoms.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {symptoms.map((s, i) => (
                    <span
                      key={i}
                      className="px-3 py-1.5 bg-indigo-50 text-indigo-800 rounded-lg text-sm font-medium border border-indigo-100"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-400">No symptoms reported</p>
              )}
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <h3 className="text-sm font-bold text-slate-800 mb-3">Uploaded reports</h3>
              <PatientReportsViewer appointmentId={appointmentId} patientName={patientName} />
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-bold text-slate-900">Prescription &amp; clinical notes</h3>
              <span className="text-xs text-slate-400">Auto-saves as you type</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Diagnosis">
                <textarea
                  value={diagnosis}
                  onChange={(e) => setDiagnosis(e.target.value)}
                  rows={2}
                  placeholder="Primary diagnosis…"
                  className={inputCls}
                />
              </Field>
              <Field label="Follow-up date">
                <input type="date" value={followupDate} onChange={(e) => setFollowupDate(e.target.value)} className={inputCls} />
              </Field>
            </div>
            <div className="mt-4 space-y-4">
              <Field label="Tablets / medicines" required>
                <textarea
                  value={tablets}
                  onChange={(e) => setTablets(e.target.value)}
                  rows={5}
                  placeholder={'Paracetamol 500mg — 1 tab twice daily × 5 days\nAmoxicillin 250mg — 1 cap TDS × 7 days'}
                  className={inputCls}
                />
              </Field>
              <Field label="Prescription / instructions">
                <textarea
                  value={prescription}
                  onChange={(e) => setPrescription(e.target.value)}
                  rows={3}
                  placeholder="Dosage details, precautions, lab tests…"
                  className={inputCls}
                />
              </Field>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Clinical notes">
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    placeholder="Exam findings, vitals…"
                    className={inputCls}
                  />
                </Field>
                <Field label="Advice to patient">
                  <textarea
                    value={advice}
                    onChange={(e) => setAdvice(e.target.value)}
                    rows={3}
                    placeholder="Diet, rest, warning signs…"
                    className={inputCls}
                  />
                </Field>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default DoctorConsultation
