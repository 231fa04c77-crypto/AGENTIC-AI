import React, { useContext, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ReceptionContext } from '../../context/ReceptionContext'
import { PageWrap, Avatar, todayLabel } from './components'
import { RecGlyph } from './icons'

const PREFS_KEY = 'rd_desk_prefs'

const DEFAULT_PREFS = {
  queueSound: true,
  compactTables: false,
  confirmCollectPayment: true,
}

function loadPrefs() {
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    if (!raw) return { ...DEFAULT_PREFS }
    return { ...DEFAULT_PREFS, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULT_PREFS }
  }
}

const Field = ({ label, value }) => (
  <div className='py-3.5 border-b border-rd-border last:border-b-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1'>
    <span className='text-xs font-semibold uppercase tracking-wider text-rd-muted'>{label}</span>
    <span className='text-sm font-semibold text-rd-text break-all'>{value || '—'}</span>
  </div>
)

const PrefToggle = ({ label, hint, checked, onChange }) => (
  <label className='flex items-start justify-between gap-4 py-3.5 border-b border-rd-border last:border-b-0 cursor-pointer'>
    <div className='min-w-0'>
      <p className='text-sm font-semibold text-rd-text'>{label}</p>
      {hint && <p className='text-xs text-rd-muted mt-0.5'>{hint}</p>}
    </div>
    <button
      type='button'
      role='switch'
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative shrink-0 w-10 h-6 rounded-full transition-colors duration-150 ${
        checked ? 'bg-rd-primary' : 'bg-rd-border'
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-150 ${
          checked ? 'translate-x-4' : 'translate-x-0'
        }`}
      />
    </button>
  </label>
)

const QuickLink = ({ to, icon, label, desc }) => (
  <Link
    to={to}
    className='flex items-center gap-3 p-3.5 rounded-rd border border-rd-border bg-rd-surface hover:border-rd-primary hover:bg-rd-info-bg transition-colors'
  >
    <div className='w-9 h-9 rounded-rd-sm bg-rd-info-bg text-rd-primary flex items-center justify-center shrink-0'>
      <RecGlyph name={icon} className='w-4 h-4' />
    </div>
    <div className='min-w-0'>
      <p className='text-sm font-semibold text-rd-text'>{label}</p>
      <p className='text-xs text-rd-muted truncate'>{desc}</p>
    </div>
  </Link>
)

const Settings = () => {
  const { recInfo, logout } = useContext(ReceptionContext)
  const navigate = useNavigate()
  const [prefs, setPrefs] = useState(loadPrefs)

  useEffect(() => {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
  }, [prefs])

  const setPref = (key, value) => setPrefs((p) => ({ ...p, [key]: value }))

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  const hospital = recInfo?.hospitalName || 'Hospital'
  const name = recInfo?.name || 'Receptionist'

  return (
    <PageWrap>
      {/* Hero — unique to Settings */}
      <div className='relative overflow-hidden rounded-rd border border-rd-border mb-5 bg-rd-sidebar text-white'>
        <div
          className='absolute inset-0 opacity-30 pointer-events-none'
          style={{
            background:
              'linear-gradient(135deg, rgba(255,255,255,0.12) 0%, transparent 55%), radial-gradient(ellipse at 90% 10%, rgba(255,255,255,0.1), transparent 50%)',
          }}
        />
        <div className='relative flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 p-5 sm:p-6'>
          <div className='flex items-center gap-4'>
            <Avatar name={name} className='w-16 h-16 sm:w-[72px] sm:h-[72px] ring-2 ring-white/25' />
            <div>
              <p className='text-[11px] font-semibold uppercase tracking-[0.14em] text-white/70'>
                Front office account
              </p>
              <h1 className='text-xl sm:text-2xl font-bold tracking-tight mt-0.5'>{name}</h1>
              <div className='flex flex-wrap items-center gap-2 mt-2'>
                <span className='inline-flex items-center px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide bg-white/15 border border-white/20'>
                  Receptionist
                </span>
                <span className='text-sm text-white/85'>{hospital}</span>
              </div>
            </div>
          </div>
          <p className='text-xs text-white/60 font-medium tabular-nums'>{todayLabel()}</p>
        </div>
      </div>

      <div className='grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-5'>
        {/* Left column */}
        <div className='lg:col-span-7 space-y-4'>
          <section className='rd-panel p-5'>
            <h2 className='text-xs font-bold uppercase tracking-[0.12em] text-rd-muted mb-1'>Account</h2>
            <p className='text-sm text-rd-muted mb-3'>Read-only profile for this reception desk login.</p>
            <Field label='Email' value={recInfo?.email} />
            <Field label='Hospital' value={hospital} />
            <Field label='Role' value='Receptionist' />
          </section>

          <section className='rd-panel p-5'>
            <h2 className='text-xs font-bold uppercase tracking-[0.12em] text-rd-muted mb-1'>
              Desk preferences
            </h2>
            <p className='text-sm text-rd-muted mb-2'>Saved on this browser only.</p>
            <PrefToggle
              label='Queue sound alerts'
              hint='Play a soft cue when the live queue updates'
              checked={prefs.queueSound}
              onChange={(v) => setPref('queueSound', v)}
            />
            <PrefToggle
              label='Compact tables'
              hint='Tighter row spacing on queue and billing lists'
              checked={prefs.compactTables}
              onChange={(v) => setPref('compactTables', v)}
            />
            <PrefToggle
              label='Confirm before collect payment'
              hint='Ask for confirmation when marking an appointment paid'
              checked={prefs.confirmCollectPayment}
              onChange={(v) => setPref('confirmCollectPayment', v)}
            />
          </section>
        </div>

        {/* Right column */}
        <div className='lg:col-span-5 space-y-4'>
          <section className='rd-panel p-5'>
            <h2 className='text-xs font-bold uppercase tracking-[0.12em] text-rd-muted mb-3'>
              Quick links
            </h2>
            <div className='space-y-2.5'>
              <QuickLink
                to='/reception-payments'
                icon='billing'
                label='Billing'
                desc='Collect payments & refunds'
              />
              <QuickLink
                to='/reception-reports'
                icon='reports'
                label='Reports'
                desc='Daily desk summaries'
              />
              <QuickLink
                to='/reception-today'
                icon='clipboard'
                label="Today's Ops"
                desc='Walk-ins, tokens & check-in'
              />
            </div>
          </section>

          <section className='rd-panel p-5 border-l-[3px] border-l-rd-primary'>
            <h2 className='text-xs font-bold uppercase tracking-[0.12em] text-rd-muted mb-3'>
              Session
            </h2>
            <div className='flex items-center gap-3 mb-4'>
              <span className='inline-flex items-center gap-1.5 text-sm font-semibold text-rd-good'>
                <span className='w-2 h-2 rounded-sm bg-rd-good' />
                Online
              </span>
              <span className='text-xs text-rd-muted'>Signed in as {name}</span>
            </div>
            <button
              type='button'
              onClick={handleLogout}
              className='w-full flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-semibold uppercase tracking-wider text-rd-critical bg-rd-critical-bg border border-rd-critical/20 hover:opacity-90 transition-opacity'
            >
              <RecGlyph name='logout' className='w-4 h-4' />
              Log out
            </button>
          </section>
        </div>
      </div>
    </PageWrap>
  )
}

export default Settings
