import React, { useContext, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { AdminContext } from '../../context/AdminContext'

// ─── Wizard config ────────────────────────────────────────────────────────────
const STEPS = [
  { id: 'details',      label: 'Hospital Details',   icon: '🏥' },
  { id: 'type',         label: 'Hospital Type',       icon: '🏷️' },
  { id: 'admin',        label: 'Admin Mapping',       icon: '👤' },
  { id: 'departments',  label: 'Departments',         icon: '🗂️' },
  { id: 'review',       label: 'Review & Create',     icon: '✅' },
]

const inputCls = 'w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-admin outline-none text-sm font-medium text-slate-700 transition-colors'
const labelCls = 'block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1'

const Field = ({ label, required, children }) => (
  <div className='space-y-1'>
    <label className={labelCls}>{label}{required && <span className='text-rose-500'> *</span>}</label>
    {children}
  </div>
)

// ─── Step tracker ─────────────────────────────────────────────────────────────
const StepTracker = ({ current }) => (
  <div className='flex items-center gap-0 mb-8 overflow-x-auto'>
    {STEPS.map((step, i) => (
      <React.Fragment key={step.id}>
        <div className={`flex flex-col items-center shrink-0 ${i <= current ? 'opacity-100' : 'opacity-40'}`}>
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-black border-2 transition-all
            ${i < current  ? 'bg-admin border-admin text-white'
            : i === current ? 'bg-admin/10 border-admin text-admin'
            : 'bg-slate-100 border-slate-200 text-slate-400'}`}>
            {i < current ? '✓' : step.icon}
          </div>
          <span className='text-xs font-bold mt-1 text-center whitespace-nowrap max-w-[72px]'>{step.label}</span>
        </div>
        {i < STEPS.length - 1 && (
          <div className={`h-0.5 flex-1 mx-2 rounded transition-all ${i < current ? 'bg-admin' : 'bg-slate-200'}`} />
        )}
      </React.Fragment>
    ))}
  </div>
)

// ─── Step 1: Hospital Details ─────────────────────────────────────────────────
const StepDetails = ({ form, set }) => (
  <div className='grid grid-cols-1 sm:grid-cols-2 gap-5'>
    <Field label='Hospital Name' required>
      <input value={form.name} onChange={e => set({ name: e.target.value })} className={inputCls} placeholder='e.g. City General Hospital' />
    </Field>
    <Field label='Contact Number' required>
      <input value={form.contact} onChange={e => set({ contact: e.target.value })} className={inputCls} placeholder='+91 98765 43210' />
    </Field>
    <Field label='Email'>
      <input type='email' value={form.email} onChange={e => set({ email: e.target.value })} className={inputCls} placeholder='admin@hospital.com' />
    </Field>
    <Field label='City'>
      <input value={form.city} onChange={e => set({ city: e.target.value })} className={inputCls} placeholder='Hyderabad' />
    </Field>
    <div className='sm:col-span-2'>
      <Field label='Address'>
        <textarea value={form.address} onChange={e => set({ address: e.target.value })} rows={2} className={inputCls} placeholder='Full clinic/hospital address' />
      </Field>
    </div>
  </div>
)

// ─── Step 2: Hospital Type ────────────────────────────────────────────────────
const HOSPITAL_TYPES = [
  { id: 'multispeciality', label: 'Multi-Speciality', desc: 'Multiple departments and specialities' },
  { id: 'clinic',          label: 'Clinic',            desc: 'Single or few doctors, no departments' },
  { id: 'diagnostic',      label: 'Diagnostic Centre', desc: 'Labs, imaging, diagnostics only' },
  { id: 'emergency',       label: 'Emergency Centre',  desc: '24/7 emergency and trauma care' },
]

const StepType = ({ form, set }) => (
  <div className='space-y-3'>
    <p className='text-sm text-slate-500 mb-4'>Select the type that best describes this hospital or facility.</p>
    {HOSPITAL_TYPES.map(t => (
      <div key={t.id}
        onClick={() => set({ hospitalType: t.id })}
        className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${form.hospitalType === t.id ? 'border-admin bg-admin/5' : 'border-slate-200 hover:border-slate-300 bg-white'}`}>
        <div className='flex items-center gap-3'>
          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${form.hospitalType === t.id ? 'border-admin bg-admin' : 'border-slate-300'}`}>
            {form.hospitalType === t.id && <div className='w-2 h-2 rounded-full bg-white' />}
          </div>
          <div>
            <p className='font-bold text-slate-700'>{t.label}</p>
            <p className='text-xs text-slate-400'>{t.desc}</p>
          </div>
        </div>
      </div>
    ))}
  </div>
)

// ─── Step 3: Admin Mapping ────────────────────────────────────────────────────
const StepAdmin = ({ form, set }) => (
  <div className='space-y-5'>
    <p className='text-sm text-slate-500'>Does this hospital have a dedicated Dean/Hospital Admin account?</p>
    <div className='flex gap-3'>
      {[{ v: true, label: 'Yes — Assign a Dean' }, { v: false, label: 'No — Self-Managed' }].map(opt => (
        <button key={String(opt.v)} onClick={() => set({ hasDean: opt.v })}
          className={`flex-1 py-3 px-4 rounded-xl border-2 font-bold text-sm transition-all ${form.hasDean === opt.v ? 'border-admin bg-admin/10 text-admin' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>
          {opt.label}
        </button>
      ))}
    </div>
    {form.hasDean && (
      <div className='space-y-4 pt-2'>
        <Field label='Dean Name' required>
          <input value={form.deanName} onChange={e => set({ deanName: e.target.value })} className={inputCls} placeholder='Full name of the hospital admin' />
        </Field>
        <Field label='Dean Email' required>
          <input type='email' value={form.deanEmail} onChange={e => set({ deanEmail: e.target.value })} className={inputCls} placeholder='dean@hospital.com' />
        </Field>
        <Field label='Temporary Password' required>
          <input type='password' value={form.deanPassword} onChange={e => set({ deanPassword: e.target.value })} className={inputCls} placeholder='Min 8 characters' />
        </Field>
      </div>
    )}
  </div>
)

// ─── Step 4: Departments ──────────────────────────────────────────────────────
const StepDepartments = ({ form, set }) => {
  const [input, setInput] = useState('')

  const add = () => {
    const name = input.trim()
    if (!name) return
    if (form.departments.some(d => d.toLowerCase() === name.toLowerCase())) {
      toast.warning('Department already added')
      return
    }
    set({ departments: [...form.departments, name] })
    setInput('')
  }

  const remove = (i) => set({ departments: form.departments.filter((_, idx) => idx !== i) })

  return (
    <div className='space-y-4'>
      <p className='text-sm text-slate-500'>Add the clinical departments for this hospital. You can skip this for clinics.</p>
      <div className='flex gap-3'>
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()}
          className={inputCls} placeholder='e.g. Cardiology, Pediatrics…' />
        <button onClick={add} className='px-5 py-2.5 bg-admin text-white rounded-xl font-bold text-sm shrink-0'>Add</button>
      </div>
      <div className='flex flex-wrap gap-2'>
        {form.departments.map((d, i) => (
          <span key={i} className='inline-flex items-center gap-1.5 px-3 py-1.5 bg-admin/10 text-admin rounded-xl font-semibold text-sm'>
            {d}
            <button onClick={() => remove(i)} className='text-admin/60 hover:text-admin font-black leading-none'>&times;</button>
          </span>
        ))}
        {form.departments.length === 0 && (
          <span className='text-sm text-slate-400 italic'>No departments added yet</span>
        )}
      </div>
    </div>
  )
}

