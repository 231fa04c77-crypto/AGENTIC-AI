import React, { useCallback, useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import { toast } from 'react-toastify'

export const doctorId = (d) => d?._id ?? d?.id

export const doctorSpec = (d) =>
  String(d?.speciality || d?.specialization || d?.department || 'General Medicine').trim()

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '')

export const matchesSpecialization = (doctor, specFilter) => {
  if (!specFilter || specFilter === 'ALL') return false
  const ds = norm(doctorSpec(doctor))
  const sf = norm(specFilter)
  if (!ds || !sf) return false
  return ds.includes(sf) || sf.includes(ds) || ds.startsWith(sf.slice(0, 6)) || sf.startsWith(ds.slice(0, 6))
}

const availLabel = (d) => {
  if (d.available === false || d.status === 'inactive' || d.status === 'offline') {
    return { text: 'Limited availability', tone: 'text-amber-600' }
  }
  if (d.status === 'emergency') {
    return { text: 'Emergency only', tone: 'text-rose-600' }
  }
  return { text: 'Available for referral', tone: 'text-emerald-600' }
}

const DoctorCard = ({ doctor, onSelect, selected, recommended }) => (
  <div
    className={`p-3 rounded-xl border flex items-start justify-between gap-2 ${
      selected ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 bg-white'
    }`}
  >
    <div className="min-w-0">
      {recommended && <span className="text-[10px] font-black text-amber-600">⭐ Recommended</span>}
      <p className="text-sm font-bold text-slate-900 truncate">{doctor.name}</p>
      <p className="text-xs text-slate-600">{doctorSpec(doctor)}</p>
      <p className={`text-[10px] font-semibold mt-0.5 ${availLabel(doctor).tone}`}>{availLabel(doctor).text}</p>
    </div>
    <button
      type="button"
      onClick={() => onSelect(doctor)}
      className={`shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-bold ${
        selected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-800 hover:bg-slate-200'
      }`}
    >
      {selected ? 'Selected' : 'Select'}
    </button>
  </div>
)

/**
 * Loads real doctors from GET /api/doctor/list and provides search + recommended/all lists.
 */
