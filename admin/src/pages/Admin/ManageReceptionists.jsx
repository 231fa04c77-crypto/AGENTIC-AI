import React, { useContext, useEffect, useMemo, useState } from 'react'
import { AdminContext } from '../../context/AdminContext'
import { toast } from 'react-toastify'
import { AdminPageLayout, PageHero, KpiCard, FilterToolbar, McSearch, McButton, McCard } from '../../components/mc'

const inputCls =
  'w-full px-3 py-2 rounded-lg border border-slate-200 bg-white focus:border-teal-500 outline-none text-sm text-slate-700'

const ManageReceptionists = () => {
  const {
    receptionists,
    getReceptionists,
    addReceptionist,
    toggleReceptionist,
    resetReceptionistPassword,
    deleteReceptionist,
    hospitals,
    getAllHospitals,
  } = useContext(AdminContext)
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', hospitalId: '' })
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [filterHospital, setFilterHospital] = useState('')
  const [q, setQ] = useState('')

  useEffect(() => {
    getReceptionists()
    getAllHospitals()
  }, [])

  const hospitalName = (id) =>
    hospitals.find((h) => String(h._id || h.id) === String(id))?.name || '—'

  const filtered = useMemo(() => {
    let rows = receptionists
    if (filterHospital) rows = rows.filter((r) => String(r.hospital_id) === String(filterHospital))
    if (q.trim()) {
      const s = q.trim().toLowerCase()
      rows = rows.filter(
        (r) =>
          (r.name || '').toLowerCase().includes(s) ||
          (r.email || '').toLowerCase().includes(s) ||
          (r.hospital_name || '').toLowerCase().includes(s)
      )
    }
    return rows
  }, [receptionists, filterHospital, q])

  const stats = useMemo(
    () => ({
      total: filtered.length,
      active: filtered.filter((r) => r.is_active).length,
      disabled: filtered.filter((r) => !r.is_active).length,
    }),
    [filtered]
  )

  const submit = async (e) => {
    e.preventDefault()
    if (!form.name || !form.email || !form.password || !form.hospitalId)
      return toast.error('Name, email, password and hospital are required')
    setSaving(true)
    const ok = await addReceptionist(form)
    setSaving(false)
    if (ok) {
      setForm({ name: '', email: '', phone: '', password: '', hospitalId: '' })
      setShowForm(false)
    }
  }

  const onReset = async (r) => {
    const pw = window.prompt(`New password for ${r.name}:`)
    if (pw) await resetReceptionistPassword(r.id, pw)
  }
  const onDelete = async (r) => {
    if (window.confirm(`Remove receptionist "${r.name}"?`)) await deleteReceptionist(r.id)
  }

  return (
    <AdminPageLayout>
      <PageHero
        title='Receptionists'
        subtitle='Front-desk staff scoped to a single hospital.'
        features={['Hospital scoped', 'Access control']}
      />

      <div className='mc-kpi-grid' style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
          <KpiCard label='Total' value={stats.total} iconBg='bg-sky-100 text-sky-600'
            icon={<svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' /></svg>}
          />
          <KpiCard label='Active' value={stats.active} iconBg='bg-emerald-100 text-emerald-600'
            icon={<svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' /></svg>}
          />
          <KpiCard label='Disabled' value={stats.disabled} iconBg='bg-slate-100 text-slate-500'
            icon={<svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636' /></svg>}
          />
      </div>

      <FilterToolbar
        actions={
          <McButton onClick={() => setShowForm((s) => !s)}>
            {showForm ? 'Close' : '+ Add'}
          </McButton>
        }
      >
        <McSearch placeholder='Search name or email…' value={q} onChange={(e) => setQ(e.target.value)} />
        <select
          value={filterHospital}
          onChange={(e) => setFilterHospital(e.target.value)}
          className='mc-input mc-select'
        >
          <option value=''>All Hospitals</option>
          {hospitals.map((h) => (
            <option key={h._id || h.id} value={h._id || h.id}>
              {h.name}
            </option>
          ))}
        </select>
      </FilterToolbar>

      {showForm && (
        <form onSubmit={submit} className='mc-card p-3.5'>
          <p className='text-xs font-bold text-rd-muted uppercase tracking-wider mb-3'>New receptionist</p>
          <div className='grid sm:grid-cols-2 lg:grid-cols-3 gap-2.5'>
            <input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder='Full name *' />
            <input className={inputCls} type='email' value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder='Email *' />
            <select className={inputCls} value={form.hospitalId} onChange={(e) => setForm({ ...form, hospitalId: e.target.value })}>
              <option value=''>Hospital *</option>
              {hospitals.map((h) => (
                <option key={h._id || h.id} value={h._id || h.id}>{h.name}</option>
              ))}
            </select>
            <input className={inputCls} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder='Phone' />
            <input className={inputCls} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder='Password *' />
          </div>
          <div className='flex justify-end gap-2 mt-3'>
            <button type='button' onClick={() => setShowForm(false)} className='mc-btn mc-btn--outline'>Cancel</button>
            <button type='submit' disabled={saving} className='mc-btn mc-btn--primary disabled:opacity-50'>
              {saving ? 'Creating…' : 'Create'}
            </button>
          </div>
        </form>
      )}

      <McCard title={`Accounts (${filtered.length})`} noPadding bodyClassName=''>
        {filtered.length === 0 ? (
          <p className='text-sm text-rd-muted text-center py-8'>No receptionists found</p>
        ) : (
          <div className='overflow-x-auto'>
            <table className='w-full text-sm'>
              <thead>
                <tr className='text-left text-[10px] uppercase tracking-wider text-rd-muted border-b border-slate-100 bg-slate-50/70'>
                  <th className='px-3 py-2 font-bold'>Name</th>
                  <th className='px-3 py-2 font-bold'>Email</th>
                  <th className='px-3 py-2 font-bold'>Hospital</th>
                  <th className='px-3 py-2 font-bold'>Status</th>
                  <th className='px-3 py-2 font-bold text-right'>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className='border-b border-slate-50 hover:bg-slate-50/50'>
                    <td className='px-3 py-2'>
                      <div className='flex items-center gap-2'>
                        <div className='w-7 h-7 rounded-full bg-gradient-to-br from-teal-500 to-sky-600 text-white flex items-center justify-center font-bold text-[10px]'>
                          {(r.name || '?').charAt(0).toUpperCase()}
                        </div>
                        <span className='font-semibold text-rd-text text-sm'>{r.name}</span>
                      </div>
                    </td>
                    <td className='px-3 py-2 text-rd-muted text-xs'>{r.email}</td>
                    <td className='px-3 py-2 text-rd-muted text-xs'>{r.hospital_name || hospitalName(r.hospital_id)}</td>
                    <td className='px-3 py-2'>
                      <button
                        onClick={() => toggleReceptionist(r.id, !r.is_active)}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          r.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${r.is_active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                        {r.is_active ? 'Active' : 'Off'}
                      </button>
                    </td>
                    <td className='px-3 py-2'>
                      <div className='flex items-center justify-end gap-1.5'>
                        <button onClick={() => onReset(r)} className='px-2 py-1 rounded-md border border-slate-200 text-slate-600 text-[10px] font-bold hover:bg-slate-50'>
                          Reset
                        </button>
                        <button onClick={() => onDelete(r)} className='px-2 py-1 rounded-md border border-rose-200 text-rose-600 text-[10px] font-bold hover:bg-rose-50'>
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </McCard>
    </AdminPageLayout>
  )
}

export default ManageReceptionists
