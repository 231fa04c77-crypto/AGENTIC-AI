import React, { useMemo, useRef, useState } from 'react'
import { AdminPageLayout, PageHero, McCard } from './mc'

const SPECIALITIES = [
    'Cardiology', 'Neurology', 'Orthopedics', 'General Medicine', 'Obstetrics & Gynaecology',
    'Paediatrics', 'Dermatology', 'Gastroenterology', 'ENT', 'Ophthalmology', 'Psychiatry', 'Dentistry',
]

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const DOCS = [
    { key: 'medicalRegistration', label: 'Medical Registration', required: true },
    { key: 'qualificationCertificate', label: 'Qualification Certificate', required: true },
    { key: 'experienceCertificate', label: 'Experience Certificate', required: false },
    { key: 'idProof', label: 'ID Proof (Aadhaar / PAN)', required: true },
]

export const generatePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
    let p = 'pms'
    for (let i = 0; i < 7; i++) p += chars[Math.floor(Math.random() * chars.length)]
    return p
}

const inputCls = 'w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm bg-white focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition'
const labelCls = 'block text-xs font-semibold text-slate-600 mb-1.5'

const SectionTitle = ({ icon, children }) => (
    <div className="flex items-center gap-2 mb-4">
        <span className="w-7 h-7 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">{icon}</span>
        <h3 className="text-sm font-bold text-slate-800">{children}</h3>
    </div>
)

const Toggle = ({ checked, onChange, label, sub }) => (
    <div className="flex items-center justify-between gap-3 py-2">
        <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-700">{label}</p>
            {sub && <p className="text-[11px] text-slate-400">{sub}</p>}
        </div>
        <button
            type="button"
            onClick={() => onChange(!checked)}
            className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${checked ? 'bg-teal-500' : 'bg-slate-300'}`}
            aria-pressed={checked}
        >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-5' : ''}`} />
        </button>
    </div>
)