const ReferralDoctorPicker = ({
  backendUrl,
  authHeaders,
  excludeDoctorId,
  hospitalId,
  specialization,
  onSpecializationChange,
  selectedDoctorId,
  onSelectDoctor,
}) => {
  const [allDoctors, setAllDoctors] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState(null)
  const [search, setSearch] = useState('')

  const loadDoctors = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const { data } = await axios.get(`${backendUrl}/api/doctor/list`, {
        headers: authHeaders,
        params: { limit: 500 },
      })
      if (data?.success === false) {
        throw new Error(data.message || 'Doctor list unavailable')
      }
      const list = Array.isArray(data?.doctors) ? data.doctors : []
      setAllDoctors(list.filter((d) => d && doctorId(d)))
    } catch (e) {
      const msg = e.response?.data?.message || e.message || 'Failed to load doctors'
      setLoadError(msg)
      toast.error(msg)
      setAllDoctors([])
    } finally {
      setLoading(false)
    }
  }, [backendUrl, authHeaders])

  useEffect(() => {
    loadDoctors()
  }, [loadDoctors])

  const eligible = useMemo(() => {
    const ex = excludeDoctorId != null ? Number(excludeDoctorId) : null
    const hid = hospitalId != null ? Number(hospitalId) : null
    const filtered = allDoctors.filter((d) => {
      const id = Number(doctorId(d))
      if (ex != null && id === ex) return false
      if (d.status === 'inactive') return false
      return true
    })
    if (hid == null) return filtered
    return [...filtered].sort((a, b) => {
      const aSame = Number(a.hospitalId ?? a.hospital_id) === hid ? 0 : 1
      const bSame = Number(b.hospitalId ?? b.hospital_id) === hid ? 0 : 1
      return aSame - bSame || String(a.name || '').localeCompare(String(b.name || ''))
    })
  }, [allDoctors, excludeDoctorId, hospitalId])

  const specializationOptions = useMemo(() => {
    const fromDb = [...new Set(eligible.map(doctorSpec).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b)
    )
    return fromDb
  }, [eligible])

  const searchFiltered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return eligible
    return eligible.filter((d) => {
      const name = String(d.name || '').toLowerCase()
      const spec = doctorSpec(d).toLowerCase()
      return name.includes(q) || spec.includes(q) || q.includes(spec.slice(0, 4))
    })
  }, [eligible, search])

  const recommended = useMemo(() => {
    if (!specialization || specialization === 'ALL') return []
    return searchFiltered.filter((d) => matchesSpecialization(d, specialization))
  }, [searchFiltered, specialization])

  const allList = useMemo(() => {
    if (!specialization || specialization === 'ALL') return searchFiltered
    const recIds = new Set(recommended.map((d) => doctorId(d)))
    return searchFiltered.filter((d) => !recIds.has(doctorId(d)))
  }, [searchFiltered, specialization, recommended])

  const selectedDoctor = eligible.find((d) => String(doctorId(d)) === String(selectedDoctorId))

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-[11px] font-bold text-slate-500">Specialization</label>
        <select
          className="w-full mt-1 border rounded-xl p-2 text-sm"
          value={specialization || 'ALL'}
          onChange={(e) => onSpecializationChange(e.target.value)}
        >
          <option value="ALL">All Specializations</option>
          {specializationOptions.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-[11px] font-bold text-slate-500">Search doctors</label>
        <input
          type="search"
          className="w-full mt-1 border rounded-xl p-2 text-sm"
          placeholder="Search by name or specialization…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading && <p className="text-xs text-slate-400 py-2">Loading doctors…</p>}
      {loadError && !loading && (
        <div className="text-xs text-rose-700 bg-rose-50 border border-rose-100 rounded-lg p-2">
          {loadError}
          <button type="button" className="ml-2 underline font-bold" onClick={loadDoctors}>
            Retry
          </button>
        </div>
      )}

      {!loading && eligible.length === 0 && !loadError && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg p-2">
          No doctors found in the system. Add doctors in admin/dean portal first.
        </p>
      )}

      {!loading && recommended.length > 0 && (
        <div>
          <p className="text-[10px] font-black uppercase tracking-wide text-amber-700 mb-2">
            ⭐ Recommended specialists
          </p>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {recommended.map((d) => (
              <DoctorCard
                key={doctorId(d)}
                doctor={d}
                recommended
                selected={String(doctorId(d)) === String(selectedDoctorId)}
                onSelect={(doc) => onSelectDoctor(doctorId(doc), doc)}
              />
            ))}
          </div>
        </div>
      )}

      {!loading && searchFiltered.length > 0 && (
        <div>
          <p className="text-[10px] font-black uppercase tracking-wide text-slate-500 mb-2">
            {specialization && specialization !== 'ALL' && recommended.length > 0
              ? 'All other doctors'
              : 'All doctors'}
          </p>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {(specialization && specialization !== 'ALL' ? allList : searchFiltered).map((d) => (
              <DoctorCard
                key={doctorId(d)}
                doctor={d}
                selected={String(doctorId(d)) === String(selectedDoctorId)}
                onSelect={(doc) => onSelectDoctor(doctorId(doc), doc)}
              />
            ))}
          </div>
        </div>
      )}

      {!loading &&
        specialization &&
        specialization !== 'ALL' &&
        recommended.length === 0 &&
        searchFiltered.length > 0 && (
          <p className="text-[11px] text-slate-500">
            No doctors matched &quot;{specialization}&quot; — showing all available doctors above.
          </p>
        )}

      {selectedDoctor && (
        <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-200">
          <p className="text-[10px] font-black uppercase text-indigo-600">Selected specialist</p>
          <p className="text-sm font-bold text-slate-900">{selectedDoctor.name}</p>
          <p className="text-xs text-slate-600">{doctorSpec(selectedDoctor)}</p>
        </div>
      )}
    </div>
  )
}

export default ReferralDoctorPicker
