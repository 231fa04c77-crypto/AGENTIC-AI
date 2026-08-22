import React, { useContext, useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import { DeanContext } from '../../context/DeanContext'
import { toast } from 'react-toastify'
import GlassCard from '../../components/ui/GlassCard'

const Stat = ({ label, value, tone }) => {
  const tones = {
    teal: 'bg-teal-50 text-teal-600 border-teal-100',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    rose: 'bg-rose-50 text-rose-600 border-rose-100'
  }
  return (
    <div className='bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-4'>
      <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center font-black text-lg ${tones[tone]}`}>{value}</div>
      <p className='text-sm font-semibold text-slate-500'>{label}</p>
    </div>
  )
}

const inputCls = 'w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-dean outline-none text-sm font-medium text-slate-700'

const DeanAmbulances = () => {
  const { deanToken, deanInfo } = useContext(DeanContext)
  const [ambulances, setAmbulances] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)

  const [form, setForm] = useState({
    vehicle_number: '',
    vehicle_type: 'BLS',
    operator_name: '',
    operator_phone: '',
    operator_email: '',
    operator_username: '',
    operator_password: ''
  })

  const backendUrl = import.meta.env.VITE_BACKEND_URL

  const getAmbulances = async () => {
    try {
      const { data } = await axios.get(`${backendUrl}/api/dispatch/hospital/ambulances`, {
        headers: { deantoken: deanToken }
      })
      if (data.success) {
        setAmbulances(data.data || [])
      }
    } catch (err) {
      console.error('Fetch ambulances error:', err)
      toast.error('Failed to load ambulance fleet')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (deanToken) getAmbulances()
  }, [deanToken])

  const stats = useMemo(() => ({
    total: ambulances.length,
    available: ambulances.filter(a => (a.status || '').toLowerCase() === 'available').length,
    busy: ambulances.filter(a => (a.status || '').toLowerCase() === 'busy').length,
  }), [ambulances])

  const submit = async (e) => {
    e.preventDefault()
    if (!form.vehicle_number || !form.operator_name || !form.operator_phone) {
      return toast.error('Vehicle Number, Driver Name, and Driver Mobile are required')
    }

    setSaving(true)
    try {
      // Create request payload (omit blank username/password)
      const payload = { ...form }
      if (!payload.operator_username) delete payload.operator_username
      if (!payload.operator_password) delete payload.operator_password

      const { data } = await axios.post(
        `${backendUrl}/api/dispatch/hospital/ambulances`,
        payload,
        { headers: { deantoken: deanToken } }
      )
      if (data.success) {
        toast.success('Ambulance and driver registered successfully!')
        setForm({
          vehicle_number: '',
          vehicle_type: 'BLS',
          operator_name: '',
          operator_phone: '',
          operator_email: '',
          operator_username: '',
          operator_password: ''
        })
        setShowForm(false)
        getAmbulances()
      }
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Ambulance registration failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className='p-4 sm:p-6 lg:p-8 max-w-[1300px] mx-auto w-full'>
      <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6'>
        <div>
          <h1 className='text-2xl font-black text-slate-800 tracking-tight'>Manage Ambulance Fleet</h1>
          <p className='text-sm text-slate-500 mt-0.5'>Register emergency vehicles, drivers, and operator login credentials for {deanInfo?.hospitalName || 'your hospital'}.</p>
        </div>
        <button onClick={() => setShowForm(s => !s)} className='px-4 py-2.5 rounded-xl bg-dean text-white text-sm font-bold shadow-sm hover:opacity-90 flex items-center gap-2 transition active:scale-95'>
          <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M12 4v16m8-8H4' /></svg>
          Add Ambulance
        </button>
      </div>

      <div className='grid grid-cols-3 gap-3 sm:gap-4 mb-5'>
        <Stat label='Total Vehicles' value={stats.total} tone='teal' />
        <Stat label='Available' value={stats.available} tone='emerald' />
        <Stat label='On Dispatch (Busy)' value={stats.busy} tone='rose' />
      </div>

      {showForm && (
        <form onSubmit={submit} className='bg-white rounded-2xl border border-slate-100 shadow-sm p-5 mb-5 space-y-4'>
          <p className='text-sm font-black text-slate-700'>New Emergency Vehicle & Driver</p>
          <div className='grid sm:grid-cols-2 lg:grid-cols-3 gap-4'>
            <div className='space-y-1.5'>
              <label className='text-xs font-bold text-slate-500'>Vehicle Number *</label>
              <input className={inputCls} value={form.vehicle_number} onChange={e => setForm({ ...form, vehicle_number: e.target.value })} placeholder='e.g. AP-07-XX-9999' />
            </div>
            <div className='space-y-1.5'>
              <label className='text-xs font-bold text-slate-500'>Vehicle Type *</label>
              <select className={inputCls} value={form.vehicle_type} onChange={e => setForm({ ...form, vehicle_type: e.target.value })}>
                <option value="BLS">Basic Life Support (BLS)</option>
                <option value="ALS">Advanced Life Support (ALS)</option>
                <option value="ICU">Mobile ICU / Cardiac</option>
              </select>
            </div>
            <div className='space-y-1.5'>
              <label className='text-xs font-bold text-slate-500'>Driver Name *</label>
              <input className={inputCls} value={form.operator_name} onChange={e => setForm({ ...form, operator_name: e.target.value })} placeholder='Driver Full Name' />
            </div>
            <div className='space-y-1.5'>
              <label className='text-xs font-bold text-slate-500'>Driver Mobile (For SMS link) *</label>
              <input className={inputCls} value={form.operator_phone} onChange={e => setForm({ ...form, operator_phone: e.target.value })} placeholder='+91 98765 43210' />
            </div>
            <div className='space-y-1.5'>
              <label className='text-xs font-bold text-slate-500'>Driver Email (For testing link) *</label>
              <input className={inputCls} type='email' value={form.operator_email} onChange={e => setForm({ ...form, operator_email: e.target.value })} placeholder='driver@medclues.com' />
            </div>
            <div className='space-y-1.5'>
              <label className='text-xs font-bold text-slate-500'>Operator Username (Optional — App Login)</label>
              <input className={inputCls} value={form.operator_username} onChange={e => setForm({ ...form, operator_username: e.target.value })} placeholder='e.g. driver_ravi' />
            </div>
            <div className='space-y-1.5'>
              <label className='text-xs font-bold text-slate-500'>Operator Password (Optional)</label>
              <input className={inputCls} type='password' value={form.operator_password} onChange={e => setForm({ ...form, operator_password: e.target.value })} placeholder='Min 6 characters' />
            </div>
          </div>

          <div className='flex justify-end gap-2 pt-2'>
            <button type='button' onClick={() => setShowForm(false)} className='px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-sm font-bold hover:bg-slate-50 transition'>Cancel</button>
            <button type='submit' disabled={saving} className='px-5 py-2 rounded-xl bg-dean text-white text-sm font-bold hover:opacity-90 disabled:opacity-50 transition'>{saving ? 'Saving…' : 'Register Vehicle & Driver'}</button>
          </div>
        </form>
      )}

      <div className='bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden'>
        {loading ? (
          <div className='py-16 flex justify-center'>
            <div className='animate-spin h-8 w-8 border-3 border-dean border-t-transparent rounded-full' />
          </div>
        ) : ambulances.length === 0 ? (
          <div className='py-16 text-center'>
            <p className='text-sm font-bold text-slate-600'>No ambulances registered yet</p>
            <p className='text-xs text-slate-400 mt-1'>Add your hospital's emergency fleet here to enable dispatch.</p>
          </div>
        ) : (
          <div className='overflow-x-auto'>
            <table className='w-full text-sm text-left'>
              <thead>
                <tr className='text-left text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-100 bg-slate-50/60'>
                  <th className='px-6 py-3.5 font-bold'>Vehicle</th>
                  <th className='px-6 py-3.5 font-bold'>Type</th>
                  <th className='px-6 py-3.5 font-bold'>Driver / Operator</th>
                  <th className='px-6 py-3.5 font-bold'>Phone</th>
                  <th className='px-6 py-3.5 font-bold'>Email</th>
                  <th className='px-6 py-3.5 font-bold'>Status</th>
                  <th className='px-6 py-3.5 font-bold'>Last Location</th>
                </tr>
              </thead>
              <tbody>
                {ambulances.map(a => (
                  <tr key={a.id} className='border-b border-slate-50 hover:bg-slate-50/60 transition-colors'>
                    <td className='px-6 py-4 font-bold text-slate-700 flex items-center gap-2'>
                      <span>🚑</span>
                      {a.vehicle_number}
                    </td>
                    <td className='px-6 py-4 text-slate-600 font-semibold'>
                      <span className='px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded border border-slate-200'>
                        {a.vehicle_type}
                      </span>
                    </td>
                    <td className='px-6 py-4 font-bold text-slate-700'>{a.operator_name || '—'}</td>
                    <td className='px-6 py-4 text-slate-600 font-mono'>{a.operator_phone || '—'}</td>
                    <td className='px-6 py-4 text-slate-600 font-mono'>{a.operator_email || '—'}</td>
                    <td className='px-6 py-4'>
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                        (a.status || '').toLowerCase() === 'available'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-rose-50 text-rose-700 border-rose-200 animate-pulse'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          (a.status || '').toLowerCase() === 'available' ? 'bg-emerald-500' : 'bg-rose-500'
                        }`} />
                        {a.status || 'available'}
                      </span>
                    </td>
                    <td className='px-6 py-4 text-slate-500 font-mono text-xs'>
                      {a.latitude && a.longitude ? (
                        <a
                          href={`https://maps.google.com/?q=${a.latitude},${a.longitude}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-500 hover:underline"
                        >
                          📍 {parseFloat(a.latitude).toFixed(4)}, {parseFloat(a.longitude).toFixed(4)}
                        </a>
                      ) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default DeanAmbulances