// ─── Step 5: Review & Create ──────────────────────────────────────────────────
const StepReview = ({ form }) => (
  <div className='space-y-4'>
    <p className='text-sm text-slate-500 mb-2'>Review all details before creating the hospital account.</p>
    {[
      { label: 'Hospital Name', value: form.name },
      { label: 'Contact',       value: form.contact },
      { label: 'Email',         value: form.email || '—' },
      { label: 'City',          value: form.city || '—' },
      { label: 'Type',          value: form.hospitalType },
      { label: 'Dean / Admin',  value: form.hasDean ? `${form.deanName} (${form.deanEmail})` : 'Self-Managed' },
      { label: 'Departments',   value: form.departments.length ? form.departments.join(', ') : 'None' },
    ].map(r => (
      <div key={r.label} className='flex justify-between items-start gap-4 py-2.5 border-b border-slate-100 last:border-0'>
        <span className='text-xs font-bold text-slate-400 uppercase tracking-wide shrink-0'>{r.label}</span>
        <span className='text-sm font-semibold text-slate-700 text-right'>{r.value}</span>
      </div>
    ))}
  </div>
)

// ─── Main Wizard ──────────────────────────────────────────────────────────────
const INITIAL = {
  name: '', contact: '', email: '', city: '', address: '',
  hospitalType: 'multispeciality',
  hasDean: false,
  deanName: '', deanEmail: '', deanPassword: '',
  departments: [],
}

