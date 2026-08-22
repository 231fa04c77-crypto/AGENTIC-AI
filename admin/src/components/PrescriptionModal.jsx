import React, { useState, useEffect, useContext } from 'react'
import axios from 'axios'
import { toast } from 'react-toastify'
import { AppContext } from '../context/AppContext'
import { DoctorContext } from '../context/DoctorContext'
import { getPatientName, getPatientImage } from '../utils/appointmentDisplay'

const inputCls = 'w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition'
const labelCls = 'block text-xs font-semibold text-slate-600 mb-1.5'

const PrescriptionModal = ({ appointment, onClose, onSaved }) => {
    const { backendUrl } = useContext(AppContext)
    const { dToken } = useContext(DoctorContext)

    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [form, setForm] = useState({ diagnosis: '', prescription: '', advice: '', notes: '', followupDate: '' })

    const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

    useEffect(() => {
        let cancelled = false
        const load = async () => {
            setLoading(true)
            try {
                const { data } = await axios.get(
                    `${backendUrl}/api/doctor/appointments/${appointment._id}/consultation`,
                    { headers: { dToken } }
                )
                if (!cancelled && data?.success && data.consultation) {
                    const c = data.consultation
                    setForm({
                        diagnosis: c.diagnosis || '',
                        prescription: c.prescription || '',
                        advice: c.advice || '',
                        notes: c.notes || '',
                        followupDate: c.followupDate ? String(c.followupDate).slice(0, 10) : '',
                    })
                }
            } catch (_) {
                // start blank on error
            } finally {
                if (!cancelled) setLoading(false)
            }
        }
        load()
        return () => { cancelled = true }
    }, [appointment._id, backendUrl, dToken])

    const handleSave = async () => {
        if (!form.prescription.trim()) {
            toast.error('Please enter the prescription before sending.')
            return
        }
        setSaving(true)
        try {
            const { data } = await axios.post(
                `${backendUrl}/api/doctor/appointments/${appointment._id}/publish-prescription`,
                form,
                { headers: { dToken } }
            )
            if (data?.success) {
                toast.success(data.message || 'Prescription sent to patient')
                onSaved?.()
                onClose()
            } else {
                toast.error(data?.message || 'Could not save prescription')
            }
        } catch (err) {
            toast.error(err?.response?.data?.message || 'Could not save prescription')
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div
                className="bg-white rounded-2xl shadow-2xl max-w-lg w-full relative animate-scale-in overflow-hidden flex flex-col"
                onClick={(e) => e.stopPropagation()}
                style={{ maxHeight: '92vh' }}
            >
                {/* Header */}
                <div className="relative bg-gradient-to-r from-slate-800 to-slate-700 px-5 sm:px-6 py-5">
                    <button onClick={onClose} className="absolute top-4 right-4 text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10" aria-label="Close">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                    <p className="text-[11px] uppercase tracking-widest text-white/60 font-semibold">Prescription</p>
                    <div className="flex items-center gap-3 mt-3">
                        <img src={getPatientImage(appointment)} className="w-11 h-11 rounded-full object-cover ring-2 ring-white/30" alt="" />
                        <div className="min-w-0">
                            <h2 className="text-base font-bold text-white truncate">{getPatientName(appointment)}</h2>
                            <p className="text-xs text-white/70">Update or add the prescription for this consultation</p>
                        </div>
                    </div>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-16">
                        <div className="w-9 h-9 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
                    </div>
                ) : (
                    <div className="p-5 sm:p-6 overflow-y-auto space-y-4">
                        <div>
                            <label className={labelCls}>Diagnosis</label>
                            <input className={inputCls} value={form.diagnosis} onChange={(e) => set('diagnosis', e.target.value)} placeholder="e.g. Viral fever" />
                        </div>
                        <div>
                            <label className={labelCls}>Prescription *</label>
                            <textarea className={inputCls} rows={5} value={form.prescription} onChange={(e) => set('prescription', e.target.value)} placeholder="Medicines, dosage and duration…" />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className={labelCls}>Advice</label>
                                <input className={inputCls} value={form.advice} onChange={(e) => set('advice', e.target.value)} placeholder="e.g. Rest, hydration" />
                            </div>
                            <div>
                                <label className={labelCls}>Follow-up date</label>
                                <input type="date" className={inputCls} value={form.followupDate} onChange={(e) => set('followupDate', e.target.value)} />
                            </div>
                        </div>
                        <div>
                            <label className={labelCls}>Internal notes</label>
                            <textarea className={inputCls} rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Notes (visible to the patient in their record)" />
                        </div>
                        <div className="flex items-start gap-2 text-xs text-slate-500 bg-blue-50/60 border border-blue-100 rounded-lg px-3 py-2">
                            <svg className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                            The patient gets a real-time notification on their phone as soon as you send this.
                        </div>
                    </div>
                )}

                {/* Footer */}
                <div className="px-5 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/60 flex gap-3">
                    <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-slate-600 font-semibold text-sm hover:bg-slate-100">Cancel</button>
                    <button onClick={handleSave} disabled={saving || loading} className="flex-1 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm disabled:opacity-60 inline-flex items-center justify-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        {saving ? 'Sending…' : 'Send to Patient'}
                    </button>
                </div>
            </div>
        </div>
    )
}

export default PrescriptionModal
