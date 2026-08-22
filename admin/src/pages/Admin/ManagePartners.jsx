import React, { useContext, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'
import { AdminContext } from '../../context/AdminContext'
import { toast } from 'react-toastify'
import { AdminPageLayout, PageHero, KpiCard, McCard, StatusPill } from '../../components/mc'

// ─── Input & label styles from system ─────────────────────────────────────────
const inputCls = 'w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-admin outline-none text-sm font-medium text-slate-700 transition-colors'
const labelCls = 'block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5'

const FORM_INITIAL = {
  name: '', partner_type: 'PHARMACY', contact_name: '',
  email: '', phone: '', webhook_url: '', rate_limit_rpm: 60,
  ip_whitelist: '', allowed_apis: '',
}

const PARTNER_TYPES = [
  'PHARMACY',
  'LAB',
  'RADIOLOGY',
  'INSURANCE',
  'CORPORATE_HEALTH',
  'WEARABLES',
  'TELEMEDICINE',
  'HOME_HEALTHCARE',
  'TRANSPORT',
  'TECHNOLOGY',
  'INFRASTRUCTURE',
  'CORPORATE',
  'GOVERNMENT',
  'EDUCATION',
  'OTHER',
]

const SCOPE_HINTS = {
  PHARMACY: 'pharmacy.*,pharmacy.prescriptions.read,pharmacy.orders.read,pharmacy.orders.write',
  LAB: 'lab.*,lab.orders.read,lab.orders.write,lab.results.write',
  RADIOLOGY: 'radiology.*,radiology.orders.read,radiology.orders.write',
  INSURANCE: 'insurance.*,insurance.eligibility.read,insurance.claims.write,insurance.claims.read',
  CORPORATE_HEALTH: 'corporate_health.*,corporate_health.employees.read',
  WEARABLES: 'wearables.*,wearables.vitals.write',
  TELEMEDICINE: 'telemedicine.*,telemedicine.sessions.write',
  HOME_HEALTHCARE: 'home_healthcare.*,home_healthcare.visits.write',
  TRANSPORT: 'emergency.create,emergency.status,emergency.cancel,dashboard.*',
}
const EMERGENCY_SCOPES_HINT = SCOPE_HINTS.TRANSPORT
const PHARMACY_SCOPES_HINT = SCOPE_HINTS.PHARMACY

const scopeHintFor = (type) => SCOPE_HINTS[type] || EMERGENCY_SCOPES_HINT


const ManagePartners = () => {
  const { aToken } = useContext(AdminContext)
  const backendUrl = import.meta.env.VITE_BACKEND_URL

  const [partners, setPartners] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(FORM_INITIAL)
  const [submitting, setSubmitting] = useState(false)

  // Detail modal
  const [selected, setSelected] = useState(null)
  const [keyResult, setKeyResult] = useState(null)   // newly created credentials
  const [copied, setCopied] = useState(null)

  // ── Fetch list ──────────────────────────────────────────────────────────────
  const fetchPartners = async () => {
    setLoading(true)
    try {
      const { data } = await axios.get(`${backendUrl}/api/admin/partners/`, {
        headers: { aToken },
      })
      if (data.success) setPartners(data.data || [])
      else toast.error(data.message || 'Failed to load partners')
    } catch (err) {
      toast.error(err?.response?.data?.detail || err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { if (aToken) fetchPartners() }, [aToken])

  // ── Register new partner ────────────────────────────────────────────────────
  const handleRegister = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const body = {
        name: form.name,
        partner_type: form.partner_type,
        contact_name: form.contact_name || null,
        email: form.email || null,
        phone: form.phone || null,
        webhook_url: form.webhook_url || null,
        rate_limit_rpm: form.rate_limit_rpm,
        ip_whitelist: form.ip_whitelist
          ? form.ip_whitelist.split(',').map(s => s.trim()).filter(Boolean)
          : [],
        allowed_apis: form.allowed_apis
          ? form.allowed_apis.split(',').map(s => s.trim()).filter(Boolean)
          : undefined,
      }
      const { data } = await axios.post(`${backendUrl}/api/admin/partners/`, body, {
        headers: { aToken },
      })
      if (data.success) {
        toast.success(`Partner "${data.partner.name}" registered!`)
        setKeyResult(data.credentials)
        setShowForm(false)
        setForm(FORM_INITIAL)
        fetchPartners()
      } else {
        toast.error(data.message || 'Failed to register partner')
      }
    } catch (err) {
      toast.error(err?.response?.data?.detail || err.message)
    } finally {
      setSubmitting(false)
    }
  }

  // ── Activate / disable ──────────────────────────────────────────────────────
  const updateStatus = async (partnerId, status) => {
    try {
      const { data } = await axios.put(
        `${backendUrl}/api/admin/partners/${partnerId}`,
        { status },
        { headers: { aToken } }
      )
      if (data.success) {
        toast.success(`Status updated to "${status}"`)
        fetchPartners()
      }
    } catch (err) {
      toast.error(err?.response?.data?.detail || err.message)
    }
  }

  // ── Generate new key ────────────────────────────────────────────────────────
  const generateKey = async (partnerId, env = 'sandbox') => {
    try {
      const { data } = await axios.post(
        `${backendUrl}/api/admin/partners/${partnerId}/keys`,
        { environment: env },
        { headers: { aToken } }
      )
      if (data.success) {
        setKeyResult(data.credentials)
        toast.success('New key pair generated!')
      }
    } catch (err) {
      toast.error(err?.response?.data?.detail || err.message)
    }
  }

  // ── Soft delete ─────────────────────────────────────────────────────────────
  const deletePartner = async (partnerId) => {
    if (!window.confirm('Disable this partner? All their API keys will stop working.')) return
    try {
      const { data } = await axios.delete(
        `${backendUrl}/api/admin/partners/${partnerId}`,
        { headers: { aToken } }
      )
      if (data.success) { toast.success('Partner disabled'); fetchPartners() }
    } catch (err) {
      toast.error(err?.response?.data?.detail || err.message)
    }
  }

  const rotateWebhookSecret = async (partnerId) => {
    try {
      const { data } = await axios.post(
        `${backendUrl}/api/admin/partners/${partnerId}/webhook-secret/rotate`,
        {},
        { headers: { aToken } }
      )
      if (data.success) {
        setKeyResult({
          webhook_signing_secret: data.credentials.webhook_signing_secret,
          api_key: '(unchanged)',
          secret_key: '(unchanged)',
          environment: 'webhook',
        })
        toast.success('Webhook signing secret rotated')
      }
    } catch (err) {
      toast.error(err?.response?.data?.detail || err.message)
    }
  }

  const revokeApiKey = async (partnerId) => {
    const apiKey = window.prompt('Paste the full API key (pk_…) to revoke')
    if (!apiKey || !apiKey.trim()) return
    if (!window.confirm(`Revoke key ${apiKey.trim().slice(0, 12)}…? This cannot be undone.`)) return
    try {
      const { data } = await axios.delete(
        `${backendUrl}/api/admin/partners/${partnerId}/keys/${encodeURIComponent(apiKey.trim())}`,
        { headers: { aToken } },
      )
      if (data.success) {
        toast.success(data.message || 'Key revoked')
        fetchPartners()
      } else {
        toast.error(data.message || 'Revoke failed')
      }
    } catch (err) {
      toast.error(err?.response?.data?.detail || err.message)
    }
  }

  const savePartnerScopes = async (partnerId) => {
    const raw = window.prompt(
      'Comma-separated allowed_apis scopes',
      selected?.partner_type ? scopeHintFor(selected.partner_type) : EMERGENCY_SCOPES_HINT,
    )
    if (raw == null) return
    try {
      const allowed_apis = raw.split(',').map(s => s.trim()).filter(Boolean)
      const { data } = await axios.put(
        `${backendUrl}/api/admin/partners/${partnerId}`,
        { allowed_apis },
        { headers: { aToken } },
      )
      if (data.success) {
        toast.success('Scopes updated')
        fetchPartners()
        setSelected(null)
      }
    } catch (err) {
      toast.error(err?.response?.data?.detail || err.message)
    }
  }

  const saveIpWhitelist = async (partnerId) => {
    const raw = window.prompt('Comma-separated IP allowlist (blank = allow all)', '')
    if (raw == null) return
    try {
      const ip_whitelist = raw.split(',').map(s => s.trim()).filter(Boolean)
      const { data } = await axios.put(
        `${backendUrl}/api/admin/partners/${partnerId}`,
        { ip_whitelist },
        { headers: { aToken } },
      )
      if (data.success) {
        toast.success('IP allowlist updated')
        fetchPartners()
        setSelected(null)
      }
    } catch (err) {
      toast.error(err?.response?.data?.detail || err.message)
    }
  }

  // ── Copy helper ─────────────────────────────────────────────────────────────
  const copy = (val, label) => {
    navigator.clipboard.writeText(val)
    setCopied(label)
    setTimeout(() => setCopied(null), 1500)
  }

  // ── KPIs ────────────────────────────────────────────────────────────────────
  const kpi = {
    total:    partners.length,
    active:   partners.filter(p => p.status === 'active').length,
    pending:  partners.filter(p => p.status === 'pending').length,
    sandbox:  partners.filter(p => p.key_count > 0).length,
  }

  return (
    <AdminPageLayout maxWidth="max-w-7xl mx-auto">
      <PageHero
        title="Enterprise Integrations"
        subtitle="Register PharmaSync, lab, radiology, insurance, and other partners. Issue API keys, scopes, webhooks, and IP allowlists. Hospital Deans map hospital ops — they never see credentials."
        features={['Pharmacy + Lab + more', 'HMAC Keys', 'Domain Templates', 'Scopes & IP Allowlist']}
      />

      {/* ── KPI cards ─────────────────────────────────────────────────── */}
      <div className="mc-kpi-grid mc-kpi-grid--4">
        <KpiCard label="Total Partners" value={kpi.total} iconBg="bg-indigo-100 text-indigo-600"
          icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 10-4-4 4 4 0 004 4z" /></svg>}
        />
        <KpiCard label="Active" value={kpi.active} iconBg="bg-emerald-100 text-emerald-600"
          icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
        />
        <KpiCard label="Pending" value={kpi.pending} iconBg="bg-amber-100 text-amber-600"
          icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
        />
        <KpiCard label="With Keys" value={kpi.sandbox} iconBg="bg-violet-100 text-violet-600"
          icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>}
        />
      </div>

      {/* ── Action bar ────────────────────────────────────────────────── */}
      <div className="flex justify-between items-center mb-6 flex-wrap gap-3">
        <h2 className="text-lg font-extrabold text-slate-800">Registered Partners</h2>
        <div className="flex items-center gap-2.5">
          <Link
            to="/partner-analytics"
            className="flex items-center gap-2 px-4 py-2.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-sm font-semibold transition"
          >
            <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
            View Analytics & Logs
          </Link>
          <button
            onClick={() => { setShowForm(v => !v); setKeyResult(null) }}
            className="flex items-center gap-2 px-4 py-2.5 bg-admin text-white rounded-xl text-sm font-semibold hover:opacity-95 transition shadow-sm"
          >
            {showForm ? (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                Cancel
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                Register Partner
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── Registration form ──────────────────────────────────────────── */}
      {showForm && (
        <McCard title="New Partner Registration" className="mb-6 border-slate-200">
          <form onSubmit={handleRegister} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Organisation Name *</label>
              <input required value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                className={inputCls} placeholder="e.g. SHAMS Transport" />
            </div>
            <div>
              <label className={labelCls}>Partner Type *</label>
              <select required value={form.partner_type} onChange={e => setForm(p => ({ ...p, partner_type: e.target.value }))}
                className={inputCls}>
                {PARTNER_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Contact Name</label>
              <input value={form.contact_name} onChange={e => setForm(p => ({ ...p, contact_name: e.target.value }))}
                className={inputCls} placeholder="Primary contact person" />
            </div>
            <div>
              <label className={labelCls}>Email</label>
              <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                className={inputCls} placeholder="contact@partner.com" />
            </div>
            <div>
              <label className={labelCls}>Phone</label>
              <input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                className={inputCls} placeholder="+91..." />
            </div>
            <div>
              <label className={labelCls}>Rate Limit (req/min)</label>
              <input type="number" min={1} max={1000} value={form.rate_limit_rpm}
                onChange={e => setForm(p => ({ ...p, rate_limit_rpm: parseInt(e.target.value, 10) }))}
                className={inputCls} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>Webhook URL (optional)</label>
              <input value={form.webhook_url} onChange={e => setForm(p => ({ ...p, webhook_url: e.target.value }))}
                className={inputCls} placeholder="https://partner.com/webhooks/medclues" />
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>Allowed APIs / scopes (optional — defaults by type)</label>
              <input value={form.allowed_apis} onChange={e => setForm(p => ({ ...p, allowed_apis: e.target.value }))}
                className={inputCls}
                placeholder={scopeHintFor(form.partner_type)} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>IP Allowlist (optional, comma-separated)</label>
              <input value={form.ip_whitelist} onChange={e => setForm(p => ({ ...p, ip_whitelist: e.target.value }))}
                className={inputCls} placeholder="203.0.113.10, 198.51.100.5" />
            </div>
            <div className="sm:col-span-2 flex justify-end">
              <button type="submit" disabled={submitting}
                className="px-6 py-2.5 bg-admin text-white rounded-xl text-sm font-bold hover:opacity-90 transition disabled:opacity-50">
                {submitting ? 'Registering…' : 'Register & Generate Key'}
              </button>
            </div>
          </form>
        </McCard>
      )}

      {/* ── Newly issued credentials ───────────────────────────────────── */}
      {keyResult && (
        <div className="mb-6 p-5 rounded-2xl bg-emerald-50/70 border border-emerald-100 shadow-sm">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="font-bold text-emerald-800 text-sm flex items-center gap-1.5">
                <span className="flex w-2.5 h-2.5 rounded-full bg-emerald-500" />
                Credentials Issued Successfully
              </p>
              <p className="text-xs text-emerald-600 mt-1">Save the secret key now — it will NOT be shown again for security reasons.</p>
            </div>
            <button onClick={() => setKeyResult(null)} className="text-emerald-700 hover:text-emerald-950 text-xl font-bold">×</button>
          </div>
          <div className="space-y-3">
            {[
              { label: 'API Key (public)', value: keyResult.api_key },
              { label: 'Secret Key (private)', value: keyResult.secret_key },
              ...(keyResult.webhook_signing_secret
                ? [{ label: 'Webhook Signing Secret', value: keyResult.webhook_signing_secret }]
                : []),
              { label: 'Environment', value: keyResult.environment },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between bg-white rounded-xl px-4 py-3 border border-emerald-100 shadow-sm">
                <div>
                  <span className="text-xs text-emerald-700 font-bold uppercase tracking-wider">{label}</span>
                  <p className="font-mono text-xs text-slate-800 break-all mt-1">{value}</p>
                </div>
                <button onClick={() => copy(value, label)} className="ml-4 text-xs font-semibold text-emerald-600 hover:text-emerald-800 hover:underline shrink-0">
                  {copied === label ? '✓ Copied' : 'Copy'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Partners table ─────────────────────────────────────────────── */}
      <McCard noPadding bodyClassName="overflow-x-auto border-none">
        {loading ? (
          <div className="py-20 flex justify-center">
            <div className="animate-spin h-12 w-12 border-4 border-indigo-100 border-t-indigo-600 rounded-full" />
          </div>
        ) : partners.length === 0 ? (
          <div className="py-16 text-center text-mc-text-muted">
            <svg className="w-16 h-16 mx-auto mb-4 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 10-4-4 4 4 0 004 4z" /></svg>
            <p className="font-semibold">No partners registered yet.</p>
            <p className="text-sm mt-1">Click "Register Partner" to onboard your first integration.</p>
          </div>
        ) : (
          <table className="mc-data-table">
            <thead>
              <tr>
                <th>Partner</th>
                <th>Type</th>
                <th>Status</th>
                <th>Keys</th>
                <th>Rate Limit</th>
                <th>Webhook</th>
                <th>Joined</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {partners.map(p => (
                <tr key={p.id} className="cursor-pointer hover:bg-mc-surface-elevated/50 transition-all" onClick={() => setSelected(p)}>
                  <td>
                    <div>
                      <p className="font-bold text-slate-800 text-sm">{p.name}</p>
                      <p className="text-[11px] text-slate-400 font-mono mt-0.5">{p.public_id}</p>
                    </div>
                  </td>
                  <td>
                    <span className="text-[10px] font-bold tracking-wider uppercase bg-slate-100 text-slate-600 px-2 py-0.5 rounded-lg">
                      {p.partner_type}
                    </span>
                  </td>
                  <td><StatusPill status={p.status} /></td>
                  <td><span className="text-sm font-bold text-slate-700">{p.key_count ?? 0}</span></td>
                  <td><span className="text-xs font-semibold text-slate-600">{p.rate_limit_rpm}/min</span></td>
                  <td>
                    {p.webhook_url ? (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-semibold">
                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" /> Configured
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400 font-medium">—</span>
                    )}
                  </td>
                  <td className="text-xs text-slate-400 font-medium">
                    {p.created_at ? new Date(p.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                  </td>
                  <td className="text-right" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center gap-2 justify-end">
                      {p.status !== 'active' && (
                        <button onClick={() => updateStatus(p.id, 'active')}
                          className="text-xs px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 font-bold transition">
                          Activate
                        </button>
                      )}
                      {p.status === 'active' && (
                        <button onClick={() => updateStatus(p.id, 'pending')}
                          className="text-xs px-2.5 py-1 bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 font-bold transition">
                          Suspend
                        </button>
                      )}
                      <button onClick={() => generateKey(p.id, 'sandbox')}
                        className="text-xs px-2.5 py-1 bg-violet-100 text-violet-700 rounded-lg hover:bg-violet-200 font-bold transition">
                        + Key
                      </button>
                      <button onClick={() => deletePartner(p.id)}
                        className="text-xs px-2.5 py-1 bg-rose-100 text-rose-700 rounded-lg hover:bg-rose-200 font-bold transition">
                        Disable
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </McCard>

      {/* ── Partner detail modal ──────────────────────────────────────── */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={() => setSelected(null)}>
          <div className="bg-mc-surface rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden border border-mc-border" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-mc-border">
              <div>
                <h3 className="font-extrabold text-slate-800 text-base">{selected.name}</h3>
                <p className="text-[11px] font-mono text-slate-400 mt-0.5">{selected.public_id}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-slate-700 text-2xl font-bold">×</button>
            </div>
            <div className="p-6 space-y-4 text-sm max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3.5">
                {[
                  ['Type', selected.partner_type],
                  ['Status', selected.status],
                  ['Contact Name', selected.contact_name || '—'],
                  ['Email Address', selected.email || '—'],
                  ['Phone Number', selected.phone || '—'],
                  ['Rate Limit', `${selected.rate_limit_rpm} req/min`],
                ].map(([k, v]) => (
                  <div key={k} className="bg-slate-50 border border-slate-100 rounded-xl p-3.5">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{k}</p>
                    {k === 'Status' ? (
                      <div className="mt-1"><StatusPill status={v} /></div>
                    ) : (
                      <p className="font-bold text-slate-700 mt-1 truncate">{v}</p>
                    )}
                  </div>
                ))}
              </div>
              {selected.webhook_url && (
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Webhook URL</p>
                  <p className="font-mono text-xs break-all text-slate-600 mt-1.5">{selected.webhook_url}</p>
                </div>
              )}
              <div className="pt-2 flex flex-col gap-2">
                <div className="flex gap-3">
                  <button onClick={() => { generateKey(selected.id, 'sandbox'); setSelected(null) }}
                    className="flex-1 py-2.5 bg-violet-600 text-white rounded-xl text-sm font-bold hover:bg-violet-700 transition shadow-sm">
                    + Sandbox Key
                  </button>
                  <button onClick={() => { generateKey(selected.id, 'production'); setSelected(null) }}
                    className="flex-1 py-2.5 bg-admin text-white rounded-xl text-sm font-bold hover:opacity-90 transition shadow-sm">
                    + Production Key
                  </button>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => { rotateWebhookSecret(selected.id); setSelected(null) }}
                    className="flex-1 py-2.5 border border-slate-200 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-50 transition">
                    Rotate Webhook Secret
                  </button>
                  <button onClick={() => { revokeApiKey(selected.id); setSelected(null) }}
                    className="flex-1 py-2.5 border border-rose-200 text-rose-700 rounded-xl text-sm font-bold hover:bg-rose-50 transition">
                    Revoke API Key
                  </button>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => savePartnerScopes(selected.id)}
                    className="flex-1 py-2.5 border border-slate-200 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-50 transition">
                    Edit Scopes
                  </button>
                  <button onClick={() => saveIpWhitelist(selected.id)}
                    className="flex-1 py-2.5 border border-slate-200 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-50 transition">
                    IP Allowlist
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminPageLayout>
  )
}

export default ManagePartners
