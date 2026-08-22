import React, { useState } from 'react'
import { getPatientName } from '../utils/appointmentDisplay'

const CompleteConsultationModal = ({ appointment, onClose, onSubmit, submitting }) => {
  const [diagnosis, setDiagnosis] = useState('')
  const [prescription, setPrescription] = useState('')
  const [notes, setNotes] = useState('')
  const [advice, setAdvice] = useState('')
  const [followupDate, setFollowupDate] = useState('')

  if (!appointment) return null

  const handleSubmit = (e) => {
    e.preventDefault()
    onSubmit({
      diagnosis: diagnosis.trim() || undefined,
      prescription: prescription.trim() || undefined,
      notes: notes.trim() || undefined,
      advice: advice.trim() || undefined,
      followupDate: followupDate || undefined,
    })
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl max-w-lg w-full relative"
        onClick={(e) => e.stopPropagation()}
      >
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 max-h-[90vh] overflow-y-auto">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-gray-900">Complete consultation</h2>
              <p className="text-sm text-gray-600 mt-0.5">
                {getPatientName(appointment)} — prescription will sync to the patient app
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 p-1 rounded-lg hover:bg-gray-100"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="space-y-3">
            <label className="block">
              <span className="text-xs font-semibold text-gray-600 uppercase">Diagnosis</span>
              <textarea
                value={diagnosis}
                onChange={(e) => setDiagnosis(e.target.value)}
                rows={2}
                placeholder="Primary diagnosis…"
                className="mt-1 w-full text-sm border border-gray-200 rounded-lg p-3 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400 outline-none resize-y"
              />
            </label>

            <label className="block">
              <span className="text-xs font-semibold text-gray-600 uppercase">Prescription *</span>
              <textarea
                value={prescription}
                onChange={(e) => setPrescription(e.target.value)}
                rows={4}
                required
                placeholder="Medicines, dosage, duration…"
                className="mt-1 w-full text-sm border border-gray-200 rounded-lg p-3 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400 outline-none resize-y"
              />
            </label>

            <label className="block">
              <span className="text-xs font-semibold text-gray-600 uppercase">Clinical notes</span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Exam findings, vitals, observations…"
                className="mt-1 w-full text-sm border border-gray-200 rounded-lg p-3 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400 outline-none resize-y"
              />
            </label>

            <label className="block">
              <span className="text-xs font-semibold text-gray-600 uppercase">Advice to patient</span>
              <textarea
                value={advice}
                onChange={(e) => setAdvice(e.target.value)}
                rows={2}
                placeholder="Diet, rest, warning signs…"
                className="mt-1 w-full text-sm border border-gray-200 rounded-lg p-3 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400 outline-none resize-y"
              />
            </label>

            <label className="block">
              <span className="text-xs font-semibold text-gray-600 uppercase">Follow-up date</span>
              <input
                type="date"
                min={new Date().toISOString().slice(0, 10)}
                value={followupDate}
                onChange={(e) => setFollowupDate(e.target.value)}
                className="mt-1 w-full text-sm border border-gray-200 rounded-lg p-2.5 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400 outline-none"
              />
            </label>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !prescription.trim()}
              className="flex-1 px-4 py-2.5 bg-teal-600 text-white rounded-lg text-sm font-semibold hover:bg-teal-700 disabled:opacity-50"
            >
              {submitting ? 'Saving…' : 'Complete & send to patient'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default CompleteConsultationModal
