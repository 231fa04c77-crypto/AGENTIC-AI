import React, { useContext, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { ReceptionContext } from '../../context/ReceptionContext'
import { PageWrap, RcHeader, Avatar, fmtMoney, ReceptionTabs, RECEPTION_TAB_GROUPS } from './components'

const STEPS = ['Patient Details', 'Appointment & Doctor', 'Payment', 'Token & Queue']

const Field = ({ label, required, children }) => (
  <div className='space-y-1.5'>
    <label className='block text-xs font-bold text-rd-muted'>{label}{required && <span className='text-rd-critical'> *</span>}</label>
    {children}
  </div>
)

const inputCls = 'w-full px-3 py-2 rounded-rd border border-rd-border bg-rd-surface focus:border-rd-primary outline-none text-sm font-medium text-rd-text'

const StepDots = ({ step }) => (
  <div className='flex items-center gap-2 mb-6 overflow-x-auto'>
    {STEPS.map((s, i) => (
      <React.Fragment key={s}>
        <div className={`flex items-center gap-2 shrink-0 ${i <= step ? 'text-rd-primary' : 'text-rd-muted'}`}>
          <span className={`w-7 h-7 rounded-rd-sm flex items-center justify-center text-xs font-bold ${i < step ? 'rd-tab-active' : i === step ? 'rd-tab-active' : 'bg-rd-info-bg text-rd-muted'}`}>
            {i < step ? '✓' : i + 1}
          </span>
          <span className='text-sm font-bold whitespace-nowrap'>{s}</span>
        </div>
        {i < STEPS.length - 1 && <div className={`h-0.5 w-8 rounded shrink-0 ${i < step ? 'bg-rd-primary' : 'bg-rd-border'}`} />}
      </React.Fragment>
    ))}
  </div>
)

const WalkInRegistration = () => {
  const { searchPatients, getDoctors, bookWalkIn } = useContext(ReceptionContext)
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [patient, setPatient] = useState({ name: '', age: '', gender: 'Male', phone: '', email: '', address: '', complaint: '' })
  const [selectedPatientId, setSelectedPatientId] = useState(null)
  const [doctors, setDoctors] = useState([])
  const [docId, setDocId] = useState('')
  const [slotTime, setSlotTime] = useState('')
  const [payment, setPayment] = useState({ method: 'cash', collected: true })
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState(null)

  useEffect(() => { (async () => { const r = await getDoctors(); if (r?.success) setDoctors(r.doctors || []) })() }, [])

  useEffect(() => {
    const t = setTimeout(async () => {
      if (query.trim().length < 2) { setResults([]); return }
      const r = await searchPatients(query.trim())
      if (r?.success) setResults(r.patients || [])
    }, 350)
    return () => clearTimeout(t)
  }, [query])

  const selectedDoctor = doctors.find((d) => String(d._id) === String(docId))
  const fee = Number(selectedDoctor?.fees || 0)

  const pickPatient = (p) => {
    setSelectedPatientId(p._id)
    setPatient({ name: p.name || '', age: p.age || '', gender: p.gender || 'Male', phone: p.phone || '', email: p.email || '', address: p.address?.line1 || '', complaint: '' })
    setResults([]); setQuery('')
  }

  const next = () => {
    if (step === 0 && !patient.name) return toast.error('Enter patient name')
    if (step === 1 && !docId) return toast.error('Select a doctor')
    setStep((s) => Math.min(s + 1, 3))
  }

  const submit = async () => {
    setSubmitting(true)
    const payload = {
      userId: selectedPatientId || undefined,
      patient: selectedPatientId ? undefined : {
        name: patient.name, age: patient.age, gender: patient.gender,
        phone: patient.phone, email: patient.email, address: patient.address,
      },
      docId: Number(docId),
      slotTime: slotTime || 'Walk-in',
      symptoms: patient.complaint ? [patient.complaint] : [],
      amount: fee,
      paymentMethod: payment.method,
      paymentCollected: payment.collected,
    }
    const res = await bookWalkIn(payload)
    setSubmitting(false)
    if (res?.success) { setResult(res); setStep(3) }
  }

  return (
    <PageWrap>
      <RcHeader title='Check-In' subtitle='Register a walk-in patient and add them to the queue' />
      <ReceptionTabs items={RECEPTION_TAB_GROUPS.checkin} />

      <div className='rd-panel p-5 sm:p-7'>
        <StepDots step={step} />

        {step === 0 && (
          <div className='grid lg:grid-cols-3 gap-6'>
            <div className='lg:col-span-2 grid sm:grid-cols-2 gap-4'>
              <Field label='Full Name' required><input className={inputCls} value={patient.name} onChange={(e) => setPatient({ ...patient, name: e.target.value })} placeholder='Ravi Kumar' /></Field>
              <div className='grid grid-cols-2 gap-3'>
                <Field label='Age'><input className={inputCls} value={patient.age} onChange={(e) => setPatient({ ...patient, age: e.target.value })} placeholder='42' /></Field>
                <Field label='Gender'>
                  <select className={inputCls} value={patient.gender} onChange={(e) => setPatient({ ...patient, gender: e.target.value })}>
                    <option>Male</option><option>Female</option><option>Other</option>
                  </select>
                </Field>
              </div>
              <Field label='Mobile Number' required><input className={inputCls} value={patient.phone} onChange={(e) => setPatient({ ...patient, phone: e.target.value })} placeholder='9876543210' /></Field>
              <Field label='Email'><input className={inputCls} value={patient.email} onChange={(e) => setPatient({ ...patient, email: e.target.value })} placeholder='ravi.kumar@email.com' /></Field>
              <div className='sm:col-span-2'><Field label='Address'><input className={inputCls} value={patient.address} onChange={(e) => setPatient({ ...patient, address: e.target.value })} placeholder='15, Green Park' /></Field></div>
              <div className='sm:col-span-2'><Field label='Complaint'><textarea rows={2} className={inputCls} value={patient.complaint} onChange={(e) => setPatient({ ...patient, complaint: e.target.value })} placeholder='Fever and headache since 2 days' /></Field></div>
            </div>

            <div className='bg-rd-canvas rounded-rd p-4 border border-rd-border'>
              <p className='text-xs font-bold text-rd-muted uppercase tracking-wider mb-3'>Search Existing Patient</p>
              <input className={inputCls} value={query} onChange={(e) => setQuery(e.target.value)} placeholder='Search by name or mobile number' />
              <div className='mt-3 space-y-2 max-h-72 overflow-y-auto'>
                {results.map((p) => (
                  <button key={p._id} onClick={() => pickPatient(p)} className='w-full flex items-center gap-3 p-2.5 rounded-rd bg-rd-surface border border-rd-border hover:border-rd-primary text-left transition-colors'>
                    <Avatar name={p.name} src={p.image} />
                    <div className='min-w-0'>
                      <p className='text-sm font-bold text-rd-text truncate'>{p.name}</p>
                      <p className='text-xs text-rd-muted'>{p.phone || p.email}</p>
                    </div>
                  </button>
                ))}
                {selectedPatientId && <p className='text-xs text-rd-good font-semibold'>✓ Existing patient selected</p>}
              </div>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className='grid sm:grid-cols-2 gap-4 max-w-2xl'>
            <Field label='Select Doctor' required>
              <select className={inputCls} value={docId} onChange={(e) => setDocId(e.target.value)}>
                <option value=''>Choose a doctor…</option>
                {doctors.map((d) => <option key={d._id} value={d._id}>{d.name} — {d.speciality}</option>)}
              </select>
            </Field>
            <Field label='Slot Time'><input className={inputCls} value={slotTime} onChange={(e) => setSlotTime(e.target.value)} placeholder='e.g. 10:30 AM (optional)' /></Field>
            {selectedDoctor && (
              <div className='sm:col-span-2 flex items-center gap-3 p-4 rounded-rd bg-rd-info-bg border border-blue-100'>
                <Avatar name={selectedDoctor.name} src={selectedDoctor.image} className='w-12 h-12' />
                <div>
                  <p className='font-bold text-rd-text'>{selectedDoctor.name}</p>
                  <p className='text-sm text-rd-muted'>{selectedDoctor.speciality} · Consultation {fmtMoney(fee)}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className='grid sm:grid-cols-2 gap-4 max-w-2xl'>
            <Field label='Consultation Fee'><input disabled className={inputCls} value={fmtMoney(fee)} /></Field>
            <Field label='Payment Method'>
              <select className={inputCls} value={payment.method} onChange={(e) => setPayment({ ...payment, method: e.target.value })}>
                <option value='cash'>Cash</option><option value='card'>Card</option><option value='upi'>UPI</option>
              </select>
            </Field>
            <div className='sm:col-span-2'>
              <label className='flex items-center gap-3 p-3 rounded-rd border border-rd-border cursor-pointer'>
                <input type='checkbox' checked={payment.collected} onChange={(e) => setPayment({ ...payment, collected: e.target.checked })} className='w-4 h-4 accent-blue-600' />
                <span className='text-sm font-semibold text-rd-text'>Payment collected at desk</span>
              </label>
            </div>
          </div>
        )}

        {step === 3 && result && (
          <div className='text-center py-8'>
            <div className='mx-auto w-16 h-16 rounded-rd-sm bg-rd-good-bg text-rd-good flex items-center justify-center mb-4'>
              <svg className='w-8 h-8' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M5 13l4 4L19 7' /></svg>
            </div>
            <p className='text-lg font-bold text-rd-text'>Walk-in Registered!</p>
            <p className='text-5xl font-bold text-rd-primary my-4'>T-{String(result.token || 0).padStart(3, '0')}</p>
            <p className='text-sm text-rd-muted'>{patient.name} has been added to the queue.</p>
            <div className='flex items-center justify-center gap-3 mt-6'>
              <button onClick={() => navigate('/reception-queue')} className='px-5 py-2.5 rounded-rd bg-rd-primary text-white text-sm font-bold hover:bg-rd-primary-hover'>View Queue</button>
              <button onClick={() => window.location.reload()} className='px-5 py-2.5 rounded-rd border border-rd-border text-rd-muted text-sm font-bold hover:bg-rd-canvas'>New Registration</button>
            </div>
          </div>
        )}

        {step < 3 && (
          <div className='flex items-center justify-between mt-8 pt-5 border-t border-rd-border'>
            <button disabled={step === 0} onClick={() => setStep((s) => s - 1)} className='px-5 py-2.5 rounded-rd border border-rd-border text-rd-muted text-sm font-bold disabled:opacity-40 hover:bg-rd-canvas'>Back</button>
            {step < 2 ? (
              <button onClick={next} className='px-6 py-2.5 rounded-rd bg-rd-primary text-white text-sm font-bold hover:bg-rd-primary-hover'>Next →</button>
            ) : (
              <button disabled={submitting} onClick={submit} className='px-6 py-2.5 rounded-rd bg-rd-primary text-white text-sm font-bold hover:bg-rd-primary-hover disabled:opacity-50'>{submitting ? 'Registering…' : 'Confirm & Register'}</button>
            )}
          </div>
        )}
      </div>
    </PageWrap>
  )
}

export default WalkInRegistration
