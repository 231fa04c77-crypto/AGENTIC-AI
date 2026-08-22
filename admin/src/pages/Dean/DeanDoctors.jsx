import React, { useContext, useEffect, useMemo, useState } from 'react'
import { DeanContext } from '../../context/DeanContext'
import { toast } from 'react-toastify'
import { useNavigate } from 'react-router-dom'
import {
    AdminPageLayout,
    PageHero,
    KpiCard,
    McCard,
    FilterToolbar,
    McSearch,
    McSelect,
    McButton,
    ExportMenu,
} from '../../components/mc'

const DOCTOR_STATUSES = [
    { id: 'available', label: 'Available', dot: 'bg-emerald-500', ring: 'ring-emerald-500/30' },
    { id: 'busy', label: 'Busy', dot: 'bg-amber-500', ring: 'ring-amber-500/30' },
    { id: 'emergency', label: 'Emergency', dot: 'bg-red-500', ring: 'ring-red-500/30' },
    { id: 'unavailable', label: 'On Leave', dot: 'bg-slate-400', ring: 'ring-slate-400/30' },
]

const DEPT_MAP = {
    'Cardiologist': 'Cardiology',
    'Cardiology': 'Cardiology',
    'Neurologist': 'Neurology',
    'Consultant Neurologist': 'Neurology',
    'Dermatologist': 'Dermatology',
    'Gastroenterologist': 'Gastroenterology',
    'General physician': 'General Medicine',
    'General Physician': 'General Medicine',
    'Gynecologist': 'Obstetrics & Gynaecology',
    'Pediatricians': 'Paediatrics',
    'Pediatrician': 'Paediatrics',
    'Orthopedics': 'Orthopedics',
    'Orthopedic Surgeon': 'Orthopedics',
    'Psychiatrist': 'Psychiatry',
    'Ophthalmologist': 'Ophthalmology',
    'ENT': 'ENT',
    'ENT Specialist': 'ENT',
    'Dentist': 'Dentistry',
}

