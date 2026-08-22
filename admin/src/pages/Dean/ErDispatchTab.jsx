import React, { useContext, useEffect, useState, useCallback, useRef } from 'react'
import axios from 'axios'
import { DeanContext } from '../../context/DeanContext'
import { ReceptionContext } from '../../context/ReceptionContext'
import { toast } from 'react-toastify'
import GlassCard from '../../components/ui/GlassCard'
import { ExportMenu } from '../../components/mc'

const CASE_EXPORT_COLUMNS = [
  { key: 'public_id', label: 'Case ID' },
  { key: 'patient_name', label: 'Patient Name' },
  { key: 'patient_phone', label: 'Phone' },
  { key: 'status', label: 'Status' },
  { key: 'hospital_name', label: 'Hospital' },
  { key: 'ambulance_eta_minutes', label: 'ETA (min)', format: (v) => v ?? '' },
  { key: 'hospital_distance_km', label: 'Distance (km)', format: (v) => v ?? '' },
  { key: 'partner_name', label: 'Partner Source' },
  { key: 'created_at', label: 'Date', format: (v) => (v ? new Date(v).toLocaleDateString('en-IN') : '') },
]

const ADMISSION_THEMES = {
  MEDICAL_EMERGENCY: 'bg-red-50 text-red-700 border-red-200',
  CARDIAC: 'bg-rose-50 text-rose-700 border-rose-200',
  ACCIDENT: 'bg-amber-50 text-amber-700 border-amber-200',
  default: 'bg-gray-50 text-gray-700 border-gray-200',
}

const ADMISSION_THEMES_RD = {
  MEDICAL_EMERGENCY: 'bg-rd-critical-bg text-rd-critical border-rd-critical',
  CARDIAC: 'bg-rd-critical-bg text-rd-critical border-rd-critical',
  ACCIDENT: 'bg-rd-pending-bg text-rd-pending border-rd-pending',
  default: 'bg-rd-canvas text-rd-muted border-rd-border',
}

const STATUS_MAP = {
  CREATED:             { text: 'Case Logged',          color: 'bg-blue-50 text-blue-700 border-blue-100', progress: 10 },
  HOSPITAL_ASSIGNED:   { text: 'Awaiting Response',    color: 'bg-red-50 text-red-700 border-red-100 animate-pulse', progress: 20 },
  HOSPITAL_ACCEPTED:   { text: 'Admission Approved',   color: 'bg-emerald-50 text-emerald-700 border-emerald-100', progress: 40 },
  HOSPITAL_REJECTED:   { text: 'Re-routed',            color: 'bg-slate-100 text-slate-600 border-slate-200', progress: 0 },
  AMBULANCE_ASSIGNED:  { text: 'Ambulance Dispatched', color: 'bg-indigo-50 text-indigo-700 border-indigo-100', progress: 50 },
  AMBULANCE_STARTED:   { text: 'Ambulance En Route',   color: 'bg-violet-50 text-violet-700 border-violet-100', progress: 65 },
  PATIENT_PICKED:      { text: 'Patient on Board',     color: 'bg-purple-50 text-purple-700 border-purple-100', progress: 80 },
  HOSPITAL_REACHED:    { text: 'Arrived at ER',        color: 'bg-teal-50 text-teal-700 border-teal-100', progress: 90 },
  TREATMENT_STARTED:   { text: 'Under Treatment',      color: 'bg-sky-50 text-sky-700 border-sky-100', progress: 95 },
  COMPLETED:           { text: 'Case Resolved',        color: 'bg-green-50 text-green-700 border-green-100', progress: 100 },
  CANCELLED:           { text: 'Cancelled',            color: 'bg-slate-100 text-slate-600 border-slate-200', progress: 0 }
}

const STATUS_MAP_RD = {
  CREATED:             { text: 'Case Logged',          color: 'bg-rd-info-bg text-rd-info border-rd-info', progress: 10 },
  HOSPITAL_ASSIGNED:   { text: 'Awaiting Response',    color: 'bg-rd-critical-bg text-rd-critical border-rd-critical', progress: 20 },
  HOSPITAL_ACCEPTED:   { text: 'Admission Approved',   color: 'bg-rd-good-bg text-rd-good border-rd-good', progress: 40 },
  HOSPITAL_REJECTED:   { text: 'Re-routed',            color: 'bg-rd-canvas text-rd-muted border-rd-border', progress: 0 },
  AMBULANCE_ASSIGNED:  { text: 'Ambulance Dispatched', color: 'bg-rd-info-bg text-rd-info border-rd-info', progress: 50 },
  AMBULANCE_STARTED:   { text: 'Ambulance En Route',   color: 'bg-rd-pending-bg text-rd-pending border-rd-pending', progress: 65 },
  PATIENT_PICKED:      { text: 'Patient on Board',     color: 'bg-rd-pending-bg text-rd-pending border-rd-pending', progress: 80 },
  HOSPITAL_REACHED:    { text: 'Arrived at ER',        color: 'bg-rd-good-bg text-rd-good border-rd-good', progress: 90 },
  TREATMENT_STARTED:   { text: 'Under Treatment',      color: 'bg-rd-info-bg text-rd-info border-rd-info', progress: 95 },
  COMPLETED:           { text: 'Case Resolved',        color: 'bg-rd-good-bg text-rd-good border-rd-good', progress: 100 },
  CANCELLED:           { text: 'Cancelled',            color: 'bg-rd-canvas text-rd-muted border-rd-border', progress: 0 }
}