const HospitalWizard = () => {
  const { aToken, backendUrl } = useContext(AdminContext)
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [form, setFormRaw] = useState(INITIAL)
  const [submitting, setSubmitting] = useState(false)

  const set = (patch) => setFormRaw(prev => ({ ...prev, ...patch }))

  const validate = () => {
    if (step === 0 && (!form.name.trim() || !form.contact.trim())) {
      toast.error('Hospital Name and Contact are required')
      return false
    }
    if (step === 2 && form.hasDean && (!form.deanName || !form.deanEmail || !form.deanPassword)) {
      toast.error('Dean Name, Email, and Password are required')
      return false
    }
    return true
  }

  const next = () => { if (validate()) setStep(s => Math.min(s + 1, STEPS.length - 1)) }
  const back = () => setStep(s => Math.max(s - 1, 0))

  const submit = async () => {
    setSubmitting(true)
    try {
      const axios = (await import('axios')).default
      const { data } = await axios.post(
        `${backendUrl}/api/admin/hospitals/create-wizard`,
        form,
        { headers: { atoken: aToken } },
      )
      if (data?.success) {
        toast.success(`✅ ${form.name} created successfully!`)
        navigate('/hospital-tieups')
      } else {
        toast.error(data?.message || 'Failed to create hospital')
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Server error. Please try again.')
    }
    setSubmitting(false)
  }

  return (
    <div className='min-h-screen bg-mc-bg p-6'>
      <div className='max-w-2xl mx-auto'>
        {/* Header */}
        <div className='mb-6'>
          <h1 className='text-2xl font-black text-mc-text'>New Hospital Onboarding</h1>
          <p className='text-sm text-slate-400 mt-1'>Create a new hospital account in the MedClues network</p>
        </div>

        {/* Step tracker */}
        <StepTracker current={step} />

        {/* Step content */}
        <div className='bg-white rounded-2xl border border-slate-200 shadow-sm p-6'>
          <h2 className='text-base font-black text-slate-700 mb-5'>{STEPS[step].icon} {STEPS[step].label}</h2>

          {step === 0 && <StepDetails form={form} set={set} />}
          {step === 1 && <StepType    form={form} set={set} />}
          {step === 2 && <StepAdmin   form={form} set={set} />}
          {step === 3 && <StepDepartments form={form} set={set} />}
          {step === 4 && <StepReview  form={form} />}

          {/* Navigation */}
          <div className='flex justify-between mt-8 pt-4 border-t border-slate-100'>
            <button onClick={back} disabled={step === 0}
              className='px-5 py-2.5 bg-slate-100 text-slate-600 rounded-xl font-bold text-sm disabled:opacity-40'>
              ← Back
            </button>
            {step < STEPS.length - 1
              ? <button onClick={next} className='px-6 py-2.5 bg-admin text-white rounded-xl font-bold text-sm shadow-sm'>
                  Next →
                </button>
              : <button onClick={submit} disabled={submitting}
                  className='px-6 py-2.5 bg-admin text-white rounded-xl font-bold text-sm shadow-sm disabled:opacity-60'>
                  {submitting ? 'Creating…' : '🚀 Create Hospital'}
                </button>
            }
          </div>
        </div>
      </div>
    </div>
  )
}

export default HospitalWizard
