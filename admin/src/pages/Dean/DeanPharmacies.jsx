import React, { useContext, useEffect, useState } from 'react'

import axios from 'axios'

import { DeanContext } from '../../context/DeanContext'

import { toast } from 'react-toastify'

import GlassCard from '../../components/ui/GlassCard'



const inputCls = 'w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-dean outline-none text-sm font-medium text-slate-700'



const emptyForm = {

  partner_id: '',

  name: '',

  manager_name: '',

  email: '',

  phone: '',

  address: '',

  license_number: '',

  pharmacy_type: 'main',

  supports_pickup: true,

  supports_delivery: false,

  hours_text: '',

  priority: 100,

}



const connectionBadge = (status) => {

  const s = (status || 'pending').toLowerCase()

  if (s === 'connected') return 'bg-emerald-100 text-emerald-700'

  if (s === 'failed') return 'bg-rose-100 text-rose-700'

  return 'bg-amber-100 text-amber-700'

}



const DeanPharmacies = () => {

  const { deanToken } = useContext(DeanContext)

  const backendUrl = import.meta.env.VITE_BACKEND_URL



  const [pharmacies, setPharmacies] = useState([])

  const [partners, setPartners] = useState([])

  const [loading, setLoading] = useState(true)

  const [showForm, setShowForm] = useState(false)

  const [editingId, setEditingId] = useState(null)

  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState(emptyForm)



  const headers = { deantoken: deanToken }

  const showPartnerPicker = partners.length > 1



  const load = async () => {

    setLoading(true)

    try {

      const [ph, pr] = await Promise.all([

        axios.get(`${backendUrl}/api/dean/pharmacies/`, { headers }),

        axios.get(`${backendUrl}/api/dean/pharmacies/available-partners`, { headers }),

      ])

      if (ph.data.success) setPharmacies(ph.data.data || [])

      if (pr.data.success) setPartners(pr.data.data || [])

    } catch (err) {

      toast.error(err?.response?.data?.detail || 'Failed to load pharmacies')

    } finally {

      setLoading(false)

    }

  }



  useEffect(() => {

    if (deanToken) load()

  }, [deanToken])



  const resetForm = () => {

    setForm(emptyForm)

    setEditingId(null)

    setShowForm(false)

  }



  const openCreate = () => {

    setEditingId(null)

    setForm({

      ...emptyForm,

      partner_id: partners.length === 1 ? String(partners[0].id) : '',

    })

    setShowForm(true)

  }



  const openEdit = (p) => {

    const hours = p.hours && typeof p.hours === 'object' ? p.hours : {}

    setEditingId(p.id)

    setForm({

      partner_id: String(p.partnerId || ''),

      name: p.name || '',

      manager_name: p.managerName || '',

      email: p.email || '',

      phone: p.phone || '',

      address: p.address || '',

      license_number: p.licenseNumber || '',

      pharmacy_type: p.pharmacyType || 'main',

      supports_pickup: !!p.supportsPickup,

      supports_delivery: !!p.supportsDelivery,

      hours_text: hours.label || hours.hours || (typeof hours === 'string' ? hours : ''),

      priority: p.priority ?? 100,

    })

    setShowForm(true)

  }



  const parseHours = (text) => {

    const trimmed = (text || '').trim()

    if (!trimmed) return undefined

    return { label: trimmed }

  }



  const submit = async (e) => {

    e.preventDefault()

    if (!editingId) {

      if (!form.name || !form.manager_name || !form.email || !form.phone) {

        return toast.error('Pharmacy name, manager, email, and phone are required')

      }

      if (showPartnerPicker && !form.partner_id) {

        return toast.error('Select a pharmacy partner')

      }

      if (partners.length === 0) {

        return toast.error('No PharmaSync partner registered. Contact Super Admin.')

      }

    } else if (!form.name) {

      return toast.error('Pharmacy name is required')

    }



    setSaving(true)

    try {

      if (editingId) {

        const payload = {

          name: form.name,

          manager_name: form.manager_name || undefined,

          email: form.email || undefined,

          phone: form.phone || undefined,

          address: form.address || undefined,

          license_number: form.license_number || undefined,

          pharmacy_type: form.pharmacy_type,

          supports_pickup: form.supports_pickup,

          supports_delivery: form.supports_delivery,

          priority: parseInt(form.priority, 10) || 100,

        }

        const hours = parseHours(form.hours_text)

        if (hours) payload.hours = hours

        const { data } = await axios.put(

          `${backendUrl}/api/dean/pharmacies/${editingId}`,

          payload,

          { headers },

        )

        if (data.success) {

          toast.success('Pharmacy updated')

          resetForm()

          load()

        }

      } else {

        const payload = {

          name: form.name,

          manager_name: form.manager_name,

          email: form.email,

          phone: form.phone,

          address: form.address || undefined,

          license_number: form.license_number || undefined,

          pharmacy_type: form.pharmacy_type,

          supports_pickup: form.supports_pickup,

          supports_delivery: form.supports_delivery,

          priority: parseInt(form.priority, 10) || 100,

        }

        if (form.partner_id) payload.partner_id = parseInt(form.partner_id, 10)

        const hours = parseHours(form.hours_text)

        if (hours) payload.hours = hours

        const { data } = await axios.post(

          `${backendUrl}/api/dean/pharmacies/`,

          payload,

          { headers },

        )

        if (data.success) {

          const ref = data.data?.partnerPharmacyRef

          toast.success(ref ? `Connected with PharmaSync (${ref})` : 'Pharmacy connected with PharmaSync')

          resetForm()

          load()

        }

      }

    } catch (err) {

      toast.error(err?.response?.data?.detail || err.message)

    } finally {

      setSaving(false)

    }

  }



  const deactivate = async (id) => {

    if (!window.confirm('Deactivate this pharmacy?')) return

    try {

      await axios.delete(`${backendUrl}/api/dean/pharmacies/${id}`, { headers })

      toast.success('Pharmacy deactivated')

      load()

    } catch (err) {

      toast.error(err?.response?.data?.detail || err.message)

    }

  }



  return (

    <div className="p-4 md:p-8 max-w-5xl mx-auto">

      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">

        <div>

          <h1 className="text-2xl font-black text-slate-800">Pharmacy Management</h1>

          <p className="text-sm text-slate-500 mt-1">

            Add your hospital pharmacy and connect it with PharmaSync for prescriptions and orders.

          </p>

        </div>

        <button

          onClick={() => (showForm ? resetForm() : openCreate())}

          className="px-4 py-2.5 bg-dean text-white rounded-xl text-sm font-bold"

        >

          {showForm ? 'Cancel' : 'Add Pharmacy'}

        </button>

      </div>



      {showForm && (

        <GlassCard className="mb-6 p-5">

          <h2 className="text-sm font-black text-slate-700 mb-1">

            {editingId ? 'Edit Pharmacy' : 'Add Hospital Pharmacy'}

          </h2>

          {!editingId && (

            <p className="text-xs text-slate-500 mb-4">

              Enter pharmacy details, then connect with PharmaSync to enable prescription routing.

            </p>

          )}

          <form onSubmit={submit} className="grid sm:grid-cols-2 gap-4">

            {!editingId && showPartnerPicker && (

              <div className="sm:col-span-2">

                <label className="text-xs font-bold text-slate-400 uppercase">Pharmacy Partner</label>

                <select

                  required

                  className={inputCls}

                  value={form.partner_id}

                  onChange={e => setForm(p => ({ ...p, partner_id: e.target.value }))}

                >

                  <option value="">Select PharmaSync partner…</option>

                  {partners.map(p => (

                    <option key={p.id} value={p.id}>{p.name} ({p.publicId})</option>

                  ))}

                </select>

              </div>

            )}

            {!editingId && partners.length === 0 && (

              <p className="sm:col-span-2 text-xs text-amber-600">

                No active PharmaSync partner yet. Ask Super Admin to register PharmaSync under Enterprise Integrations.

              </p>

            )}

            <div className="sm:col-span-2">

              <label className="text-xs font-bold text-slate-400 uppercase">Pharmacy Name *</label>

              <input

                required

                className={inputCls}

                value={form.name}

                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}

                placeholder="Apollo Hospital Pharmacy"

              />

            </div>

            <div>

              <label className="text-xs font-bold text-slate-400 uppercase">Pharmacy Manager *</label>

              <input

                required={!editingId}

                className={inputCls}

                value={form.manager_name}

                onChange={e => setForm(p => ({ ...p, manager_name: e.target.value }))}

                placeholder="Ramesh Kumar"

              />

            </div>

            <div>

              <label className="text-xs font-bold text-slate-400 uppercase">Email *</label>

              <input

                required={!editingId}

                type="email"

                className={inputCls}

                value={form.email}

                onChange={e => setForm(p => ({ ...p, email: e.target.value }))}

                placeholder="pharmacy@example.com"

              />

            </div>

            <div>

              <label className="text-xs font-bold text-slate-400 uppercase">Phone *</label>

              <input

                required={!editingId}

                className={inputCls}

                value={form.phone}

                onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}

                placeholder="XXXXXXXXXX"

              />

            </div>

            <div>

              <label className="text-xs font-bold text-slate-400 uppercase">License Number</label>

              <input

                className={inputCls}

                value={form.license_number}

                onChange={e => setForm(p => ({ ...p, license_number: e.target.value }))}

                placeholder="DL-XXXX"

              />

            </div>

            <div className="sm:col-span-2">

              <label className="text-xs font-bold text-slate-400 uppercase">Address</label>

              <input

                className={inputCls}

                value={form.address}

                onChange={e => setForm(p => ({ ...p, address: e.target.value }))}

                placeholder="Hospital Address"

              />

            </div>

            <div>

              <label className="text-xs font-bold text-slate-400 uppercase">Type</label>

              <select

                className={inputCls}

                value={form.pharmacy_type}

                onChange={e => setForm(p => ({ ...p, pharmacy_type: e.target.value }))}

              >

                <option value="main">Main</option>

                <option value="emergency">Emergency</option>

                <option value="24x7">24×7</option>

              </select>

            </div>

            <div>

              <label className="text-xs font-bold text-slate-400 uppercase">Hours</label>

              <input

                className={inputCls}

                value={form.hours_text}

                onChange={e => setForm(p => ({ ...p, hours_text: e.target.value }))}

                placeholder="Mon–Sat 9:00–21:00"

              />

            </div>

            <div className="flex items-center gap-4 pt-6">

              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">

                <input

                  type="checkbox"

                  checked={form.supports_pickup}

                  onChange={e => setForm(p => ({ ...p, supports_pickup: e.target.checked }))}

                />

                Pickup

              </label>

              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">

                <input

                  type="checkbox"

                  checked={form.supports_delivery}

                  onChange={e => setForm(p => ({ ...p, supports_delivery: e.target.checked }))}

                />

                Delivery

              </label>

            </div>

            <div className="sm:col-span-2 flex justify-end">

              <button

                type="submit"

                disabled={saving || (!editingId && partners.length === 0)}

                className="px-5 py-2.5 bg-dean text-white rounded-xl text-sm font-bold disabled:opacity-50"

              >

                {saving

                  ? (editingId ? 'Saving…' : 'Connecting…')

                  : (editingId ? 'Update Pharmacy' : 'Connect with PharmaSync')}

              </button>

            </div>

          </form>

        </GlassCard>

      )}



      <GlassCard className="overflow-hidden">

        {loading ? (

          <div className="py-16 flex justify-center">

            <div className="animate-spin h-10 w-10 border-4 border-teal-100 border-t-teal-600 rounded-full" />

          </div>

        ) : pharmacies.length === 0 ? (

          <div className="py-14 text-center text-slate-400">

            <p className="font-semibold text-slate-600">No pharmacies connected yet</p>

            <p className="text-sm mt-1">Add a pharmacy and connect with PharmaSync so patients can order medicines.</p>

          </div>

        ) : (

          <table className="w-full text-sm">

            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-400">

              <tr>

                <th className="px-4 py-3">Pharmacy</th>

                <th className="px-4 py-3">Manager</th>

                <th className="px-4 py-3">PharmaSync ID</th>

                <th className="px-4 py-3">Connection</th>

                <th className="px-4 py-3">Fulfillment</th>

                <th className="px-4 py-3 text-right">Actions</th>

              </tr>

            </thead>

            <tbody>

              {pharmacies.map(p => (

                <tr key={p.id} className="border-t border-slate-100">

                  <td className="px-4 py-3">

                    <p className="font-bold text-slate-800">{p.name}</p>

                    <p className="text-xs text-slate-400 mt-0.5">{p.email || '—'}</p>

                  </td>

                  <td className="px-4 py-3 text-slate-600">{p.managerName || '—'}</td>

                  <td className="px-4 py-3 font-mono text-xs text-slate-600">

                    {p.partnerPharmacyRef || '—'}

                  </td>

                  <td className="px-4 py-3">

                    <span className={`text-xs font-bold px-2 py-0.5 rounded-lg uppercase ${connectionBadge(p.connectionStatus)}`}>

                      {p.connectionStatus || 'pending'}

                    </span>

                  </td>

                  <td className="px-4 py-3 text-xs">

                    {p.supportsPickup ? 'Pickup ' : ''}

                    {p.supportsDelivery ? 'Delivery' : ''}

                  </td>

                  <td className="px-4 py-3 text-right space-x-3">

                    <button

                      onClick={() => openEdit(p)}

                      className="text-xs font-bold text-dean hover:underline"

                    >

                      Edit

                    </button>

                    {p.isActive && (

                      <button

                        onClick={() => deactivate(p.id)}

                        className="text-xs font-bold text-rose-600 hover:underline"

                      >

                        Deactivate

                      </button>

                    )}

                  </td>

                </tr>

              ))}

            </tbody>

          </table>

        )}

      </GlassCard>

    </div>

  )

}



export default DeanPharmacies


