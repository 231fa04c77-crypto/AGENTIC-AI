import React, { useContext, useEffect, useState } from 'react'
import axios from 'axios'
import { AdminContext } from '../../context/AdminContext'
import { DeskPage, DeskHeader, DeskCard } from '../../components/desk/DeskChrome'
import { toast } from 'react-toastify'

const ROUTE_OPTIONS = [
  { value: 'hospitals', label: 'Hospitals' },
  { value: 'pharmacy', label: 'Pharmacy' },
  { value: 'doctors', label: 'Doctors' },
  { value: 'healthProtection', label: 'Health Protection' },
  { value: 'labs', label: 'Labs' },
  { value: 'bloodBanks', label: 'Blood Banks' },
  { value: 'emergency', label: 'Emergency' },
]

const emptyForm = () => ({
  title: '',
  subtitle: '',
  ctaLabel: 'Explore →',
  routeKey: 'hospitals',
  sortOrder: 0,
  isActive: true,
  gradientStart: '#002855',
  gradientMid: '#1565C0',
  gradientEnd: '#7DD3FC',
  iconKey: 'hospital',
})

const HomeBanners = () => {
  const { aToken } = useContext(AdminContext)
  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000'
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [banners, setBanners] = useState([])
  const [form, setForm] = useState(emptyForm())
  const [editId, setEditId] = useState(null)
  const [imageFile, setImageFile] = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const { data } = await axios.get(`${backendUrl}/api/admin/home-banners`, {
        headers: { aToken },
      })
      if (data.success) setBanners(data.banners || [])
      else toast.error(data.message || 'Failed to load banners')
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Failed to load banners')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (aToken) load()
  }, [aToken])

  const resetForm = () => {
    setForm(emptyForm())
    setEditId(null)
    setImageFile(null)
  }

  const startEdit = (b) => {
    setEditId(b.id)
    setForm({
      title: b.title || '',
      subtitle: b.subtitle || '',
      ctaLabel: b.ctaLabel || 'Explore →',
      routeKey: b.routeKey || 'hospitals',
      sortOrder: b.sortOrder ?? 0,
      isActive: b.isActive !== false,
      gradientStart: b.gradientStart || '#002855',
      gradientMid: b.gradientMid || '#1565C0',
      gradientEnd: b.gradientEnd || '#7DD3FC',
      iconKey: b.iconKey || 'hospital',
    })
    setImageFile(null)
  }

  const toFormData = () => {
    const fd = new FormData()
    Object.entries(form).forEach(([k, v]) => {
      if (v === undefined || v === null) return
      fd.append(k, String(v))
    })
    if (imageFile) fd.append('image', imageFile)
    return fd
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!form.title.trim()) {
      toast.error('Title is required')
      return
    }
    setSaving(true)
    try {
      const fd = toFormData()
      const url = editId
        ? `${backendUrl}/api/admin/home-banners/${editId}`
        : `${backendUrl}/api/admin/home-banners`
      const { data } = editId
        ? await axios.put(url, fd, { headers: { aToken } })
        : await axios.post(url, fd, { headers: { aToken } })
      if (data.success) {
        toast.success(editId ? 'Banner updated' : 'Banner created')
        resetForm()
        await load()
      } else {
        toast.error(data.message || 'Save failed')
      }
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this banner?')) return
    try {
      const { data } = await axios.delete(`${backendUrl}/api/admin/home-banners/${id}`, {
        headers: { aToken },
      })
      if (data.success) {
        toast.success('Deleted')
        if (editId === id) resetForm()
        await load()
      } else toast.error(data.message || 'Delete failed')
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Delete failed')
    }
  }

  const field = (label, key, props = {}) => (
    <label className="block text-xs font-semibold text-slate-600 mb-3">
      {label}
      <input
        className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
        value={form[key] ?? ''}
        onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
        {...props}
      />
    </label>
  )

  return (
    <DeskPage>
      <DeskHeader
        title="Home Banners"
        subtitle="Flutter home carousel — change anytime without an app update"
      />
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <DeskCard title={editId ? `Edit banner #${editId}` : 'Add banner'}>
          <form onSubmit={handleSave} className="space-y-1">
            {field('Title *', 'title', { required: true, maxLength: 120 })}
            {field('Subtitle', 'subtitle', { maxLength: 240 })}
            {field('CTA label', 'ctaLabel', { maxLength: 80 })}
            <label className="block text-xs font-semibold text-slate-600 mb-3">
              Deep link route
              <select
                className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                value={form.routeKey}
                onChange={(e) => setForm((p) => ({ ...p, routeKey: e.target.value }))}
              >
                {ROUTE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {field('Gradient start', 'gradientStart', { type: 'color' })}
              {field('Mid', 'gradientMid', { type: 'color' })}
              {field('End', 'gradientEnd', { type: 'color' })}
            </div>
            {field('Sort order', 'sortOrder', { type: 'number' })}
            <label className="flex items-center gap-2 text-sm text-slate-700 mb-3">
              <input
                type="checkbox"
                checked={!!form.isActive}
                onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))}
              />
              Active
            </label>
            <label className="block text-xs font-semibold text-slate-600 mb-3">
              Banner image (optional — overrides icon)
              <input
                type="file"
                accept="image/*"
                className="mt-1 block w-full text-sm"
                onChange={(e) => setImageFile(e.target.files?.[0] || null)}
              />
            </label>
            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 rounded-lg bg-sky-600 text-white text-sm font-semibold disabled:opacity-60"
              >
                {saving ? 'Saving…' : editId ? 'Update' : 'Create'}
              </button>
              {editId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-sm"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </DeskCard>

        <DeskCard title="Current slides">
          {loading ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : banners.length === 0 ? (
            <p className="text-sm text-slate-500">No banners yet. Create one on the left.</p>
          ) : (
            <ul className="space-y-3">
              {banners.map((b) => (
                <li
                  key={b.id}
                  className="flex gap-3 p-3 rounded-xl border border-slate-200 bg-white"
                >
                  <div
                    className="w-16 h-16 rounded-lg shrink-0 bg-cover bg-center"
                    style={{
                      backgroundImage: b.imageUrl
                        ? `url(${b.imageUrl})`
                        : `linear-gradient(90deg, ${b.gradientStart}, ${b.gradientEnd})`,
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-slate-800 truncate">{b.title}</p>
                      {!b.isActive && (
                        <span className="text-[10px] uppercase font-bold text-amber-600">Off</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 truncate">{b.subtitle}</p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      → {b.routeKey} · order {b.sortOrder}
                    </p>
                    <div className="flex gap-2 mt-2">
                      <button
                        type="button"
                        onClick={() => startEdit(b)}
                        className="text-xs font-semibold text-sky-700"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(b.id)}
                        className="text-xs font-semibold text-red-600"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </DeskCard>
      </div>
    </DeskPage>
  )
}

export default HomeBanners