const ChecklistRow = ({ label, state }) => {
    const cfg = {
        complete: { cls: 'text-emerald-500', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /> },
        partial: { cls: 'text-amber-500', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M5.07 19h13.86a2 2 0 001.74-3L13.74 4a2 2 0 00-3.48 0L3.33 16a2 2 0 001.74 3z" /> },
        pending: { cls: 'text-slate-300', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /> },
    }[state]
    return (
        <li className="flex items-center justify-between text-sm py-1.5">
            <span className="flex items-center gap-2 text-slate-600">
                <svg className={`w-4 h-4 ${cfg.cls}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">{cfg.icon}</svg>
                {label}
            </span>
            <svg className={`w-4 h-4 ${cfg.cls}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">{cfg.icon}</svg>
        </li>
    )
}

const AddDoctorForm = ({
    breadcrumb = 'Doctors › Add Doctors',
    onSubmit,
    submitting = false,
    showAddress = true,
}) => {
    const fileRef = useRef(null)
    const [image, setImage] = useState(null)
    const [form, setForm] = useState({
        name: '', gender: '', speciality: '', department: '', qualification: '', experience: '',
        phone: '', email: '', consultationRoom: '', address: '',
        opStart: '09:00', opEnd: '13:00', days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], fees: '',
        password: '',
        activeStatus: true, emergency: true, teleconsult: true,
    })
    const [documents, setDocuments] = useState({})

    const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
    const toggleDay = (d) => setForm(f => ({
        ...f,
        days: f.days.includes(d) ? f.days.filter(x => x !== d) : [...f.days, d],
    }))

    const fmtTime = (t) => {
        if (!t) return ''
        const [h, m] = t.split(':').map(Number)
        const ampm = h >= 12 ? 'PM' : 'AM'
        const hr = h % 12 || 12
        return `${String(hr).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`
    }

    const checklist = useMemo(() => {
        const basic = form.name && form.gender && form.speciality && form.department && form.qualification && form.experience
        const contact = form.phone && form.email && (!showAddress || form.address)
        const scheduling = form.opStart && form.opEnd && form.days.length > 0 && form.fees
        const docCount = DOCS.filter(d => documents[d.key]).length
        const credentials = docCount === DOCS.length ? 'complete' : docCount > 0 ? 'partial' : 'pending'
        return {
            basic: basic ? 'complete' : 'pending',
            contact: contact ? 'complete' : 'pending',
            scheduling: scheduling ? 'complete' : 'pending',
            credentials,
            preferences: 'complete',
        }
    }, [form, documents, showAddress])

    const resetForm = () => {
        setImage(null)
        setDocuments({})
        setForm({
            name: '', gender: '', speciality: '', department: '', qualification: '', experience: '',
            phone: '', email: '', consultationRoom: '', address: '',
            opStart: '09:00', opEnd: '13:00', days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], fees: '',
            password: '',
            activeStatus: true, emergency: true, teleconsult: true,
        })
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        const ok = await onSubmit?.({ ...form, image, documents })
        if (ok) resetForm()
    }

    const previewSrc = image ? URL.createObjectURL(image) : null

    return (
        <AdminPageLayout>
            <PageHero
                title="Add Doctors"
                subtitle={breadcrumb}
                features={['Instant Onboarding', 'Auto Credentials', 'Profile Preview']}
            />

            <form onSubmit={handleSubmit}>
                <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-5 items-start">
                    {/* Main form */}
                    <McCard noPadding>
                        <div className="p-5 sm:p-6 space-y-8">
                            {/* Profile photo + Basic details */}
                            <div className="grid grid-cols-1 md:grid-cols-[170px_1fr] gap-6">
                                <div>
                                    <p className={labelCls}>Profile Photo</p>
                                    <button
                                        type="button"
                                        onClick={() => fileRef.current?.click()}
                                        className="w-full aspect-square rounded-xl border-2 border-dashed border-slate-200 hover:border-sky-400 bg-slate-50 flex flex-col items-center justify-center gap-2 text-center p-3 transition overflow-hidden"
                                    >
                                        {previewSrc ? (
                                            <img src={previewSrc} alt="preview" className="w-full h-full object-cover rounded-lg" />
                                        ) : (
                                            <>
                                                <svg className="w-7 h-7 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                                                <span className="text-xs font-semibold text-slate-600">Upload Photo</span>
                                                <span className="text-[10px] text-slate-400">JPG, PNG or WEBP<br />Max size 2MB</span>
                                            </>
                                        )}
                                    </button>
                                    <p className="text-[10px] text-slate-400 text-center mt-2">Recommended 1:1 ratio</p>
                                    <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => setImage(e.target.files[0] || null)} />
                                </div>

                                <div>
                                    <SectionTitle icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>}>Basic Details</SectionTitle>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="sm:col-span-2">
                                            <label className={labelCls}>Full Name *</label>
                                            <input className={inputCls} value={form.name} onChange={e => set('name', e.target.value)} placeholder="Dr. Full Name" required />
                                        </div>
                                        <div>
                                            <label className={labelCls}>Gender *</label>
                                            <select className={inputCls} value={form.gender} onChange={e => set('gender', e.target.value)} required>
                                                <option value="">Select</option>
                                                <option>Male</option>
                                                <option>Female</option>
                                                <option>Other</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className={labelCls}>Specialization *</label>
                                            <select className={inputCls} value={form.speciality} onChange={e => { const v = e.target.value; setForm(f => ({ ...f, speciality: v, department: f.department || v })) }} required>
                                                <option value="">Select</option>
                                                {SPECIALITIES.map(s => <option key={s} value={s}>{s}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className={labelCls}>Department *</label>
                                            <input className={inputCls} value={form.department} onChange={e => set('department', e.target.value)} placeholder="e.g. Cardiology" required />
                                        </div>
                                        <div>
                                            <label className={labelCls}>Qualification *</label>
                                            <input className={inputCls} value={form.qualification} onChange={e => set('qualification', e.target.value)} placeholder="e.g. MBBS, MD" required />
                                        </div>
                                        <div className="sm:col-span-2">
                                            <label className={labelCls}>Years of Experience *</label>
                                            <input type="number" min="0" className={inputCls} value={form.experience} onChange={e => set('experience', e.target.value)} placeholder="Years" required />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Contact details */}
                            <div>
                                <SectionTitle icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>}>Contact Details</SectionTitle>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <div>
                                        <label className={labelCls}>Phone Number *</label>
                                        <input className={inputCls} value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+91 ..." required />
                                    </div>
                                    <div>
                                        <label className={labelCls}>Email Address *</label>
                                        <input type="email" className={inputCls} value={form.email} onChange={e => set('email', e.target.value)} placeholder="doctor@hospital.com" required />
                                    </div>
                                    <div>
                                        <label className={labelCls}>Consultation Room / Cabin</label>
                                        <input className={inputCls} value={form.consultationRoom} onChange={e => set('consultationRoom', e.target.value)} placeholder="e.g. OPD - 304" />
                                    </div>
                                    {showAddress && (
                                        <div className="sm:col-span-3">
                                            <label className={labelCls}>Address *</label>
                                            <textarea className={inputCls} rows={2} maxLength={150} value={form.address} onChange={e => set('address', e.target.value)} placeholder="Full clinic / hospital address" required />
                                            <p className="text-[10px] text-slate-400 text-right mt-1">{form.address.length} / 150</p>
                                        </div>
                                    )}
                                </div>
                                {!showAddress && (
                                    <p className="text-[11px] text-slate-400 mt-2">The doctor's address is automatically set to your hospital's address.</p>
                                )}
                            </div>

                            {/* Scheduling & Consultation */}
                            <div>
                                <SectionTitle icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}>Scheduling & Consultation</SectionTitle>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                    <div>
                                        <label className={labelCls}>OP Timings *</label>
                                        <div className="flex items-center gap-2">
                                            <input type="time" className={inputCls} value={form.opStart} onChange={e => set('opStart', e.target.value)} />
                                            <span className="text-slate-400 text-sm">to</span>
                                            <input type="time" className={inputCls} value={form.opEnd} onChange={e => set('opEnd', e.target.value)} />
                                        </div>
                                    </div>
                                    <div>
                                        <label className={labelCls}>Consultation Fees (INR) *</label>
                                        <input type="number" min="0" className={inputCls} value={form.fees} onChange={e => set('fees', e.target.value)} placeholder="₹ 500" required />
                                    </div>
                                    <div className="sm:col-span-2">
                                        <label className={labelCls}>Available Days *</label>
                                        <div className="flex flex-wrap gap-2">
                                            {DAYS.map(d => {
                                                const active = form.days.includes(d)
                                                return (
                                                    <button key={d} type="button" onClick={() => toggleDay(d)}
                                                        className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${active ? 'bg-teal-500 text-white shadow-sm' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                                                        {d}
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Credentials & Documents */}
                            <div>
                                <SectionTitle icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>}>Credentials & Documents</SectionTitle>
                                <p className="text-[11px] text-slate-400 mb-3">Upload clear documents (PDF, JPG, PNG). Max size 5MB per file.</p>
                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                                    {DOCS.map(doc => (
                                        <label key={doc.key} className="cursor-pointer">
                                            <p className="text-[11px] font-semibold text-slate-600 mb-1.5">{doc.label} {doc.required && '*'}</p>
                                            <div className={`rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1 p-4 text-center transition ${documents[doc.key] ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-slate-50 hover:border-sky-400'}`}>
                                                <svg className={`w-5 h-5 ${documents[doc.key] ? 'text-emerald-500' : 'text-sky-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    {documents[doc.key]
                                                        ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                        : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />}
                                                </svg>
                                                <span className="text-[10px] text-slate-500 truncate max-w-full">{documents[doc.key]?.name || 'Upload Document'}</span>
                                                <span className="text-[9px] text-slate-400">PDF, JPG, PNG</span>
                                            </div>
                                            <input type="file" accept=".pdf,.jpg,.jpeg,.png" hidden onChange={e => setDocuments(d => ({ ...d, [doc.key]: e.target.files[0] || undefined }))} />
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* Preferences & Availability */}
                            <div>
                                <SectionTitle icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}>Preferences & Availability</SectionTitle>
                                <div className="divide-y divide-slate-100">
                                    <Toggle checked={form.activeStatus} onChange={v => set('activeStatus', v)} label="Active Status" sub="Doctor will be active in the system" />
                                    <Toggle checked={form.emergency} onChange={v => set('emergency', v)} label="Available for Emergency" sub="Include in emergency list" />
                                    <Toggle checked={form.teleconsult} onChange={v => set('teleconsult', v)} label="Available for Teleconsultation" sub="Allow virtual consultations" />
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="flex flex-wrap items-center justify-end gap-3 px-5 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/60">
                            <button type="button" onClick={resetForm} className="px-5 py-2.5 rounded-lg border border-slate-200 bg-white text-sm font-semibold text-slate-600 hover:bg-slate-100 transition">Reset</button>
                            <button type="submit" disabled={submitting}
                                className="px-6 py-2.5 rounded-lg bg-gradient-to-r from-sky-500 to-teal-500 text-white text-sm font-bold shadow hover:shadow-lg transition disabled:opacity-60 inline-flex items-center gap-2">
                                {submitting ? 'Saving...' : 'Save Doctor →'}
                            </button>
                        </div>
                    </McCard>

                    {/* Right sidebar */}
                    <div className="space-y-5">
                        <McCard title="Doctor Summary">
                            <div className="flex items-center gap-3 mb-4">
                                <img
                                    src={previewSrc || `https://ui-avatars.com/api/?name=${encodeURIComponent(form.name || 'Doctor')}&background=0ea5e9&color=fff&size=128`}
                                    alt="summary"
                                    className="w-16 h-16 rounded-full object-cover ring-2 ring-white shadow"
                                />
                                <div className="min-w-0">
                                    <p className="font-bold text-slate-900 truncate">{form.name || 'New Doctor'}</p>
                                    <p className="text-xs text-slate-500 truncate">{form.speciality || 'Specialization'}</p>
                                </div>
                            </div>
                            <ul className="text-xs divide-y divide-slate-100">
                                {[
                                    ['Department', form.department],
                                    ['Qualification', form.qualification],
                                    ['Experience', form.experience ? `${form.experience} Years` : ''],
                                    ['Consultation Room', form.consultationRoom],
                                    ['OP Timings', form.opStart && form.opEnd ? `${fmtTime(form.opStart)} - ${fmtTime(form.opEnd)}` : ''],
                                    ['Available Days', form.days.join(', ')],
                                    ['Consultation Fees', form.fees ? `₹ ${form.fees}` : ''],
                                ].map(([k, v]) => (
                                    <li key={k} className="flex items-center justify-between gap-3 py-2">
                                        <span className="text-slate-400">{k}</span>
                                        <span className="font-semibold text-slate-700 text-right truncate">{v || '—'}</span>
                                    </li>
                                ))}
                            </ul>
                        </McCard>

                        <McCard title="Checklist">
                            <ul>
                                <ChecklistRow label="Basic Details" state={checklist.basic} />
                                <ChecklistRow label="Contact Details" state={checklist.contact} />
                                <ChecklistRow label="Scheduling & Consultation" state={checklist.scheduling} />
                                <ChecklistRow label="Credentials & Documents" state={checklist.credentials} />
                                <ChecklistRow label="Preferences & Availability" state={checklist.preferences} />
                            </ul>
                            <p className="text-[11px] text-slate-400 mt-3 pt-3 border-t border-slate-100">Please upload all mandatory documents to complete.</p>
                        </McCard>
                    </div>
                </div>
            </form>
        </AdminPageLayout>
    )
}

export default AddDoctorForm