const DONUT_COLORS = ['#0ea5e9', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#14b8a6', '#6366f1', '#94a3b8']

const departmentOf = (doc) => DEPT_MAP[doc?.speciality] || doc?.speciality || '—'

const normalizeStatus = (doc) => {
    const raw = (doc?.status || '').toLowerCase().trim()
    if (raw === 'inactive') return 'inactive'
    if (DOCTOR_STATUSES.some(s => s.id === raw)) return raw
    return doc?.available === false ? 'unavailable' : 'available'
}

const statusMeta = (doc) => {
    const key = normalizeStatus(doc)
    if (key === 'inactive') {
        return { label: 'Inactive', dot: 'bg-slate-400', text: 'text-slate-500', bg: 'bg-slate-100' }
    }
    const found = DOCTOR_STATUSES.find(s => s.id === key) || DOCTOR_STATUSES[0]
    const textMap = {
        available: 'text-emerald-700',
        busy: 'text-amber-700',
        emergency: 'text-red-700',
        unavailable: 'text-slate-600',
    }
    const bgMap = {
        available: 'bg-emerald-50',
        busy: 'bg-amber-50',
        emergency: 'bg-red-50',
        unavailable: 'bg-slate-100',
    }
    return {
        label: found.label,
        dot: found.dot,
        text: textMap[key] || 'text-emerald-700',
        bg: bgMap[key] || 'bg-emerald-50',
    }
}

const avatarFor = (doc) =>
    doc?.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(doc?.name || 'Doctor')}&background=0ea5e9&color=fff&size=128`

const DeanDoctors = () => {
    const {
        deanToken, doctors, getDoctors, updateDoctor,
        deleteDoctor, toggleStatus, resetPassword,
        hospital, getHospital,
    } = useContext(DeanContext)

    const [search, setSearch] = useState('')
    const [specFilter, setSpecFilter] = useState('all')
    const [deptFilter, setDeptFilter] = useState('all')
    const [availFilter, setAvailFilter] = useState('all')

    const [selectedDoc, setSelectedDoc] = useState(null)
    const [detailsOpen, setDetailsOpen] = useState(false)
    const [resetMode, setResetMode] = useState(false)
    const [newPass, setNewPass] = useState('')
    const navigate = useNavigate()

    useEffect(() => {
        if (deanToken) {
            getDoctors()
            getHospital()
        }
    }, [deanToken])

    // Keep the selected doctor in sync after updates refresh the list
    useEffect(() => {
        if (selectedDoc) {
            const fresh = doctors.find(d => d._id === selectedDoc._id)
            if (fresh) setSelectedDoc(fresh)
        }
    }, [doctors])

    const specialties = useMemo(
        () => [...new Set(doctors.map(d => d.speciality).filter(Boolean))].sort(),
        [doctors]
    )
    const departments = useMemo(
        () => [...new Set(doctors.map(departmentOf).filter(d => d && d !== '—'))].sort(),
        [doctors]
    )

    const filtered = useMemo(() => doctors.filter(d => {
        const q = search.toLowerCase()
        const matchSearch = !q ||
            d.name?.toLowerCase().includes(q) ||
            d.speciality?.toLowerCase().includes(q) ||
            d.email?.toLowerCase().includes(q) ||
            departmentOf(d).toLowerCase().includes(q)
        const matchSpec = specFilter === 'all' || d.speciality === specFilter
        const matchDept = deptFilter === 'all' || departmentOf(d) === deptFilter
        const matchAvail = availFilter === 'all' || normalizeStatus(d) === availFilter
        return matchSearch && matchSpec && matchDept && matchAvail
    }), [doctors, search, specFilter, deptFilter, availFilter])

    const totalDocs = doctors.length
    const activeDocs = doctors.filter(d => normalizeStatus(d) === 'available').length
    const onLeaveDocs = doctors.filter(d => ['unavailable', 'inactive'].includes(normalizeStatus(d))).length
    const deptCount = departments.length

    // Specialty distribution for the donut
    const distribution = useMemo(() => {
        const counts = {}
        doctors.forEach(d => {
            const dept = departmentOf(d)
            counts[dept] = (counts[dept] || 0) + 1
        })
        const entries = Object.entries(counts).sort((a, b) => b[1] - a[1])
        const top = entries.slice(0, 7)
        const rest = entries.slice(7)
        if (rest.length) {
            top.push(['Others', rest.reduce((s, [, c]) => s + c, 0)])
        }
        return top.map(([label, count], i) => ({
            label,
            count,
            pct: totalDocs ? Math.round((count / totalDocs) * 100) : 0,
            color: DONUT_COLORS[i % DONUT_COLORS.length],
        }))
    }, [doctors, totalDocs])

    const donutGradient = useMemo(() => {
        if (!totalDocs) return '#e2e8f0'
        let acc = 0
        const stops = distribution.map(s => {
            const start = (acc / totalDocs) * 100
            acc += s.count
            const end = (acc / totalDocs) * 100
            return `${s.color} ${start}% ${end}%`
        })
        return `conic-gradient(${stops.join(', ')})`
    }, [distribution, totalDocs])

    const topConsultants = useMemo(
        () => [...doctors]
            .sort((a, b) => (b.rating || 0) - (a.rating || 0) || (b.reviews || 0) - (a.reviews || 0))
            .slice(0, 3),
        [doctors]
    )

    const hospitalName = hospital?.name || 'Your Hospital'
    const hospitalAddress = useMemo(() => {
        if (!hospital) return ''
        if (typeof hospital.address === 'string') return hospital.address
        if (hospital.address?.line1) return [hospital.address.line1, hospital.address.line2].filter(Boolean).join(', ')
        return [hospital.city, hospital.state].filter(Boolean).join(', ')
    }, [hospital])

    const mapsLink = hospital?.latitude && hospital?.longitude
        ? `https://www.google.com/maps/search/?api=1&query=${hospital.latitude},${hospital.longitude}`
        : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${hospitalName} ${hospitalAddress}`)}`

    const openDoctor = (doc) => {
        setSelectedDoc(doc)
        setDetailsOpen(true)
        setResetMode(false)
        setNewPass('')
    }

    const closeDetails = () => {
        setDetailsOpen(false)
        setSelectedDoc(null)
        setResetMode(false)
        setNewPass('')
    }

    const handleDelete = async (id, name) => {
        if (window.confirm(`Are you sure you want to remove Dr. ${name}?`)) {
            const ok = await deleteDoctor(id)
            if (ok) closeDetails()
        }
    }

    const handleResetPassword = async () => {
        if (!selectedDoc) return
        const res = await resetPassword(selectedDoc._id, newPass || null)
        if (res) {
            setResetMode(false)
            setNewPass('')
        }
    }

    const copyEmail = async (email) => {
        if (!email) return
        try {
            await navigator.clipboard.writeText(email)
            toast.success('Email copied')
        } catch {
            toast.error('Could not copy email')
        }
    }

    const resetFilters = () => {
        setSearch('')
        setSpecFilter('all')
        setDeptFilter('all')
        setAvailFilter('all')
    }

    const doctorExportColumns = [
        { key: 'name', label: 'Doctor' },
        { key: 'speciality', label: 'Specialty' },
        { key: (d) => departmentOf(d), label: 'Department' },
        { key: 'degree', label: 'Degree' },
        { key: 'experience', label: 'Experience' },
        { key: 'fees', label: 'Consultation Fee', format: (v) => (v ? `₹${v}` : '') },
        { key: 'videoConsultationFee', label: 'Video Fee', format: (v) => (v ? `₹${v}` : '') },
        { key: 'email', label: 'Email' },
        { key: 'phone', label: 'Phone' },
        { key: (d) => statusMeta(d).label, label: 'Availability' },
        { key: 'rating', label: 'Rating' },
        { key: 'reviews', label: 'Reviews' },
        { key: 'publicId', label: 'Doctor ID' },
    ]

    return (
        <AdminPageLayout>
            <PageHero
                title={`Welcome to ${hospitalName}`}
                subtitle={
                    <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
                        {hospitalAddress && (
                            <span className="inline-flex items-center gap-1">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                {hospitalAddress}
                            </span>
                        )}
                        <a href={mapsLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold underline underline-offset-2 hover:opacity-80">
                            View on Maps →
                        </a>
                    </span>
                }
                features={['Live Doctor Roster', 'Availability Control', 'Credential Management']}
            />

            <div className="mc-kpi-grid mc-kpi-grid--4">
                <KpiCard label="Total Doctors" value={totalDocs} iconBg="bg-sky-100 text-sky-600"
                    icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
                />
                <KpiCard label="Active Today" value={activeDocs} iconBg="bg-emerald-100 text-emerald-600"
                    icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                />
                <KpiCard label="On Leave" value={onLeaveDocs} iconBg="bg-amber-100 text-amber-600"
                    icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                />
                <KpiCard label="Departments Covered" value={deptCount} iconBg="bg-violet-100 text-violet-600"
                    icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>}
                />
            </div>

            <FilterToolbar
                actions={
                    <div className="flex items-center gap-2">
                        <ExportMenu
                            columns={doctorExportColumns}
                            rows={() => filtered}
                            filename='hospital_doctors'
                            title='Hospital Doctors'
                            subtitle={`${filtered.length} record(s)`}
                        />
                        <McButton variant="primary" onClick={() => navigate('/dean-add-doctor')}>
                            + Add Doctor
                        </McButton>
                    </div>
                }
            >
                <McSearch
                    placeholder="Search by name, speciality or department..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
                <McSelect value={specFilter} onChange={(e) => setSpecFilter(e.target.value)}>
                    <option value="all">All Specialties</option>
                    {specialties.map(s => <option key={s} value={s}>{s}</option>)}
                </McSelect>
                <McSelect value={availFilter} onChange={(e) => setAvailFilter(e.target.value)}>
                    <option value="all">All Availability</option>
                    <option value="available">Available</option>
                    <option value="busy">Busy</option>
                    <option value="emergency">Emergency</option>
                    <option value="unavailable">On Leave</option>
                    <option value="inactive">Inactive</option>
                </McSelect>
                <McSelect value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}>
                    <option value="all">All Departments</option>
                    {departments.map(d => <option key={d} value={d}>{d}</option>)}
                </McSelect>
                <McButton variant="outline" onClick={resetFilters}>↺ Reset</McButton>
            </FilterToolbar>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
                {/* Doctor Directory */}
                <div className="xl:col-span-2">
                    <McCard title="Doctor Directory" noPadding>
                        {filtered.length === 0 ? (
                            <div className="p-12 text-center">
                                <p className="text-5xl mb-4 opacity-20">👨‍⚕️</p>
                                <p className="text-gray-500 font-medium">No doctors match your filters.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="mc-data-table">
                                    <thead>
                                        <tr>
                                            <th>Doctor</th>
                                            <th>Specialty</th>
                                            <th>Department</th>
                                            <th>Experience</th>
                                            <th>Availability</th>
                                            <th className="text-right">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filtered.map((doc, i) => {
                                            const meta = statusMeta(doc)
                                            const inactive = normalizeStatus(doc) === 'inactive'
                                            return (
                                                <tr
                                                    key={doc._id || i}
                                                    className="cursor-pointer"
                                                    onClick={() => openDoctor(doc)}
                                                >
                                                    <td>
                                                        <div className="flex items-center gap-3 min-w-[180px]">
                                                            <img
                                                                src={avatarFor(doc)}
                                                                alt={doc.name}
                                                                className={`w-10 h-10 rounded-full object-cover ring-2 ring-white shadow-sm ${inactive ? 'grayscale opacity-60' : ''}`}
                                                            />
                                                            <div className="min-w-0">
                                                                <p className={`font-semibold text-slate-900 truncate ${inactive ? 'line-through text-slate-400' : ''}`}>{doc.name}</p>
                                                                <p className="text-[11px] text-slate-400 truncate">{doc.degree || '—'}</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="text-slate-600">{doc.speciality || '—'}</td>
                                                    <td className="text-slate-600">{departmentOf(doc)}</td>
                                                    <td className="text-slate-600">{doc.experience || '—'}</td>
                                                    <td>
                                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${meta.bg} ${meta.text}`}>
                                                            <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                                                            {meta.label}
                                                        </span>
                                                    </td>
                                                    <td onClick={(e) => e.stopPropagation()}>
                                                        <div className="flex items-center justify-end gap-1">
                                                            {doc.phone && (
                                                                <a
                                                                    href={`tel:${doc.phone}`}
                                                                    className="p-2 text-sky-600 hover:bg-sky-50 rounded-lg transition-colors"
                                                                    title={`Call ${doc.phone}`}
                                                                >
                                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                                                                </a>
                                                            )}
                                                            <button
                                                                onClick={() => openDoctor(doc)}
                                                                className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
                                                                title="View details"
                                                            >
                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01" /></svg>
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                        <div className="px-4 py-3 text-xs text-slate-400 border-t border-slate-100">
                            Showing {filtered.length} of {totalDocs} doctors
                        </div>
                    </McCard>
                </div>

                {/* Right sidebar */}
                <div className="space-y-5">
                    <McCard title="Specialty Distribution">
                        {totalDocs === 0 ? (
                            <p className="text-sm text-slate-400 py-6 text-center">No data yet.</p>
                        ) : (
                            <div className="flex flex-col sm:flex-row xl:flex-col items-center gap-5">
                                <div className="relative shrink-0" style={{ width: 130, height: 130 }}>
                                    <div className="w-full h-full rounded-full" style={{ background: donutGradient }} />
                                    <div className="absolute inset-[18px] bg-white rounded-full flex flex-col items-center justify-center shadow-inner">
                                        <span className="text-2xl font-bold text-slate-900 leading-none">{totalDocs}</span>
                                        <span className="text-[10px] uppercase tracking-wide text-slate-400">Total</span>
                                    </div>
                                </div>
                                <ul className="flex-1 w-full space-y-1.5">
                                    {distribution.map(s => (
                                        <li key={s.label} className="flex items-center justify-between text-xs">
                                            <span className="flex items-center gap-2 min-w-0">
                                                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.color }} />
                                                <span className="text-slate-600 truncate">{s.label}</span>
                                            </span>
                                            <span className="text-slate-400 font-medium whitespace-nowrap">{s.count} ({s.pct}%)</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </McCard>

                    <McCard title="Top Consultants">
                        {topConsultants.length === 0 ? (
                            <p className="text-sm text-slate-400 py-4 text-center">No consultants yet.</p>
                        ) : (
                            <ul className="space-y-3">
                                {topConsultants.map((doc, i) => (
                                    <li
                                        key={doc._id || i}
                                        onClick={() => openDoctor(doc)}
                                        className="flex items-center gap-3 cursor-pointer rounded-xl p-2 -m-2 hover:bg-slate-50 transition-colors"
                                    >
                                        <img src={avatarFor(doc)} alt={doc.name} className="w-10 h-10 rounded-full object-cover ring-2 ring-white shadow-sm" />
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-semibold text-slate-900 truncate">{doc.name}</p>
                                            <p className="text-[11px] text-slate-400 truncate">{doc.speciality}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs font-bold text-amber-500">★ {doc.rating ? doc.rating.toFixed(1) : '—'}</p>
                                            <p className="text-[10px] text-slate-400">{doc.reviews || 0} reviews</p>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </McCard>
                </div>
            </div>

            {/* Doctor Details Modal */}
            {detailsOpen && selectedDoc && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={closeDetails}>
                    <div
                        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-scale-in"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="relative bg-gradient-to-r from-sky-500 to-teal-500 px-6 py-6">
                            <button onClick={closeDetails} className="absolute top-4 right-4 text-white/80 hover:text-white p-1 rounded-full hover:bg-white/20">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                            <div className="flex items-center gap-4">
                                <img src={avatarFor(selectedDoc)} alt={selectedDoc.name} className="w-20 h-20 rounded-2xl object-cover ring-4 ring-white/40 shadow-lg" />
                                <div className="text-white min-w-0">
                                    <h3 className="text-xl font-bold truncate">{selectedDoc.name}</h3>
                                    <p className="text-white/90 text-sm">{selectedDoc.speciality} · {departmentOf(selectedDoc)}</p>
                                    <div className="flex items-center gap-3 mt-1.5 text-xs">
                                        <span className="inline-flex items-center gap-1 bg-white/20 px-2 py-0.5 rounded-full">
                                            <span className={`w-1.5 h-1.5 rounded-full ${statusMeta(selectedDoc).dot}`} />
                                            {statusMeta(selectedDoc).label}
                                        </span>
                                        <span className="inline-flex items-center gap-1">★ {selectedDoc.rating ? selectedDoc.rating.toFixed(1) : '—'} ({selectedDoc.reviews || 0})</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 space-y-5">
                            {/* Info grid */}
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                {[
                                    { label: 'Degree', value: selectedDoc.degree || '—' },
                                    { label: 'Experience', value: selectedDoc.experience || '—' },
                                    { label: 'Consultation Fee', value: selectedDoc.fees ? `₹${selectedDoc.fees}` : '—' },
                                    { label: 'Video Fee', value: selectedDoc.videoConsultationFee ? `₹${selectedDoc.videoConsultationFee}` : '—' },
                                    { label: 'Follow-up Fee', value: selectedDoc.followupVideoFee ? `₹${selectedDoc.followupVideoFee}` : '—' },
                                    { label: 'Phone', value: selectedDoc.phone || '—' },
                                ].map(item => (
                                    <div key={item.label} className="rounded-xl bg-slate-50 px-3 py-2 border border-slate-100">
                                        <p className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">{item.label}</p>
                                        <p className="font-semibold text-slate-800 text-sm truncate mt-0.5">{item.value}</p>
                                    </div>
                                ))}
                            </div>

                            {/* Email */}
                            <div className="rounded-xl bg-slate-50 px-3 py-2.5 border border-slate-100">
                                <p className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold mb-1">Email</p>
                                <div className="flex items-center justify-between gap-2">
                                    <p className="text-sm font-medium text-slate-800 truncate" title={selectedDoc.email}>{selectedDoc.email || '—'}</p>
                                    {selectedDoc.email && (
                                        <button onClick={() => copyEmail(selectedDoc.email)} className="flex-shrink-0 text-[10px] font-bold text-sky-600 hover:text-sky-800 px-2 py-1 rounded-md bg-sky-50">Copy</button>
                                    )}
                                </div>
                            </div>

                            {/* Address */}
                            {(selectedDoc.address?.line1 || selectedDoc.address?.line2) && (
                                <div className="rounded-xl bg-slate-50 px-3 py-2.5 border border-slate-100">
                                    <p className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold mb-1">Address</p>
                                    <p className="text-sm text-slate-700">{[selectedDoc.address?.line1, selectedDoc.address?.line2].filter(Boolean).join(', ')}</p>
                                </div>
                            )}

                            {/* About */}
                            {selectedDoc.about && (
                                <div>
                                    <p className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold mb-1">About</p>
                                    <p className="text-sm text-slate-600 leading-relaxed">{selectedDoc.about}</p>
                                </div>
                            )}

                            {selectedDoc.publicId && (
                                <p className="text-[10px] text-slate-400 font-mono">ID: {selectedDoc.publicId}</p>
                            )}

                            {/* Availability control */}
                            {normalizeStatus(selectedDoc) !== 'inactive' && (
                                <div>
                                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-2">Patient Visibility</p>
                                    <div className="grid grid-cols-4 gap-2">
                                        {DOCTOR_STATUSES.map(st => {
                                            const active = normalizeStatus(selectedDoc) === st.id
                                            return (
                                                <button
                                                    key={st.id}
                                                    type="button"
                                                    onClick={() => updateDoctor(selectedDoc._id, { status: st.id })}
                                                    className={`flex flex-col items-center gap-1 py-2 px-1 rounded-xl border text-[10px] font-bold transition-all ${active
                                                        ? `bg-white border-sky-200 shadow-sm ring-2 ${st.ring}`
                                                        : 'border-transparent bg-slate-50 text-slate-500 hover:bg-white hover:border-slate-200'
                                                        }`}
                                                    title={st.label}
                                                >
                                                    <span className={`w-2.5 h-2.5 rounded-full ${st.dot}`} />
                                                    <span className="leading-tight text-center">{st.label}</span>
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Credential reset */}
                            {resetMode ? (
                                <div className="rounded-xl border border-sky-100 bg-sky-50/60 p-4 space-y-2">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Credential Reset</label>
                                    <input
                                        value={newPass}
                                        onChange={e => setNewPass(e.target.value)}
                                        placeholder="New password (leave blank to auto-generate)"
                                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-sky-500 outline-none"
                                    />
                                    <p className="text-[10px] text-slate-400">An email with the new credentials will be sent to Dr. {selectedDoc.name}.</p>
                                    <div className="flex gap-2 pt-1">
                                        <button onClick={handleResetPassword} className="flex-1 py-2.5 bg-sky-600 text-white rounded-xl font-bold text-sm hover:bg-sky-700 transition-colors">Reset & Send</button>
                                        <button onClick={() => { setResetMode(false); setNewPass('') }} className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl font-bold text-sm text-slate-600 hover:bg-slate-50 transition-colors">Cancel</button>
                                    </div>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-slate-100">
                                    <button onClick={() => setResetMode(true)} className="py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 hover:border-sky-300 hover:text-sky-700 transition-colors">Reset Password</button>
                                    <button onClick={() => toggleStatus(selectedDoc._id)} className={`py-2.5 rounded-xl text-sm font-bold border transition-colors ${normalizeStatus(selectedDoc) === 'inactive' ? 'bg-emerald-600 text-white border-emerald-700 hover:bg-emerald-700' : 'bg-white text-amber-600 border-amber-100 hover:bg-amber-50'}`}>
                                        {normalizeStatus(selectedDoc) === 'inactive' ? 'Activate' : 'Deactivate'}
                                    </button>
                                    <button onClick={() => handleDelete(selectedDoc._id, selectedDoc.name)} className="py-2.5 bg-white text-red-600 border border-red-100 rounded-xl text-sm font-bold hover:bg-red-50 transition-colors">Remove Doctor</button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <style>{`
        @keyframes scaleIn {
            0% { opacity: 0; transform: scale(0.95) translateY(10px); }
            100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        .animate-scale-in { animation: scaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
      `}</style>
        </AdminPageLayout>
    )
}

export default DeanDoctors
