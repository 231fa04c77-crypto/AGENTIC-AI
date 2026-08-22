import React, { useContext, useEffect, useState, useRef } from 'react'
import { DoctorContext } from '../../context/DoctorContext'
import { AppContext } from '../../context/AppContext'
import { toast } from 'react-toastify'
import axios from 'axios'
import { AdminPageLayout } from '../../components/mc'

const WEEK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const STATUS_META = {
    'available': { label: 'Available', dot: 'bg-emerald-500', pill: 'bg-emerald-100 text-emerald-700' },
    'in-clinic': { label: 'In-clinic', dot: 'bg-sky-500', pill: 'bg-sky-100 text-sky-700' },
    'emergency': { label: 'Emergency', dot: 'bg-rose-500', pill: 'bg-rose-100 text-rose-700' },
    'offline': { label: 'Offline', dot: 'bg-slate-400', pill: 'bg-slate-100 text-slate-600' },
    'busy': { label: 'Busy', dot: 'bg-amber-500', pill: 'bg-amber-100 text-amber-700' },
    'unavailable': { label: 'Unavailable', dot: 'bg-slate-400', pill: 'bg-slate-100 text-slate-600' },
}

const STATUS_OPTIONS = [
    { value: 'available', label: 'Available', dot: 'bg-emerald-500', active: 'bg-emerald-50 border-emerald-300 text-emerald-700 ring-emerald-400' },
    { value: 'in-clinic', label: 'In-clinic', dot: 'bg-sky-500', active: 'bg-sky-50 border-sky-300 text-sky-700 ring-sky-400' },
    { value: 'emergency', label: 'Emergency', dot: 'bg-rose-500', active: 'bg-rose-50 border-rose-300 text-rose-700 ring-rose-400' },
    { value: 'offline', label: 'Offline', dot: 'bg-slate-400', active: 'bg-slate-100 border-slate-300 text-slate-700 ring-slate-400' },
]

