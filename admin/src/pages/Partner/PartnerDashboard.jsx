import React, { useContext, useEffect, useState, useCallback } from 'react'
import axios from 'axios'
import { AdminContext } from '../../context/AdminContext'
import { toast } from 'react-toastify'
import { AdminPageLayout, PageHero, KpiCard, McCard } from '../../components/mc'

/**
 * PartnerDashboard — partner analytics, case history, and webhook debugging.
 * Accessible only by Super Admins (via Admin portal).
 * In production, partners would have their own login + limited view.
 */

const STATUS_CHIP = {
  COMPLETED:   'bg-green-100 text-green-700',
  CANCELLED:   'bg-gray-100 text-gray-500',
  CREATED:     'bg-blue-100 text-blue-700',
  default:     'bg-amber-100 text-amber-700',
}

const WEBHOOK_CHIP = {
  delivered:          'bg-green-100 text-green-700',
  failed:             'bg-red-100 text-red-700',
  permanently_failed: 'bg-gray-100 text-gray-500',
  pending:            'bg-amber-100 text-amber-700',
}

const fmt = (n) => Number(n || 0).toLocaleString('en-IN')

const PartnerDashboard = () => {
  const { aToken } = useContext(AdminContext)
  const API = import.meta.env.VITE_BACKEND_URL

  // Partner selection (admin picks which partner to view)
  const [partners, setPartners] = useState([])
  const [selectedPartnerId, setSelectedPartnerId] = useState(null)

  // Dashboard state
  const [tab, setTab] = useState('cases')  // cases | webhooks | logs | pharmacy
  const [summary, setSummary] = useState(null)
  const [cases, setCases] = useState([])
  const [webhooks, setWebhooks] = useState([])
  const [pharmacyOrders, setPharmacyOrders] = useState([])
  const [logs, setLogs] = useState([])
  const [billing, setBilling] = useState([])
  const [loading, setLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState('')
  const [sandboxFilter, setSandboxFilter] = useState('')
  const [webhookEventFilter, setWebhookEventFilter] = useState('') // '' | pharmacy | emergency

  // ── Load partners list ────────────────────────────────────────────────────
  useEffect(() => {
    if (!aToken) return
    axios.get(`${API}/api/admin/partners/`, { headers: { aToken } })
      .then(res => {
        if (res.data.success) {
          setPartners(res.data.data || [])
          if (res.data.data?.length > 0 && !selectedPartnerId) {
            setSelectedPartnerId(res.data.data[0].id)
          }
        }
      }).catch(console.error)
  }, [aToken])

  // Admin view: partner_auth accepts aToken (super-admin JWT) + X-Partner-Id.
  const partnerHeaders = () => ({
    aToken,
    'X-Partner-Id': String(selectedPartnerId || ''),
  })

  // ── Load data for selected partner ────────────────────────────────────────
  const selectedPartner = partners.find(p => p.id === selectedPartnerId)

  const fetchSummary = useCallback(async () => {
    if (!selectedPartnerId) return
    try {
      const { data } = await axios.get(
        `${API}/api/admin/partners/${selectedPartnerId}`,
        { headers: { aToken } }
      )
      // Use the admin case list as a summary proxy
      const casesRes = await axios.get(
        `${API}/api/admin/partners/emergency/cases?limit=200`,
        { headers: { aToken } }
      )
      if (casesRes.data.success) {
        const allCases = (casesRes.data.data || []).filter(c => c.partner_id === selectedPartnerId)
        setSummary({
          total: allCases.length,
          completed: allCases.filter(c => c.status === 'COMPLETED').length,
          active: allCases.filter(c => !['COMPLETED', 'CANCELLED'].includes(c.status)).length,
          cancelled: allCases.filter(c => c.status === 'CANCELLED').length,
        })
        setCases(allCases)
      }
    } catch (err) {
      toast.error('Failed to load partner data')
    }
  }, [selectedPartnerId, aToken, API])

  const fetchWebhooks = useCallback(async () => {
    if (!selectedPartnerId) return
    setLoading(true)
    try {
      const qs = new URLSearchParams({ limit: '50' })
      if (webhookEventFilter === 'pharmacy') qs.set('event_prefix', 'pharmacy')
      if (webhookEventFilter === 'emergency') qs.set('event_prefix', 'emergency.')
      const wRes = await axios.get(
        `${API}/api/partner/dashboard/webhooks?${qs.toString()}`,
        { headers: partnerHeaders() }
      )
      if (wRes.data.success) setWebhooks(wRes.data.data || [])
    } catch { /* silent */ } finally { setLoading(false) }
  }, [selectedPartnerId, aToken, webhookEventFilter])

  const fetchPharmacyOrders = useCallback(async () => {
    if (!selectedPartnerId) return
    setLoading(true)
    try {
      const { data } = await axios.get(
        `${API}/api/partner/dashboard/pharmacy-orders?limit=50`,
        { headers: partnerHeaders() }
      )
      if (data.success) setPharmacyOrders(data.data || [])
    } catch { /* silent */ } finally { setLoading(false) }
  }, [selectedPartnerId, aToken])

  const fetchLogs = useCallback(async () => {
    if (!selectedPartnerId) return
    setLoading(true)
    try {
      const { data } = await axios.get(
        `${API}/api/partner/dashboard/api-logs?limit=50`,
        { headers: partnerHeaders() }
      )
      if (data.success) setLogs(data.data || [])
    } catch { /* silent */ } finally { setLoading(false) }
  }, [selectedPartnerId, aToken])

  useEffect(() => {
    if (!selectedPartnerId) return
    fetchSummary()
  }, [selectedPartnerId, fetchSummary])

  useEffect(() => {
    if (tab === 'webhooks') fetchWebhooks()
    if (tab === 'logs') fetchLogs()
    if (tab === 'pharmacy') fetchPharmacyOrders()
  }, [tab, selectedPartnerId, webhookEventFilter])

  const retryWebhook = async (deliveryId) => {
    try {
      await axios.post(
        `${API}/api/partner/dashboard/webhooks/${deliveryId}/retry`,
        {},
        { headers: partnerHeaders() }
      )
      toast.success('Retry scheduled!')
      fetchWebhooks()
    } catch (err) {
      toast.error('Retry failed')
    }
  }

  // ── Filtered cases ────────────────────────────────────────────────────────
  const filteredCases = cases.filter(c => {
    if (statusFilter && c.status !== statusFilter) return false
    if (sandboxFilter === 'sandbox' && !c.is_sandbox) return false
    if (sandboxFilter === 'live' && c.is_sandbox) return false
    return true
  })

  return (
    <AdminPageLayout maxWidth="max-w-7xl mx-auto">
      <PageHero
        title="Partner Analytics"
        subtitle="Deep-dive into case metrics, webhook delivery, and API usage for each partner."
        features={['Usage Analytics', 'Webhook Debugger', 'API Logs', 'Billing']}
      />

      {/* Partner selector */}
      <div className="mb-6 flex items-center gap-4">
        <label className="text-sm font-semibold text-mc-text-muted whitespace-nowrap">Viewing Partner:</label>
        <select
          value={selectedPartnerId || ''}
          onChange={e => setSelectedPartnerId(parseInt(e.target.value, 10))}
          className="flex-1 max-w-xs border border-mc-border rounded-xl px-3 py-2 text-sm bg-mc-bg outline-none focus:ring-2 focus:ring-admin/30"
        >
          {partners.map(p => (
            <option key={p.id} value={p.id}>{p.name} ({p.status})</option>
          ))}
        </select>
        {selectedPartner && (
          <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${
            selectedPartner.status === 'active' ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
            : 'bg-amber-100 text-amber-700 border-amber-200'
          }`}>
            {selectedPartner.status}
          </span>
        )}
      </div>

      {/* KPI Cards */}
      {summary && (
        <div className="mc-kpi-grid mc-kpi-grid--4 mb-6">
          <KpiCard label="Total Cases" value={fmt(summary.total)} iconBg="bg-indigo-100 text-indigo-600"
            icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>}
          />
          <KpiCard label="Active Now" value={fmt(summary.active)} iconBg="bg-red-100 text-red-600"
            icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
          />
          <KpiCard label="Completed" value={fmt(summary.completed)} iconBg="bg-emerald-100 text-emerald-600"
            icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
          />
          <KpiCard label="Cancelled" value={fmt(summary.cancelled)} iconBg="bg-gray-100 text-gray-600"
            icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>}
          />
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 p-1 bg-mc-surface-elevated rounded-2xl w-fit">
        {[['cases','Cases'], ['pharmacy','Pharmacy'], ['webhooks','Webhooks'], ['logs','Logs']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition ${tab === key ? 'bg-admin text-white shadow' : 'text-mc-text-muted hover:text-mc-text'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* ── Cases tab ─────────────────────────────────────────────────── */}
      {tab === 'cases' && (
        <McCard noPadding>
          {/* Filters */}
          <div className="p-4 flex flex-wrap gap-3 border-b border-mc-border">
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              className="border border-mc-border rounded-lg px-3 py-1.5 text-xs bg-mc-bg outline-none">
              <option value="">All Statuses</option>
              {['CREATED','HOSPITAL_ASSIGNED','HOSPITAL_ACCEPTED','AMBULANCE_ASSIGNED',
                'AMBULANCE_STARTED','PATIENT_PICKED','HOSPITAL_REACHED','COMPLETED','CANCELLED'].map(s => (
                <option key={s} value={s}>{s.replace(/_/g,' ')}</option>
              ))}
            </select>
            <select value={sandboxFilter} onChange={e => setSandboxFilter(e.target.value)}
              className="border border-mc-border rounded-lg px-3 py-1.5 text-xs bg-mc-bg outline-none">
              <option value="">Sandbox + Live</option>
              <option value="sandbox">Sandbox Only</option>
              <option value="live">Live Only</option>
            </select>
          </div>
          <div className="overflow-x-auto">
            <table className="mc-data-table">
              <thead>
                <tr>
                  <th>Case ID</th>
                  <th>Patient</th>
                  <th>Status</th>
                  <th>Hospital</th>
                  <th>ETA</th>
                  <th>Mode</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {filteredCases.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-10 text-mc-text-muted">No cases match the filter</td></tr>
                ) : filteredCases.map(c => (
                  <tr key={c.case_id || c.id}>
                    <td><span className="font-mono text-xs">{c.case_id}</span></td>
                    <td>
                      <p className="font-semibold text-sm">{c.patient_name}</p>
                      <p className="text-xs text-mc-text-muted">{c.patient_phone}</p>
                    </td>
                    <td>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${STATUS_CHIP[c.status] || STATUS_CHIP.default}`}>
                        {c.status?.replace(/_/g,' ')}
                      </span>
                    </td>
                    <td className="text-xs">{c.hospital_name || '—'}</td>
                    <td className="text-xs">{c.ambulance_eta_minutes ? `${c.ambulance_eta_minutes}m` : '—'}</td>
                    <td>
                      {c.is_sandbox
                        ? <span className="text-xs text-violet-600 font-bold">Sandbox</span>
                        : <span className="text-xs text-emerald-600 font-bold">Live</span>}
                    </td>
                    <td className="text-xs text-mc-text-muted">
                      {c.created_at ? new Date(c.created_at).toLocaleString('en-IN', {dateStyle:'short',timeStyle:'short'}) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </McCard>
      )}

      {/* ── Pharmacy orders tab ───────────────────────────────────────── */}
      {tab === 'pharmacy' && (
        <McCard noPadding>
          {loading ? (
            <div className="flex justify-center py-16"><div className="animate-spin h-10 w-10 border-4 border-indigo-100 border-t-indigo-600 rounded-full" /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="mc-data-table">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Pharmacy</th>
                    <th>Status</th>
                    <th>Amount</th>
                    <th>Mode</th>
                    <th>order.placed sync</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {pharmacyOrders.length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-10 text-mc-text-muted">No pharmacy orders yet</td></tr>
                  ) : pharmacyOrders.map(o => (
                    <tr key={o.id}>
                      <td><span className="font-mono text-xs">{o.publicId}</span></td>
                      <td className="text-sm font-semibold">{o.pharmacyName}</td>
                      <td><span className="text-xs font-bold uppercase">{o.status}</span></td>
                      <td className="text-xs">{o.amountTotal != null ? `₹${o.amountTotal}` : '—'}</td>
                      <td>
                        {o.isSandbox
                          ? <span className="text-xs text-violet-600 font-bold">Sandbox</span>
                          : <span className="text-xs text-emerald-600 font-bold">Live</span>}
                      </td>
                      <td>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${WEBHOOK_CHIP[o.lastOrderPlacedWebhookStatus] || 'bg-gray-100 text-gray-600'}`}>
                          {o.lastOrderPlacedWebhookStatus || '—'}
                        </span>
                      </td>
                      <td className="text-xs text-mc-text-muted">
                        {o.createdAt ? new Date(o.createdAt).toLocaleString('en-IN', {dateStyle:'short',timeStyle:'short'}) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </McCard>
      )}

      {/* ── Webhooks tab ──────────────────────────────────────────────── */}
      {tab === 'webhooks' && (
        <McCard noPadding>
          <div className="p-4 flex flex-wrap gap-3 border-b border-mc-border">
            <select value={webhookEventFilter} onChange={e => setWebhookEventFilter(e.target.value)}
              className="border border-mc-border rounded-lg px-3 py-1.5 text-xs bg-mc-bg outline-none">
              <option value="">All events</option>
              <option value="pharmacy">Pharmacy only (order / Rx / payment / probe)</option>
              <option value="emergency">Emergency only</option>
            </select>
          </div>
          {loading ? (
            <div className="flex justify-center py-16"><div className="animate-spin h-10 w-10 border-4 border-indigo-100 border-t-indigo-600 rounded-full" /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="mc-data-table">
                <thead>
                  <tr>
                    <th>Event</th>
                    <th>Status</th>
                    <th>Attempts</th>
                    <th>Response</th>
                    <th>Last Attempt</th>
                    <th>Next Retry</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {webhooks.length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-10 text-mc-text-muted">No webhook deliveries yet</td></tr>
                  ) : webhooks.map(w => (
                    <tr key={w.id}>
                      <td><span className="font-mono text-xs">{w.event_type}</span></td>
                      <td>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${WEBHOOK_CHIP[w.status] || 'bg-gray-100 text-gray-600'}`}>
                          {w.status}
                        </span>
                      </td>
                      <td className="text-center text-sm font-bold">{w.attempts}</td>
                      <td className="text-xs">{w.response_code || '—'}</td>
                      <td className="text-xs text-mc-text-muted">
                        {w.last_attempt_at ? new Date(w.last_attempt_at).toLocaleString('en-IN',{dateStyle:'short',timeStyle:'short'}) : '—'}
                      </td>
                      <td className="text-xs text-mc-text-muted">
                        {w.next_retry_at ? new Date(w.next_retry_at).toLocaleString('en-IN',{dateStyle:'short',timeStyle:'short'}) : '—'}
                      </td>
                      <td>
                        {['failed','permanently_failed'].includes(w.status) && (
                          <button onClick={() => retryWebhook(w.id)}
                            className="text-xs px-2 py-1 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 font-bold">
                            Retry
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </McCard>
      )}

      {/* ── Logs tab ──────────────────────────────────────────────────── */}
      {tab === 'logs' && (
        <McCard noPadding>
          {loading ? (
            <div className="flex justify-center py-16"><div className="animate-spin h-10 w-10 border-4 border-indigo-100 border-t-indigo-600 rounded-full" /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="mc-data-table">
                <thead>
                  <tr>
                    <th>Method</th>
                    <th>Path</th>
                    <th>Status</th>
                    <th>Client IP</th>
                    <th>Duration</th>
                    <th>Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.length === 0 ? (
                    <tr><td colSpan={6} className="text-center py-10 text-mc-text-muted">No API request logs yet</td></tr>
                  ) : logs.map(l => (
                    <tr key={l.id}>
                      <td>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${
                          l.request_method === 'POST' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
                        }`}>
                          {l.request_method}
                        </span>
                      </td>
                      <td><span className="font-mono text-xs text-mc-text">{l.request_path}</span></td>
                      <td>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          l.response_status >= 200 && l.response_status < 300 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {l.response_status}
                        </span>
                      </td>
                      <td><span className="font-mono text-xs text-mc-text-muted">{l.ip_address || '—'}</span></td>
                      <td className="text-xs text-mc-text">{l.duration_ms ? `${Number(l.duration_ms).toFixed(1)}ms` : '—'}</td>
                      <td className="text-xs text-mc-text-muted">
                        {l.created_at ? new Date(l.created_at).toLocaleString('en-IN', {dateStyle:'short',timeStyle:'short'}) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </McCard>
      )}
    </AdminPageLayout>
  )
}

export default PartnerDashboard