// ── Soft synthesised chime via Web Audio API ──────────────────────────────────
const playDispatchChime = () => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.setValueAtTime(880, ctx.currentTime)       // A5
    osc.frequency.setValueAtTime(660, ctx.currentTime + 0.15) // E5
    gain.gain.setValueAtTime(0.08, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6)
    osc.start()
    osc.stop(ctx.currentTime + 0.6)
  } catch { /* no-op if audio context blocked */ }
}

// ─────────────────────────────────────────────────────────────────────────────
const ErDispatchTab = () => {
  // Works for BOTH Deans and Receptionists — whichever token is active
  const { deanToken } = useContext(DeanContext)
  const { recToken } = useContext(ReceptionContext)
  const activeToken = deanToken || recToken
  const isReception = Boolean(recToken)
  const tokenHeader = deanToken ? { deantoken: deanToken } : { rectoken: recToken }
  const backendUrl = import.meta.env.VITE_BACKEND_URL

  const [activeTab, setActiveTab]       = useState('live')
  const [cases, setCases]               = useState([])
  const [loading, setLoading]           = useState(true)
  const [actionLoading, setActionLoading] = useState(null)
  const [selected, setSelected]         = useState(null)
  const [searchQuery, setSearchQuery]   = useState('')
  const [selectedDate, setSelectedDate] = useState('')
  const pollRef = useRef(null)
  const prevPendingCount = useRef(0)

  // ── Ambulance dispatch modal state ────────────────────────────────────────
  const [dispatchModal, setDispatchModal]         = useState(null) // { casePublicId, caseObj }
  const [ambulances, setAmbulances]               = useState([])
  const [selectedAmbulanceId, setSelectedAmbulanceId] = useState('')
  const [ambLoading, setAmbLoading]               = useState(false)

  // ── Fetch cases ───────────────────────────────────────────────────────────
  const fetchCases = useCallback(async () => {
    if (!activeToken) return
    try {
      const { data } = await axios.get(`${backendUrl}/api/dispatch/hospital/incoming`, {
        headers: tokenHeader,
        params: { tab: activeTab, date: selectedDate || undefined }
      })
      if (data.success) setCases(data.data || [])
    } catch (err) {
      console.error('ER Dispatch fetch error:', err)
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeToken, backendUrl, activeTab, selectedDate])

  useEffect(() => {
    if (activeToken) { setLoading(true); fetchCases() }
  }, [activeToken, activeTab, selectedDate, fetchCases])

  // Polling — refresh every 12 s on live tab
  useEffect(() => {
    if (!activeToken || activeTab !== 'live') return
    pollRef.current = setInterval(fetchCases, 12000)
    return () => clearInterval(pollRef.current)
  }, [activeToken, activeTab, fetchCases])

  // Audio chime whenever new pending cases arrive
  useEffect(() => {
    if (activeTab !== 'live') return
    const pending = cases.filter(c => c.status === 'HOSPITAL_ASSIGNED').length
    if (pending > prevPendingCount.current) playDispatchChime()
    prevPendingCount.current = pending
  }, [cases, activeTab])

  // ── Fetch ambulances for dispatch modal ───────────────────────────────────
  const openDispatchModal = async (casePublicId, caseObj) => {
    setDispatchModal({ casePublicId, caseObj })
    setSelectedAmbulanceId('')
    setAmbLoading(true)
    try {
      const { data } = await axios.get(`${backendUrl}/api/dispatch/hospital/ambulances`, {
        headers: tokenHeader
      })
      setAmbulances(data.data || [])
    } catch {
      setAmbulances([])
    } finally {
      setAmbLoading(false)
    }
  }

  // ── Accept with manual ambulance ─────────────────────────────────────────
  const acceptCase = async (casePublicId, ambulanceId) => {
    setActionLoading(casePublicId + '_accept')
    try {
      const body = { case_id: casePublicId }
      if (ambulanceId) body.ambulance_id = parseInt(ambulanceId, 10)

      const { data } = await axios.post(
        `${backendUrl}/api/dispatch/hospital/accept`,
        body,
        { headers: tokenHeader }
      )
      if (data.success) {
        const msg = data.ambulance_vehicle
          ? `🚑 Dispatched ${data.ambulance_vehicle} — ETA ${data.eta_minutes} min`
          : '🏥 Case Accepted (no ambulance available)'
        toast.success(msg)
        fetchCases()
        setSelected(null)
        setDispatchModal(null)
      }
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Accept failed')
    } finally {
      setActionLoading(null)
    }
  }

  const rejectCase = async (casePublicId) => {
    const reason = window.prompt('Provide rejection reason for dispatch routing:')
    if (reason === null) return
    setActionLoading(casePublicId + '_reject')
    try {
      const { data } = await axios.post(
        `${backendUrl}/api/dispatch/hospital/reject`,
        { case_id: casePublicId, reason: reason || 'Capacity limit' },
        { headers: tokenHeader }
      )
      if (data.success) {
        toast.warning('Case rejected. Partner system notified.')
        fetchCases()
        setSelected(null)
      }
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Reject failed')
    } finally {
      setActionLoading(null)
    }
  }

  const filteredCases = cases.filter(c => {
    const query = searchQuery.toLowerCase().trim()
    if (!query) return true
    return (
      c.patient_name?.toLowerCase().includes(query) ||
      c.patient_phone?.includes(query) ||
      (c.public_id || c.case_id)?.toLowerCase().includes(query)
    )
  })

  const incomingRequests  = filteredCases.filter(c => ['HOSPITAL_ASSIGNED', 'HOSPITAL_REJECTED'].includes(c.status))
  const activeDispatches  = filteredCases.filter(c => !['HOSPITAL_ASSIGNED', 'HOSPITAL_REJECTED', 'COMPLETED', 'CANCELLED'].includes(c.status))
  const hasPending        = incomingRequests.some(c => c.status === 'HOSPITAL_ASSIGNED')

  return (
    <div className={recToken
      ? 'w-full bg-rd-canvas p-4 sm:p-5 mobile-safe-area pb-6 min-h-full font-rd text-rd-text'
      : 'w-full bg-gradient-to-br from-gray-50 via-white to-emerald-50/30 p-4 sm:p-6 mobile-safe-area pb-6 min-h-full'
    }>
      <div className='max-w-6xl mx-auto space-y-6'>

        {/* Title and Header controls */}
        <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-4'>
          <div>
            <h2 className={`text-xl font-bold flex items-center gap-2 ${recToken ? 'text-rd-text' : 'text-2xl text-gray-900'}`}>
              ER Dispatch Center
              {hasPending && activeTab === 'live' && (
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold ${recToken ? 'bg-rd-critical-bg text-rd-critical rounded-rd' : 'bg-red-500 text-white rounded-full animate-pulse'}`}>
                  <span className={`w-1.5 h-1.5 ${recToken ? 'rounded-sm bg-rd-critical' : 'rounded-full bg-white'}`} />
                  LIVE
                </span>
              )}
            </h2>
            <p className={`text-sm ${recToken ? 'text-rd-muted' : 'text-gray-500'}`}>Monitor incoming partner emergency cases and active ambulance dispatches.</p>
          </div>

          <div className='flex items-center gap-3 w-full sm:w-auto flex-wrap'>
            {/* Search Input */}
            <div className='relative flex-1 sm:w-64 min-w-[200px]'>
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder='Search patient or ID...'
                className={recToken
                  ? 'w-full pl-10 pr-4 py-2 border border-rd-border rounded-rd bg-rd-surface focus:border-rd-primary outline-none text-sm'
                  : 'w-full pl-10 pr-4 py-2 border-2 border-gray-100 rounded-xl focus:border-emerald-500 outline-none transition-all text-sm'
                }
              />
              <svg className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${recToken ? 'text-rd-muted' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            {/* Date Picker */}
            <div className={recToken
              ? 'relative flex items-center border border-rd-border rounded-rd px-3 py-1.5 bg-rd-surface text-sm focus-within:border-rd-primary'
              : 'relative flex items-center border-2 border-gray-100 rounded-xl px-3 py-1.5 bg-white text-sm focus-within:border-emerald-500'
            }>
              <input
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                className={`bg-transparent text-xs font-semibold outline-none ${recToken ? 'text-rd-text' : 'text-gray-700'}`}
              />
              {selectedDate && (
                <button onClick={() => setSelectedDate('')} className={`ml-2 text-xs font-bold ${recToken ? 'text-rd-muted hover:text-rd-text' : 'text-gray-400 hover:text-gray-600'}`}>×</button>
              )}
            </div>

            {/* Export Menu Component */}
            <ExportMenu
              columns={CASE_EXPORT_COLUMNS}
              rows={() => filteredCases}
              filename={`emergency_dispatch_${activeTab}`}
              title='Emergency Dispatch Records'
              subtitle={`${filteredCases.length} record(s)`}
            />
          </div>
        </div>

        {/* Navigation Tabs */}
        {isReception ? (
          <div className='flex gap-2'>
            <button
              type='button'
              onClick={() => { setActiveTab('live'); setSelectedDate('') }}
              className={`px-4 py-2 rounded-rd text-sm font-semibold ${activeTab === 'live' ? 'rd-tab-active' : 'rd-tab-idle'}`}
            >
              Incoming Live
              {hasPending && (
                <span className='ml-2 inline-flex items-center px-1.5 py-0.5 text-[10px] font-bold uppercase bg-rd-critical-bg text-rd-critical rounded-rd'>Live</span>
              )}
            </button>
            <button
              type='button'
              onClick={() => setActiveTab('completed')}
              className={`px-4 py-2 rounded-rd text-sm font-semibold ${activeTab === 'completed' ? 'rd-tab-active' : 'rd-tab-idle'}`}
            >
              Already Completed
            </button>
          </div>
        ) : (
          <div className="flex border-b-2 border-gray-100 gap-6">
            <button
              onClick={() => { setActiveTab('live'); setSelectedDate('') }}
              className={`pb-2.5 text-sm font-bold transition-all relative ${activeTab === 'live' ? 'text-emerald-600 font-extrabold' : 'text-gray-400 hover:text-gray-600'}`}
            >
              Incoming Live
              {activeTab === 'live' && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500 rounded-full" />}
            </button>
            <button
              onClick={() => setActiveTab('completed')}
              className={`pb-2.5 text-sm font-bold transition-all relative ${activeTab === 'completed' ? 'text-emerald-600 font-extrabold' : 'text-gray-400 hover:text-gray-600'}`}
            >
              Already Completed
              {activeTab === 'completed' && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500 rounded-full" />}
            </button>
          </div>
        )}

        {/* Content Section */}
        {isReception ? (
          <div className='rd-panel p-5'>
            {loading ? (
              <div className='py-20 flex justify-center'>
                <div className='animate-spin h-8 w-8 border-2 border-rd-border border-t-rd-primary rounded-full' />
              </div>
            ) : filteredCases.length === 0 ? (
              <div className='py-16 text-center text-rd-muted'>
                <p className='font-semibold text-rd-text'>No cases found matching filters.</p>
              </div>
            ) : activeTab === 'live' ? (
              <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
                <div>
                  <h3 className='text-xs font-semibold text-rd-muted uppercase tracking-wider mb-3 flex items-center gap-2'>
                    <span className='w-2 h-2 rounded-sm bg-rd-critical' />
                    Requires Response ({incomingRequests.length})
                  </h3>
                  {incomingRequests.length === 0 ? (
                    <p className='text-sm text-rd-muted py-4'>No pending admissions</p>
                  ) : (
                    <div className='space-y-3'>
                      {incomingRequests.map(c => (
                        <CaseItemCard
                          key={c.id}
                          caseData={c}
                          onAccept={(pid) => openDispatchModal(pid, c)}
                          onReject={rejectCase}
                          onView={setSelected}
                          actionLoading={actionLoading}
                          isReception
                        />
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <h3 className='text-xs font-semibold text-rd-muted uppercase tracking-wider mb-3 flex items-center gap-2'>
                    <span className='w-2 h-2 rounded-sm bg-rd-good' />
                    Active Telemetry ({activeDispatches.length})
                  </h3>
                  {activeDispatches.length === 0 ? (
                    <p className='text-sm text-rd-muted py-4'>No active ambulance dispatches</p>
                  ) : (
                    <div className='space-y-3'>
                      {activeDispatches.map(c => (
                        <CaseItemCard key={c.id} caseData={c} onView={setSelected} actionLoading={actionLoading} isReception />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div>
                <h3 className='text-xs font-semibold text-rd-muted uppercase tracking-wider mb-3'>
                  Completed Records ({filteredCases.length})
                </h3>
                <div className='grid grid-cols-1 md:grid-cols-2 gap-3'>
                  {filteredCases.map(c => (
                    <CaseItemCard key={c.id} caseData={c} onView={setSelected} actionLoading={actionLoading} isReception />
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <GlassCard className='p-6'>
            {loading ? (
              <div className='py-20 flex justify-center'>
                <div className='animate-spin h-10 w-10 border-4 border-emerald-500 border-t-transparent rounded-full'></div>
              </div>
            ) : filteredCases.length === 0 ? (
              <div className='py-20 text-center text-gray-400'>
                <p className='text-4xl mb-4'>📭</p>
                <p className="font-semibold">No cases found matching filters.</p>
              </div>
            ) : activeTab === 'live' ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div>
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    Requires Response ({incomingRequests.length})
                  </h3>
                  {incomingRequests.length === 0 ? (
                    <p className="text-sm text-gray-400 italic py-4">No pending admissions</p>
                  ) : (
                    <div className="space-y-4">
                      {incomingRequests.map(c => (
                        <CaseItemCard
                          key={c.id}
                          caseData={c}
                          onAccept={(pid) => openDispatchModal(pid, c)}
                          onReject={rejectCase}
                          onView={setSelected}
                          actionLoading={actionLoading}
                        />
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    Active Telemetry ({activeDispatches.length})
                  </h3>
                  {activeDispatches.length === 0 ? (
                    <p className="text-sm text-gray-400 italic py-4">No active ambulance dispatches</p>
                  ) : (
                    <div className="space-y-4">
                      {activeDispatches.map(c => (
                        <CaseItemCard key={c.id} caseData={c} onView={setSelected} actionLoading={actionLoading} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div>
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">
                  Completed Records ({filteredCases.length})
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {filteredCases.map(c => (
                    <CaseItemCard key={c.id} caseData={c} onView={setSelected} actionLoading={actionLoading} />
                  ))}
                </div>
              </div>
            )}
          </GlassCard>
        )}
      </div>

      {/* Case Detail Modal */}
      {selected && (
        <CaseDetailModal
          caseData={selected}
          onClose={() => setSelected(null)}
          onAccept={(pid) => openDispatchModal(pid, selected)}
          onReject={rejectCase}
          actionLoading={actionLoading}
          isReception={isReception}
        />
      )}

      {/* Ambulance Dispatch Modal */}
      {dispatchModal && (
        <AmbulanceDispatchModal
          caseData={dispatchModal.caseObj}
          ambulances={ambulances}
          ambLoading={ambLoading}
          selectedAmbulanceId={selectedAmbulanceId}
          onSelect={setSelectedAmbulanceId}
          onDispatch={() => acceptCase(dispatchModal.casePublicId, selectedAmbulanceId)}
          onClose={() => setDispatchModal(null)}
          actionLoading={actionLoading}
          casePublicId={dispatchModal.casePublicId}
          isReception={isReception}
        />
      )}
    </div>
  )
}

// ─── Ambulance Dispatch Modal ─────────────────────────────────────────────────
const AmbulanceDispatchModal = ({ caseData: c, ambulances, ambLoading, selectedAmbulanceId, onSelect, onDispatch, onClose, actionLoading, casePublicId, isReception = false }) => {
  const availableAmb = ambulances.filter(a => (a.status || '').toLowerCase() === 'available')
  const isDispatching = actionLoading === casePublicId + '_accept'

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${isReception ? 'bg-black/40' : 'bg-black/50 backdrop-blur-sm'}`} onClick={onClose}>
      <div
        className={isReception
          ? 'bg-rd-surface rounded-rd-sm w-full max-w-md overflow-hidden border border-rd-border'
          : 'bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-200'}
        onClick={e => e.stopPropagation()}
      >
        <div className={isReception
          ? 'bg-rd-canvas px-6 py-4 border-b border-rd-border flex items-center justify-between'
          : 'bg-gradient-to-r from-red-50 to-orange-50 px-6 py-4 border-b border-gray-100 flex items-center justify-between'}
        >
          <div>
            <h3 className={`font-bold text-lg flex items-center gap-2 ${isReception ? 'text-rd-text' : 'text-gray-900'}`}>
              {!isReception && <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />}
              Dispatch Ambulance
            </h3>
            <p className={`text-xs font-mono mt-0.5 ${isReception ? 'text-rd-muted' : 'text-gray-400'}`}>{casePublicId}</p>
          </div>
          <button onClick={onClose} className={`p-1 font-bold text-lg ${isReception ? 'text-rd-muted hover:text-rd-text' : 'rounded-lg hover:bg-gray-200/60 text-gray-400 hover:text-gray-700 transition'}`}>×</button>
        </div>

        <div className="px-6 pt-5">
          <div className={isReception
            ? 'bg-rd-canvas rounded-rd p-4 mb-5 border border-rd-border'
            : 'bg-gray-50 rounded-xl p-4 mb-5 border border-gray-100'}
          >
            <p className={`font-bold text-sm ${isReception ? 'text-rd-text' : 'text-gray-800'}`}>{c?.patient_name || 'Emergency Patient'}</p>
            <p className={`text-xs mt-0.5 ${isReception ? 'text-rd-muted' : 'text-gray-500'}`}>{c?.patient_phone || '—'}</p>
            {c?.location_text && (
              <p className={`text-xs mt-1 ${isReception ? 'text-rd-muted' : 'text-gray-600'}`}>{c.location_text.replace(/\[object Object\]/gi, '').trim()}</p>
            )}
          </div>

          <p className={`text-xs font-bold uppercase tracking-wider mb-2 ${isReception ? 'text-rd-muted' : 'text-gray-500'}`}>Select Ambulance</p>

          {ambLoading ? (
            <div className="py-6 flex justify-center">
              <div className={`animate-spin h-6 w-6 border-2 rounded-full ${isReception ? 'border-rd-border border-t-rd-primary' : 'border-3 border-emerald-500 border-t-transparent'}`} />
            </div>
          ) : ambulances.length === 0 ? (
            <div className={isReception
              ? 'bg-rd-pending-bg border border-rd-pending rounded-rd p-4 text-center'
              : 'bg-amber-50 border border-amber-200 rounded-xl p-4 text-center'}
            >
              <p className={`text-sm font-semibold ${isReception ? 'text-rd-pending' : 'text-amber-700'}`}>No ambulances registered at your hospital.</p>
              <p className={`text-xs mt-1 ${isReception ? 'text-rd-muted' : 'text-amber-600'}`}>System will attempt auto-assign from nearby.</p>
            </div>
          ) : (
            <>
              <select
                value={selectedAmbulanceId}
                onChange={e => onSelect(e.target.value)}
                className={isReception
                  ? 'w-full border border-rd-border rounded-rd px-4 py-3 text-sm font-semibold text-rd-text focus:border-rd-primary outline-none mb-2 bg-rd-surface'
                  : 'w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm font-semibold text-gray-800 focus:border-emerald-500 outline-none transition mb-2'}
              >
                <option value="">— Auto-assign nearest available —</option>
                {availableAmb.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.vehicle_number} ({a.vehicle_type || 'BLS'}) — {a.operator_name || 'Driver'}
                  </option>
                ))}
                {ambulances.filter(a => (a.status || '').toLowerCase() !== 'available').map(a => (
                  <option key={a.id} value={a.id} disabled>
                    {a.vehicle_number} — {a.status || 'unavailable'}
                  </option>
                ))}
              </select>
              {availableAmb.length === 0 && (
                <p className={isReception
                  ? 'text-xs text-rd-pending font-semibold bg-rd-pending-bg border border-rd-pending rounded-rd px-3 py-2 mb-2'
                  : 'text-xs text-amber-600 font-semibold bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mb-2'}
                >
                  No ambulances marked <strong>available</strong> at your hospital. System will auto-assign or you may select an offline vehicle to manually override.
                </p>
              )}
            </>
          )}
        </div>

        <div className="px-6 py-5 flex gap-3">
          <button
            onClick={onDispatch}
            disabled={isDispatching}
            className={isReception
              ? 'flex-1 py-2.5 bg-rd-primary hover:bg-rd-primary-hover text-white rounded-rd font-semibold text-sm disabled:opacity-50'
              : 'flex-1 py-3 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white rounded-xl font-bold text-sm transition active:scale-95 disabled:opacity-50 shadow-sm'}
          >
            {isDispatching ? 'Dispatching…' : 'Confirm Dispatch'}
          </button>
          <button
            onClick={onClose}
            className={isReception
              ? 'px-5 py-2.5 border border-rd-border text-rd-text rounded-rd font-semibold text-sm hover:bg-rd-canvas'
              : 'px-5 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold text-sm transition'}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Case Card Component ──────────────────────────────────────────────────────
const CaseItemCard = ({ caseData: c, onAccept, onReject, onView, actionLoading, isReception = false }) => {
  const isUrgent = ['HOSPITAL_ASSIGNED', 'HOSPITAL_REJECTED'].includes(c.status)
  const themes = isReception ? ADMISSION_THEMES_RD : ADMISSION_THEMES
  const statusMap = isReception ? STATUS_MAP_RD : STATUS_MAP
  const theme = themes[c.emergency_type] || themes.default
  const statusInfo = statusMap[c.status] || { text: c.status, color: isReception ? 'bg-rd-canvas text-rd-muted border-rd-border' : 'bg-gray-100 text-gray-700', progress: 0 }
  const tagRadius = isReception ? 'rounded-rd' : 'rounded-full'

  const formatLocation = (text) => {
    if (!text) return ''
    return text.replace(/\[object Object\]/gi, '').replace(/\s*,\s*$/, '').trim()
  }

  const renderMetadata = () => {
    let meta = c.additional_info
    if (typeof meta === 'string') {
      try { meta = JSON.parse(meta) } catch { return null }
    }
    if (!meta || typeof meta !== 'object') return null
    return Object.entries(meta)
      .filter(([k, v]) => v && typeof v !== 'object')
      .map(([k, v]) => (
        <span key={k} className={`inline-flex items-center px-2 py-0.5 text-[10px] font-bold border capitalize ${isReception ? 'bg-rd-canvas text-rd-muted border-rd-border rounded-rd' : 'bg-gray-50 text-gray-500 rounded border-gray-200'}`}>
          {k.replace(/_/g, ' ')}: {String(v)}
        </span>
      ))
  }

  return (
    <div
      onClick={() => onView(c)}
      className={isReception
        ? `bg-rd-surface border border-rd-border rounded-rd-sm p-4 cursor-pointer border-l-4 ${isUrgent && c.status === 'HOSPITAL_ASSIGNED' ? 'border-l-rd-critical' : 'border-l-rd-accent'}`
        : `bg-white border rounded-2xl p-5 cursor-pointer transition-all hover:shadow-md ${isUrgent && c.status === 'HOSPITAL_ASSIGNED' ? 'border-red-200 shadow-red-100/60 shadow-sm' : 'border-gray-200 hover:border-gray-300'}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="space-y-2 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[10px] font-bold px-2 py-0.5 border ${tagRadius} ${theme}`}>
              {c.emergency_type?.replace(/_/g, ' ')}
            </span>
            <span className={`text-[10px] font-bold px-2 py-0.5 border ${tagRadius} ${statusInfo.color}`}>
              {statusInfo.text}
            </span>
            {c.is_sandbox && (
              <span className={`text-[9px] font-bold px-1.5 py-0.5 border ${isReception ? 'bg-rd-info-bg text-rd-info border-rd-info rounded-rd' : 'bg-violet-100 text-violet-700 rounded border-violet-200'}`}>DEMO</span>
            )}
          </div>

          <div>
            <h4 className={`font-bold text-base ${isReception ? 'text-rd-text' : 'text-gray-800'}`}>{c.patient_name}</h4>
            <p className={`text-xs mt-0.5 ${isReception ? 'text-rd-muted' : 'text-gray-500'}`}>{c.patient_phone}</p>
          </div>

          {c.location_text && (
            <p className={`text-xs font-medium ${isReception ? 'text-rd-muted' : 'text-gray-600'}`}>{formatLocation(c.location_text)}</p>
          )}

          <div className="flex items-center gap-1.5 flex-wrap">
            {renderMetadata()}
          </div>
        </div>

        {isUrgent ? (
          <div className="flex sm:flex-col gap-2 shrink-0 pt-2 sm:pt-0" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => onAccept(c.public_id)}
              disabled={!!actionLoading}
              className={isReception
                ? 'px-4 py-2 rd-tab-active text-xs font-semibold disabled:opacity-50'
                : 'px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition active:scale-95 disabled:opacity-50'}
            >
              {actionLoading === c.public_id + '_accept' ? '…' : 'Accept'}
            </button>
            <button
              onClick={() => onReject(c.public_id)}
              disabled={!!actionLoading}
              className={isReception
                ? 'px-4 py-2 rd-tab-idle text-xs font-semibold disabled:opacity-50'
                : 'px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition active:scale-95 disabled:opacity-50'}
            >
              Reject
            </button>
          </div>
        ) : (
          <div className="text-right shrink-0 space-y-2">
            {c.hospital_distance_km && (
              <p className={`text-sm font-bold ${isReception ? 'text-rd-text' : 'text-gray-800'}`}>{c.hospital_distance_km} km</p>
            )}
            {c.ambulance_eta_minutes && (
              <p className={`text-xs ${isReception ? 'text-rd-muted' : 'text-gray-500'}`}>ETA: {c.ambulance_eta_minutes} min</p>
            )}
            {isReception && (
              <button
                type='button'
                onClick={(e) => { e.stopPropagation(); onView(c) }}
                className='rd-tab-idle px-3 py-1.5 text-xs font-semibold rounded-rd'
              >
                View details
              </button>
            )}
          </div>
        )}
      </div>

      {!isUrgent && !['COMPLETED', 'CANCELLED'].includes(c.status) && statusInfo.progress > 0 && (
        <div className="mt-4 space-y-1" onClick={e => e.stopPropagation()}>
          <div className={`flex justify-between items-center text-[10px] font-bold uppercase tracking-wider ${isReception ? 'text-rd-muted' : 'text-gray-400'}`}>
            <span>Progress</span>
            <span>{statusInfo.progress}%</span>
          </div>
          <div className={`h-2 w-full overflow-hidden ${isReception ? 'bg-rd-canvas border border-rd-border rounded-rd' : 'bg-gray-100 rounded-full'}`}>
            <div
              className={`h-full ${isReception ? 'bg-rd-accent rounded-rd' : 'bg-emerald-500 rounded-full'} transition-all`}
              style={{ width: `${statusInfo.progress}%`, backgroundColor: isReception ? 'var(--rd-accent, #3E6B8A)' : undefined }}
            />
          </div>
        </div>
      )}

      <div className={`mt-4 pt-3 flex items-center justify-between text-[11px] font-bold ${isReception ? 'border-t border-rd-border text-rd-muted' : 'border-t border-gray-100 text-gray-400'}`}>
        <span>{c.partner_name}</span>
        <span className="font-mono text-xs">{c.public_id}</span>
      </div>
    </div>
  )
}