const SectionIcon = ({ children, className = '' }) => (
    <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg ${className}`}>{children}</span>
)

const DoctorProfile = () => {
    const { dToken, profileData, setProfileData, getProfileData } = useContext(DoctorContext)
    const { currency, backendUrl } = useContext(AppContext)
    const [isEdit, setIsEdit] = useState(false)
    const [imagePreview, setImagePreview] = useState(null)
    const [saving, setSaving] = useState(false)
    const fileInputRef = useRef(null)

    const [availEdit, setAvailEdit] = useState(false)
    const [sched, setSched] = useState({ status: 'available', opStart: '09:00', opEnd: '17:00', days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] })
    const [savingAvail, setSavingAvail] = useState(false)

    useEffect(() => {
        if (dToken) getProfileData()
    }, [dToken])

    useEffect(() => {
        if (!profileData) return
        setSched({
            status: profileData.status || (profileData.available === false ? 'offline' : 'available'),
            opStart: profileData.opStart || '09:00',
            opEnd: profileData.opEnd || '17:00',
            days: Array.isArray(profileData.availableDays) && profileData.availableDays.length
                ? profileData.availableDays
                : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
        })
    }, [profileData])

    const handleImageChange = (e) => {
        const file = e.target.files[0]
        if (!file) return
        if (!file.type.startsWith('image/')) {
            toast.error('Please select a valid image file')
            return
        }
        if (file.size > 5 * 1024 * 1024) {
            toast.error('Image size should be less than 5MB')
            return
        }
        const reader = new FileReader()
        reader.onloadend = () => setImagePreview(reader.result)
        reader.readAsDataURL(file)
    }

    const updateProfile = async () => {
        try {
            setSaving(true)
            const formData = new FormData()
            formData.append('address', JSON.stringify(profileData.address || { line1: '', line2: '' }))
            formData.append('fees', String(profileData.fees || 0))
            formData.append('about', profileData.about || '')
            if (fileInputRef.current?.files[0]) {
                formData.append('image', fileInputRef.current.files[0])
            }
            const { data } = await axios.post(backendUrl + '/api/doctor/update-profile', formData, { headers: { dToken } })
            if (data.success) {
                toast.success('Profile updated')
                setIsEdit(false)
                setImagePreview(null)
                if (fileInputRef.current) fileInputRef.current.value = ''
                setTimeout(() => getProfileData(), 400)
            } else {
                toast.error(data.message)
            }
        } catch (error) {
            toast.error(error.response?.data?.message || error.message || 'Failed to update profile')
        } finally {
            setSaving(false)
        }
    }

    const cancelEdit = () => {
        setIsEdit(false)
        setImagePreview(null)
        if (fileInputRef.current) fileInputRef.current.value = ''
        getProfileData()
    }

    const toggleDay = (day) => {
        setSched((prev) => ({
            ...prev,
            days: prev.days.includes(day) ? prev.days.filter((d) => d !== day) : [...prev.days, day],
        }))
    }

    const saveAvailability = async () => {
        if (!sched.opStart || !sched.opEnd) {
            toast.error('Please set both OP start and end times')
            return
        }
        if (sched.days.length === 0) {
            toast.error('Select at least one available day')
            return
        }
        try {
            setSavingAvail(true)
            const formData = new FormData()
            formData.append('status', sched.status)
            formData.append('opStart', sched.opStart)
            formData.append('opEnd', sched.opEnd)
            formData.append('availableDays', JSON.stringify(sched.days))
            const { data } = await axios.post(backendUrl + '/api/doctor/update-profile', formData, { headers: { dToken } })
            if (data.success) {
                toast.success('Availability updated')
                setAvailEdit(false)
                setTimeout(() => getProfileData(), 400)
            } else {
                toast.error(data.message)
            }
        } catch (error) {
            toast.error(error.response?.data?.message || error.message || 'Failed to update availability')
        } finally {
            setSavingAvail(false)
        }
    }

    if (!profileData) {
        return (
            <AdminPageLayout maxWidth="max-w-6xl mx-auto">
                <div className="flex items-center justify-center min-h-[50vh]">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
                </div>
            </AdminPageLayout>
        )
    }

    const statusKey = profileData.status || (profileData.available === false ? 'offline' : 'available')
    const statusMeta = STATUS_META[statusKey] || STATUS_META['available']

    const locationStr = [profileData.address?.line1, profileData.address?.line2].filter(Boolean).join(', ')

    const checks = [
        { label: 'Basic Details', done: !!(profileData.name && profileData.speciality) },
        { label: 'Professional Details', done: !!(profileData.degree && profileData.experience) },
        { label: 'Fee Details', done: Number(profileData.fees) > 0 },
        { label: 'Address', done: !!profileData.address?.line1 },
        { label: 'Profile Photo', done: !!profileData.image },
    ]
    const completionPct = Math.round((checks.filter((c) => c.done).length / checks.length) * 100)
    const ringR = 42
    const ringC = 2 * Math.PI * ringR
    const ringOffset = ringC * (1 - completionPct / 100)

    const cardCls = 'bg-white rounded-2xl shadow-sm border border-slate-200'

    return (
        <AdminPageLayout maxWidth="max-w-6xl mx-auto">
            <div>
                <h1 className="text-2xl font-bold text-slate-900">Doctor Profile</h1>
                <p className="text-sm text-slate-500 mt-0.5">Manage your personal details, professional information and consultation settings.</p>
            </div>

            <div className="flex flex-col lg:flex-row gap-6">
                {/* ── Main column ── */}
                <div className="flex-1 space-y-5 min-w-0">
                    {/* Hero card */}
                    <div className={`${cardCls} p-6`}>
                        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
                            <div className="relative shrink-0">
                                <img
                                    src={imagePreview || profileData.image}
                                    alt={profileData.name}
                                    className="w-28 h-28 rounded-full object-cover border-4 border-slate-100 shadow-sm"
                                />
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="absolute bottom-1 right-1 w-8 h-8 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center shadow-md ring-2 ring-white"
                                    title="Change photo"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                </button>
                                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                            </div>
                            <div className="text-center sm:text-left min-w-0">
                                <div className="flex items-center justify-center sm:justify-start gap-2">
                                    <h2 className="text-2xl font-bold text-slate-900 truncate">{profileData.name}</h2>
                                    <svg className="w-5 h-5 text-blue-500 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                                </div>
                                <p className="text-sm font-medium text-slate-500 mt-1">{profileData.degree}</p>
                                <p className="text-sm font-semibold text-blue-600">{profileData.speciality}</p>
                                <div className="flex items-center justify-center sm:justify-start gap-3 mt-3 flex-wrap">
                                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600">
                                        <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                        {profileData.experience} Experience
                                    </span>
                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${statusMeta.pill}`}>
                                        <span className={`w-2 h-2 rounded-full ${statusMeta.dot}`} />
                                        {statusMeta.label}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* About Doctor */}
                    <div className={`${cardCls} p-6`}>
                        <div className="flex items-center gap-2.5 mb-3">
                            <SectionIcon className="bg-blue-50 text-blue-600"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg></SectionIcon>
                            <h3 className="text-base font-bold text-slate-900">About Doctor</h3>
                        </div>
                        {isEdit ? (
                            <textarea
                                rows={4}
                                value={profileData.about || ''}
                                onChange={(e) => setProfileData((p) => ({ ...p, about: e.target.value }))}
                                className="w-full px-4 py-3 border border-slate-300 rounded-lg text-sm text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 resize-none"
                                placeholder="Write about your medical background, expertise, and achievements..."
                            />
                        ) : (
                            <div className="px-4 py-3 bg-slate-50 rounded-lg text-sm text-slate-600 leading-relaxed">
                                {profileData.about || 'No information provided yet.'}
                            </div>
                        )}
                    </div>

                    {/* Appointment Fee + Address */}
                    <div className={`${cardCls} divide-y divide-slate-100`}>
                        <div className="p-6 flex items-center justify-between gap-4">
                            <div className="flex items-center gap-2.5">
                                <SectionIcon className="bg-emerald-50 text-emerald-600"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></SectionIcon>
                                <span className="text-sm font-semibold text-slate-700">Appointment Fee</span>
                            </div>
                            {isEdit ? (
                                <input
                                    type="number"
                                    value={profileData.fees}
                                    onChange={(e) => setProfileData((p) => ({ ...p, fees: e.target.value }))}
                                    className="w-32 px-3 py-2 border border-slate-300 rounded-lg text-sm text-right outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                                />
                            ) : (
                                <span className="text-lg font-bold text-slate-900">{currency} {profileData.fees}</span>
                            )}
                        </div>
                        <div className="p-6 flex items-start justify-between gap-4">
                            <div className="flex items-center gap-2.5 shrink-0">
                                <SectionIcon className="bg-violet-50 text-violet-600"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg></SectionIcon>
                                <span className="text-sm font-semibold text-slate-700">Address</span>
                            </div>
                            {isEdit ? (
                                <div className="flex-1 max-w-sm space-y-2">
                                    <input
                                        type="text"
                                        value={profileData.address?.line1 || ''}
                                        onChange={(e) => setProfileData((p) => ({ ...p, address: { ...p.address, line1: e.target.value } }))}
                                        placeholder="Street Address, Locality"
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                                    />
                                    <input
                                        type="text"
                                        value={profileData.address?.line2 || ''}
                                        onChange={(e) => setProfileData((p) => ({ ...p, address: { ...p.address, line2: e.target.value } }))}
                                        placeholder="City, State, Pincode"
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                                    />
                                </div>
                            ) : (
                                <span className="text-sm font-medium text-slate-700 text-right">{locationStr || 'Not provided'}</span>
                            )}
                        </div>
                    </div>

                    {/* Professional Details */}
                    <div className={`${cardCls} p-6`}>
                        <div className="flex items-center gap-2.5 mb-4">
                            <SectionIcon className="bg-blue-50 text-blue-600"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg></SectionIcon>
                            <h3 className="text-base font-bold text-slate-900">Professional Details</h3>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div>
                                <p className="text-xs text-slate-400 font-medium">Qualification</p>
                                <p className="text-sm font-semibold text-slate-800 mt-0.5">{profileData.degree || '—'}</p>
                            </div>
                            <div>
                                <p className="text-xs text-slate-400 font-medium">Specialization</p>
                                <p className="text-sm font-semibold text-slate-800 mt-0.5">{profileData.speciality || '—'}</p>
                            </div>
                            <div>
                                <p className="text-xs text-slate-400 font-medium">Experience</p>
                                <p className="text-sm font-semibold text-slate-800 mt-0.5">{profileData.experience || '—'}</p>
                            </div>
                        </div>
                    </div>

                    {/* Contact Details */}
                    <div className={`${cardCls} p-6`}>
                        <div className="flex items-center gap-2.5 mb-4">
                            <SectionIcon className="bg-cyan-50 text-cyan-600"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg></SectionIcon>
                            <h3 className="text-base font-bold text-slate-900">Contact Details</h3>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="min-w-0">
                                <p className="text-xs text-slate-400 font-medium">Phone Number</p>
                                <p className="text-sm font-semibold text-slate-800 mt-0.5 truncate">{profileData.phone || '—'}</p>
                            </div>
                            <div className="min-w-0">
                                <p className="text-xs text-slate-400 font-medium">Email Address</p>
                                <p className="text-sm font-semibold text-slate-800 mt-0.5 truncate">{profileData.email || '—'}</p>
                            </div>
                            <div className="min-w-0">
                                <p className="text-xs text-slate-400 font-medium">Location</p>
                                <p className="text-sm font-semibold text-slate-800 mt-0.5 truncate">{locationStr || '—'}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── Right sidebar ── */}
                <div className="w-full lg:w-80 shrink-0 space-y-5">
                    {/* Edit / Save card */}
                    <div className={`${cardCls} p-5`}>
                        {isEdit ? (
                            <div className="flex gap-3">
                                <button
                                    onClick={updateProfile}
                                    disabled={saving}
                                    className="flex-1 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-sm disabled:opacity-60"
                                >
                                    {saving ? 'Saving…' : 'Save Changes'}
                                </button>
                                <button
                                    onClick={cancelEdit}
                                    className="px-4 py-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold"
                                >
                                    Cancel
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={() => setIsEdit(true)}
                                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-sm"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                Edit Profile
                            </button>
                        )}
                    </div>

                    {/* Profile Completion */}
                    <div className={`${cardCls} p-5`}>
                        <h3 className="text-base font-bold text-slate-900 mb-4">Profile Completion</h3>
                        <div className="flex items-center gap-5">
                            <div className="relative w-24 h-24 shrink-0">
                                <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
                                    <circle cx="50" cy="50" r={ringR} fill="none" stroke="#e2e8f0" strokeWidth="9" />
                                    <circle
                                        cx="50" cy="50" r={ringR} fill="none" stroke="#2563eb" strokeWidth="9" strokeLinecap="round"
                                        strokeDasharray={ringC} strokeDashoffset={ringOffset}
                                        style={{ transition: 'stroke-dashoffset 0.6s ease' }}
                                    />
                                </svg>
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                    <span className="text-xl font-bold text-slate-900">{completionPct}%</span>
                                    <span className="text-[10px] text-slate-400 font-medium">Complete</span>
                                </div>
                            </div>
                            <ul className="space-y-2 flex-1">
                                {checks.map((c) => (
                                    <li key={c.label} className="flex items-center gap-2 text-xs">
                                        {c.done ? (
                                            <svg className="w-4 h-4 text-emerald-500 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                                        ) : (
                                            <span className="w-4 h-4 rounded-full border-2 border-slate-300 shrink-0" />
                                        )}
                                        <span className={c.done ? 'text-slate-700 font-medium' : 'text-slate-400'}>{c.label}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>

                    {/* Availability Status */}
                    <div className={`${cardCls} p-5`}>
                        <h3 className="text-base font-bold text-slate-900 mb-3">Availability Status</h3>

                        {!availEdit ? (
                            <>
                                <div className="flex items-center gap-2 mb-4">
                                    <span className={`w-2.5 h-2.5 rounded-full ${statusMeta.dot}`} />
                                    <span className="text-sm font-semibold text-slate-700">{statusMeta.label}</span>
                                </div>
                                <div className="grid grid-cols-7 gap-1.5 mb-4">
                                    {WEEK_DAYS.map((day) => {
                                        const on = sched.days.includes(day)
                                        return (
                                            <div key={day} className="flex flex-col items-center gap-1.5">
                                                <span className="text-[10px] font-semibold text-slate-500">{day}</span>
                                                <span className={`w-2.5 h-2.5 rounded-full ${on ? 'bg-emerald-500' : 'bg-slate-200'}`} />
                                            </div>
                                        )
                                    })}
                                </div>
                                <p className="text-xs text-slate-400 mb-3">OP Timings: <span className="font-semibold text-slate-600">{sched.opStart} – {sched.opEnd}</span></p>
                                <button
                                    onClick={() => setAvailEdit(true)}
                                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-sm font-semibold"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                    Edit Availability
                                </button>
                            </>
                        ) : (
                            <div className="space-y-4">
                                {/* Status selector */}
                                <div>
                                    <p className="text-xs font-semibold text-slate-600 mb-2">Status</p>
                                    <div className="grid grid-cols-2 gap-2">
                                        {STATUS_OPTIONS.map((opt) => {
                                            const active = sched.status === opt.value
                                            return (
                                                <button
                                                    key={opt.value}
                                                    type="button"
                                                    onClick={() => setSched((p) => ({ ...p, status: opt.value }))}
                                                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 text-xs font-bold transition-all ${active ? `${opt.active} ring-2 ring-offset-1` : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'}`}
                                                >
                                                    <span className={`w-2 h-2 rounded-full ${opt.dot}`} />
                                                    {opt.label}
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>
                                {/* OP timings */}
                                <div>
                                    <p className="text-xs font-semibold text-slate-600 mb-2">OP Timings</p>
                                    <div className="flex items-center gap-2">
                                        <input type="time" value={sched.opStart} onChange={(e) => setSched((p) => ({ ...p, opStart: e.target.value }))} className="flex-1 px-2.5 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400" />
                                        <span className="text-xs text-slate-400">to</span>
                                        <input type="time" value={sched.opEnd} onChange={(e) => setSched((p) => ({ ...p, opEnd: e.target.value }))} className="flex-1 px-2.5 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400" />
                                    </div>
                                </div>
                                {/* Days */}
                                <div>
                                    <p className="text-xs font-semibold text-slate-600 mb-2">Available Days</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {WEEK_DAYS.map((day) => {
                                            const active = sched.days.includes(day)
                                            return (
                                                <button
                                                    key={day}
                                                    type="button"
                                                    onClick={() => toggleDay(day)}
                                                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${active ? 'bg-teal-500 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                                                >
                                                    {day}
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>
                                <div className="flex gap-2 pt-1">
                                    <button onClick={saveAvailability} disabled={savingAvail} className="flex-1 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold disabled:opacity-60">
                                        {savingAvail ? 'Saving…' : 'Save'}
                                    </button>
                                    <button onClick={() => { setAvailEdit(false); getProfileData() }} className="px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold">
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </AdminPageLayout>
    )
}

export default DoctorProfile
