import React, { useContext, useState } from 'react'
import axios from 'axios'
import { toast } from 'react-toastify'
import { DoctorContext } from '../context/DoctorContext'

const TESTS = ['CBC', 'Blood Sugar', 'Lipid Profile', 'Thyroid Panel', 'X-Ray', 'ECG', 'Urine Test', 'Other']

/**
 * Doctor orders an investigation for an accepted patient (existing /api/investigations).
 */
const SuggestInvestigationModal = ({ patientId, patientName, onClose, onCreated }) => {
  const { backendUrl, dToken } = useContext(DoctorContext)
  const [test, setTest] = useState('CBC')
  const [other, setOther] = useState('')
  const [notes, setNotes] = useState('')
  const [priority, setPriority] = useState('ROUTINE')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    const testName = test === 'Other' ? other.trim() : test
    if (!patientId || !testName) return
    setBusy(true)
    try {
      const { data } = await axios.post(
        `${backendUrl}/api/investigations`,
        { patient_id: patientId, test_name: testName, priority, notes: notes.trim() || undefined },
        { headers: { dtoken: dToken } }
      )
      if (data.success) {
        toast.success('Investigation ordered — lab panel updated')
        onCreated?.()
        onClose()
      } else {
        toast.error(data.message || 'Could not order test')
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || err.message)
    } finally {
      setBusy(false)
    }
  }

  const skip = async () => {
    if (!patientId) return
    setBusy(true)
    try {
      await axios.post(
        `${backendUrl}/api/care-decisions`,
        { patient_id: patientId, investigation_required: false },
        { headers: { dtoken: dToken } }
      )
      toast.success('Investigation marked not required')
      onCreated?.()
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.detail || err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <form
        className="bg-white rounded-2xl p-5 max-w-md w-full shadow-xl space-y-3"
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
      >
        <h3 className="font-black text-slate-900">Suggest Investigation</h3>
        <p className="text-xs text-slate-500">{patientName || `Patient #${patientId}`}</p>
        <label className="block text-[11px] font-bold text-slate-500">Test</label>
        <select value={test} onChange={(e) => setTest(e.target.value)} className="w-full border rounded-xl p-2 text-sm">
          {TESTS.map((t) => <option key={t}>{t}</option>)}
        </select>
        {test === 'Other' && (
          <input value={other} onChange={(e) => setOther(e.target.value)} placeholder="Test name" className="w-full border rounded-xl p-2 text-sm" />
        )}
        <label className="block text-[11px] font-bold text-slate-500">Reason / instructions</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="w-full border rounded-xl p-2 text-sm" />
        <label className="block text-[11px] font-bold text-slate-500">Priority</label>
        <select value={priority} onChange={(e) => setPriority(e.target.value)} className="w-full border rounded-xl p-2 text-sm">
          <option value="ROUTINE">ROUTINE</option>
          <option value="URGENT">URGENT</option>
          <option value="STAT">STAT</option>
        </select>
        <div className="flex flex-wrap gap-2 pt-1">
          <button type="submit" disabled={busy} className="px-3 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold disabled:opacity-60">
            {busy ? 'Saving…' : 'Submit to Lab'}
          </button>
          <button type="button" disabled={busy} onClick={skip} className="px-3 py-2 rounded-xl bg-slate-100 text-xs font-bold">
            Not required
          </button>
          <button type="button" onClick={onClose} className="px-3 py-2 rounded-xl text-xs font-bold text-slate-500">Cancel</button>
        </div>
      </form>
    </div>
  )
}

export default SuggestInvestigationModal