// ─── Case Detail Modal ────────────────────────────────────────────────────────
const CaseDetailModal = ({ caseData: c, onClose, onAccept, onReject, actionLoading, isReception = false }) => {
  const isUrgent = ['HOSPITAL_ASSIGNED', 'HOSPITAL_REJECTED'].includes(c.status)
  const statusMap = isReception ? STATUS_MAP_RD : STATUS_MAP
  const statusInfo = statusMap[c.status] || { text: c.status, color: 'bg-gray-100 text-gray-700', progress: 0 }

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${isReception ? 'bg-black/40' : 'bg-black/40 backdrop-blur-sm'}`} onClick={onClose}>
      <div
        className={isReception
          ? 'bg-rd-surface rounded-rd-sm w-full max-w-xl overflow-hidden border border-rd-border'
          : 'bg-white rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden border border-gray-200'}
        onClick={e => e.stopPropagation()}
      >
        <div className={
          isReception
            ? 'rd-modal-header px-5 py-4 flex items-center justify-between'
            : `px-6 py-4 border-b flex items-center justify-between ${isUrgent ? 'bg-red-50/50 border-gray-150' : 'bg-gray-50 border-gray-150'}`
        }>
          <div>
            <h3 className={`font-bold text-lg flex items-center gap-2 ${isReception ? 'text-white' : 'text-gray-900'}`}>
              {!isReception && isUrgent && <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />}
              {c.patient_name}
            </h3>
            <p className={`text-xs font-mono font-bold mt-0.5 ${isReception ? 'text-white/75' : 'text-gray-400'}`}>{c.public_id}</p>
          </div>
          <button
            type='button'
            onClick={onClose}
            aria-label='Close'
            className={isReception
              ? 'w-9 h-9 rounded-rd-sm border border-white/40 bg-white/15 text-white flex items-center justify-center text-lg font-bold hover:bg-white/25'
              : 'p-1 rounded-lg hover:bg-gray-200/60 text-gray-400 hover:text-gray-700 transition font-bold text-lg'}
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            {[
              ['Patient Name', c.patient_name],
              ['Mobile Number', c.patient_phone],
              ['Request Source', c.partner_name],
              ['Emergency Type', c.emergency_type?.replace(/_/g, ' ')],
              ['Admission Status', statusInfo.text],
              ['Distance', c.hospital_distance_km ? `${c.hospital_distance_km} km` : '—'],
              ['ETA to ER', c.ambulance_eta_minutes ? `${c.ambulance_eta_minutes} min` : '—'],
              ['Environment', c.is_sandbox ? 'Sandbox (Test Case)' : 'Live Production'],
            ].map(([k, v]) => (
              <div key={k} className={isReception ? 'bg-rd-canvas border border-rd-border rounded-rd p-3' : 'bg-gray-50 border border-gray-100 rounded-xl p-3'}>
                <p className={`text-[10px] font-bold uppercase tracking-wider ${isReception ? 'text-rd-muted' : 'text-gray-400'}`}>{k}</p>
                <p className={`font-bold mt-1 text-sm ${isReception ? 'text-rd-text' : 'text-gray-700'}`}>{v || '—'}</p>
              </div>
            ))}
          </div>

          {c.location_text && (
            <div className={isReception ? 'bg-rd-canvas border border-rd-border rounded-rd p-4' : 'bg-gray-50 border border-gray-100 rounded-xl p-4'}>
              <p className={`text-[10px] font-bold uppercase tracking-wider ${isReception ? 'text-rd-muted' : 'text-gray-400'}`}>Pickup Location</p>
              <p className={`text-sm font-bold mt-1 ${isReception ? 'text-rd-text' : 'text-gray-700'}`}>{c.location_text.replace(/\[object Object\]/gi, '').trim()}</p>
            </div>
          )}

          <a
            href={`https://maps.google.com/?q=${c.latitude},${c.longitude}`}
            target="_blank" rel="noreferrer"
            className={isReception
              ? 'flex items-center justify-center gap-2 w-full py-2.5 bg-rd-info-bg text-rd-info border border-rd-info rounded-rd text-sm font-semibold'
              : 'flex items-center justify-center gap-2 w-full py-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200/60 rounded-xl text-sm font-bold transition'}
          >
            Open in Google Maps
          </a>

          {isUrgent && (
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => { onAccept(c.public_id); onClose() }}
                disabled={!!actionLoading}
                className={isReception
                  ? 'flex-1 py-2.5 bg-rd-primary hover:bg-rd-primary-hover text-white rounded-rd font-semibold text-sm disabled:opacity-50'
                  : 'flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm transition active:scale-95 disabled:opacity-50'}
              >
                Dispatch Ambulance
              </button>
              <button
                onClick={() => { onReject(c.public_id); onClose() }}
                disabled={!!actionLoading}
                className={isReception
                  ? 'flex-1 py-2.5 border border-rd-border text-rd-text rounded-rd font-semibold text-sm hover:bg-rd-canvas disabled:opacity-50'
                  : 'flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold text-sm transition active:scale-95 disabled:opacity-50'}
              >
                Reject Case
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ErDispatchTab
