import axios from 'axios'
import React, { useContext, useEffect, useMemo, useState } from 'react'
import { saveAuthTokens } from '../services/authApi'
import { DoctorContext } from '../context/DoctorContext'
import { AdminContext } from '../context/AdminContext'
import { DeanContext } from '../context/DeanContext'
import { ReceptionContext } from '../context/ReceptionContext'
import { toast } from 'react-toastify'
import { useNavigate } from 'react-router-dom'
import BrandLogo from '../components/BrandLogo'

const ROLES = [
  {
    id: 'admin',
    label: 'Super Admin',
    short: 'Admin',
    accent: '#0ea5e9',
    accentSoft: 'bg-sky-50 border-sky-300 text-sky-700',
    btn: 'bg-sky-500 hover:bg-sky-600',
    endpoint: '/api/admin/login',
    dashboard: '/admin-dashboard',
    tokenKey: 'admin',
    placeholder: 'Enter your email address',
    showForgot: false,
    icon: (
      <svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
        <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' />
      </svg>
    ),
  },
  {
    id: 'dean',
    label: 'Hospital Admin',
    short: 'Hospital',
    accent: '#14b8a6',
    accentSoft: 'bg-teal-50 border-teal-300 text-teal-700',
    btn: 'bg-teal-500 hover:bg-teal-600',
    endpoint: '/api/dean/login',
    dashboard: '/dean-dashboard',
    tokenKey: 'dean',
    placeholder: 'Enter your email address',
    showForgot: false,
    icon: (
      <svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
        <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' />
      </svg>
    ),
  },
  {
    id: 'doctor',
    label: 'Doctor',
    short: 'Doctor',
    accent: '#8b5cf6',
    accentSoft: 'bg-violet-50 border-violet-300 text-violet-700',
    btn: 'bg-violet-500 hover:bg-violet-600',
    endpoint: '/api/doctor/login',
    dashboard: '/doctor-dashboard',
    tokenKey: 'doctor',
    placeholder: 'Enter your email address',
    showForgot: true,
    icon: (
      <svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
        <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' />
      </svg>
    ),
  },
  {
    id: 'receptionist',
    label: 'Receptionist',
    short: 'Front desk',
    accent: '#f97316',
    accentSoft: 'bg-orange-50 border-orange-300 text-orange-700',
    btn: 'bg-orange-500 hover:bg-orange-600',
    endpoint: '/api/reception/login',
    dashboard: '/reception-dashboard',
    tokenKey: 'receptionist',
    placeholder: 'Enter your email address',
    showForgot: false,
    icon: (
      <svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
        <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' />
      </svg>
    ),
  },
]

const FEATURES = [
  { title: 'Smart Dashboard', desc: 'Live KPIs across hospitals' },
  { title: 'Patient Management', desc: 'End-to-end visit lifecycle' },
  { title: 'Secure & Compliant', desc: 'Role-scoped access control' },
  { title: 'Revenue Cycle', desc: 'Collections & refunds in one place' },
  { title: 'Lab Integration', desc: 'Partner labs & diagnostics' },
]

const Login = () => {
  const [roleId, setRoleId] = useState('admin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [remember, setRemember] = useState(true)
  const [loading, setLoading] = useState(false)

  const backendUrl = import.meta.env.VITE_BACKEND_URL
  const { setDToken } = useContext(DoctorContext)
  const { setAToken } = useContext(AdminContext)
  const { setDeanToken, setDeanInfo } = useContext(DeanContext)
  const { setRecToken, setRecInfo } = useContext(ReceptionContext)
  const navigate = useNavigate()

  const role = useMemo(() => ROLES.find((r) => r.id === roleId) || ROLES[0], [roleId])

  useEffect(() => {
    document.body.classList.add('login-route-active')
    document.title = 'MedClues — Sign in'
    return () => document.body.classList.remove('login-route-active')
  }, [])

  useEffect(() => {
    setEmail('')
    setPassword('')
    setShowPwd(false)
  }, [roleId])

  const onSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const { data } = await axios.post(
        backendUrl + role.endpoint,
        { email, password },
        { withCredentials: true }
      )
      if (!data.success) {
        toast.error(data.message)
        return
      }

      if (role.tokenKey === 'admin') {
        setAToken(data.token)
        saveAuthTokens('admin', data.token)
        toast.success('Admin login successful!')
      } else if (role.tokenKey === 'dean') {
        setDeanToken(data.token)
        setDeanInfo(data.dean)
        saveAuthTokens('dean', data.token)
        sessionStorage.setItem('deanInfo', JSON.stringify(data.dean))
        toast.success('Hospital admin login successful!')
      } else if (role.tokenKey === 'receptionist') {
        setRecToken(data.token)
        setRecInfo(data.reception)
        saveAuthTokens('receptionist', data.token)
        sessionStorage.setItem('recInfo', JSON.stringify(data.reception))
        toast.success('Reception login successful!')
      } else {
        setDToken(data.token)
        saveAuthTokens('doctor', data.token)
        toast.success('Doctor login successful!')
      }
      navigate(role.dashboard)
    } catch (err) {
      if (!err.response) {
        toast.error('Cannot reach backend. Check VITE_BACKEND_URL and that the API is running.')
      } else {
        toast.error(err.response?.data?.message || 'Login failed')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className='min-h-[100dvh] w-full bg-[#f4f7fb] text-slate-800 font-sans'>
      <div className='min-h-[100dvh] grid lg:grid-cols-2'>
        {/* Brand panel */}
        <aside className='relative hidden lg:flex flex-col justify-between p-8 xl:p-12 overflow-hidden bg-gradient-to-br from-slate-50 via-white to-sky-50'>
          <div
            className='pointer-events-none absolute -right-24 top-10 w-[420px] h-[420px] rounded-full opacity-40 blur-3xl'
            style={{ background: 'radial-gradient(circle, #7dd3fc 0%, transparent 70%)' }}
          />
          <div
            className='pointer-events-none absolute -left-16 bottom-0 w-[360px] h-[360px] rounded-full opacity-30 blur-3xl'
            style={{ background: 'radial-gradient(circle, #99f6e4 0%, transparent 70%)' }}
          />

          <div className='relative z-10'>
            <BrandLogo size='large' clickable={false} variant='header' />
            <h1 className='mt-8 text-3xl xl:text-4xl font-bold tracking-tight text-slate-900 leading-tight max-w-md'>
              Smarter Healthcare.
              <br />
              <span className='text-sky-600'>Better Outcomes.</span>
            </h1>
            <p className='mt-3 text-sm text-slate-500 max-w-sm'>
              AI-powered hospital operating system for admins, clinicians, and front desk teams.
            </p>

            <ul className='mt-8 grid grid-cols-2 gap-x-4 gap-y-3 max-w-md'>
              {FEATURES.map((f) => (
                <li key={f.title} className='flex items-start gap-2.5'>
                  <span className='mt-0.5 w-6 h-6 rounded-lg bg-sky-100 text-sky-600 flex items-center justify-center shrink-0'>
                    <svg className='w-3.5 h-3.5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                      <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2.5} d='M5 13l4 4L19 7' />
                    </svg>
                  </span>
                  <div className='min-w-0'>
                    <p className='text-sm font-semibold text-slate-800'>{f.title}</p>
                    <p className='text-xs text-slate-500'>{f.desc}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className='relative z-10 mt-10'>
            <div className='grid grid-cols-3 gap-3 max-w-lg'>
              {[
                { label: "Today's Appts", value: '248', tone: 'from-sky-500 to-blue-600' },
                { label: 'Patients / mo', value: '1,642', tone: 'from-teal-500 to-emerald-600' },
                { label: 'Revenue today', value: '₹1.2L', tone: 'from-violet-500 to-indigo-600' },
              ].map((c) => (
                <div
                  key={c.label}
                  className='rounded-2xl bg-white/80 border border-white shadow-sm p-3 backdrop-blur-sm'
                >
                  <div className={`h-1.5 w-10 rounded-full bg-gradient-to-r ${c.tone} mb-2`} />
                  <p className='text-lg font-bold tabular-nums text-slate-900'>{c.value}</p>
                  <p className='text-[10px] font-medium text-slate-500'>{c.label}</p>
                </div>
              ))}
            </div>

            <div className='mt-6 w-full max-w-xl rounded-2xl bg-white/90 border border-sky-100/80 shadow-[0_8px_24px_rgba(14,165,233,0.08)] backdrop-blur-sm px-3 py-3'>
              <div className='grid grid-cols-4 divide-x divide-slate-100'>
                {[
                  {
                    value: '150+',
                    label: 'Hospitals',
                    iconBg: 'bg-sky-50 text-sky-600',
                    icon: (
                      <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                        <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' />
                      </svg>
                    ),
                  },
                  {
                    value: '10,000+',
                    label: 'Patients Daily',
                    iconBg: 'bg-blue-50 text-blue-600',
                    icon: (
                      <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                        <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' />
                      </svg>
                    ),
                  },
                  {
                    value: '99.9%',
                    label: 'Uptime',
                    iconBg: 'bg-emerald-50 text-emerald-600',
                    icon: (
                      <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                        <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' />
                      </svg>
                    ),
                  },
                  {
                    value: '24/7',
                    label: 'Support',
                    iconBg: 'bg-indigo-50 text-indigo-600',
                    icon: (
                      <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                        <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9' />
                      </svg>
                    ),
                  },
                ].map((s) => (
                  <div key={s.label} className='flex items-center gap-2 px-2.5 min-w-0'>
                    <span className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${s.iconBg}`}>
                      {s.icon}
                    </span>
                    <div className='min-w-0'>
                      <p className='text-sm font-bold text-slate-800 tabular-nums leading-tight'>{s.value}</p>
                      <p className='text-[10px] font-medium text-slate-500 truncate'>{s.label}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </aside>

        {/* Auth panel */}
        <main className='relative flex flex-col items-center justify-center px-4 py-8 sm:px-8 lg:px-12'>
          <div className='w-full max-w-[420px]'>
            <div className='lg:hidden mb-6 flex justify-center'>
              <BrandLogo size='medium' clickable={false} />
            </div>

            <div className='bg-white rounded-[22px] border border-slate-200/80 shadow-[0_12px_40px_rgba(15,39,68,0.08)] p-5 sm:p-7'>
              <div className='mb-5'>
                <h2 className='text-xl sm:text-2xl font-bold text-slate-900 tracking-tight'>
                  Welcome back
                </h2>
                <p className='text-sm text-slate-500 mt-1'>Sign in to continue to MedClues.</p>
              </div>

              <p className='text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2'>
                Select your role
              </p>
              <div className='grid grid-cols-2 gap-2 mb-5'>
                {ROLES.map((r) => {
                  const active = roleId === r.id
                  return (
                    <button
                      key={r.id}
                      type='button'
                      onClick={() => setRoleId(r.id)}
                      className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-all ${
                        active
                          ? `${r.accentSoft} shadow-sm ring-1 ring-offset-0`
                          : 'bg-slate-50/80 border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}
                      style={active ? { boxShadow: `0 0 0 1px ${r.accent}33` } : undefined}
                    >
                      <span
                        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                          active ? 'bg-white shadow-sm' : 'bg-white/70'
                        }`}
                        style={{ color: r.accent }}
                      >
                        {r.icon}
                      </span>
                      <span className='min-w-0'>
                        <span className='block text-xs font-bold truncate'>{r.label}</span>
                        <span className='block text-[10px] opacity-70 truncate'>{r.short}</span>
                      </span>
                    </button>
                  )
                })}
              </div>

              <form onSubmit={onSubmit} className='space-y-3.5'>
                <div>
                  <label className='block text-xs font-semibold text-slate-600 mb-1.5'>Email</label>
                  <div className='relative'>
                    <span className='absolute left-3 top-1/2 -translate-y-1/2 text-slate-400'>
                      <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                        <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' />
                      </svg>
                    </span>
                    <input
                      type='email'
                      required
                      autoComplete='username'
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={role.placeholder}
                      className='w-full pl-10 pr-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-sky-400 outline-none text-sm font-medium transition-colors'
                    />
                  </div>
                </div>

                <div>
                  <div className='flex items-center justify-between mb-1.5'>
                    <label className='block text-xs font-semibold text-slate-600'>Password</label>
                    {role.showForgot && (
                      <button
                        type='button'
                        onClick={() => navigate('/doctor-forgot-password')}
                        className='text-[11px] font-semibold text-sky-600 hover:text-sky-700'
                      >
                        Forgot Password?
                      </button>
                    )}
                  </div>
                  <div className='relative'>
                    <span className='absolute left-3 top-1/2 -translate-y-1/2 text-slate-400'>
                      <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                        <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z' />
                      </svg>
                    </span>
                    <input
                      type={showPwd ? 'text' : 'password'}
                      required
                      autoComplete='current-password'
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder='Enter your password'
                      className='w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-sky-400 outline-none text-sm font-medium transition-colors'
                    />
                    <button
                      type='button'
                      onClick={() => setShowPwd((v) => !v)}
                      className='absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600'
                      aria-label={showPwd ? 'Hide password' : 'Show password'}
                    >
                      {showPwd ? (
                        <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                          <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.29 3.29m13.42 13.42l-3.29-3.29M3 3l18 18' />
                        </svg>
                      ) : (
                        <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                          <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M15 12a3 3 0 11-6 0 3 3 0 016 0z' />
                          <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z' />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                <label className='flex items-center gap-2 text-xs text-slate-600 select-none'>
                  <input
                    type='checkbox'
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className='rounded border-slate-300 text-sky-600 focus:ring-sky-500'
                  />
                  Remember me
                </label>

                <button
                  type='submit'
                  disabled={loading}
                  className={`w-full py-2.5 rounded-xl text-white text-sm font-bold shadow-md disabled:opacity-60 transition-colors flex items-center justify-center gap-2 ${role.btn}`}
                >
                  {loading ? (
                    <span className='w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin' />
                  ) : (
                    <>
                      Sign In
                      <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                        <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M14 5l7 7m0 0l-7 7m7-7H3' />
                      </svg>
                    </>
                  )}
                </button>
              </form>

              <p className='mt-5 text-center text-[11px] text-slate-400'>
                New to MedClues? Contact your system administrator.
              </p>
            </div>

            <p className='mt-6 text-center text-[10px] text-slate-400'>
              © {new Date().getFullYear()} MedClues Healthcare Systems. All rights reserved.
            </p>
          </div>
        </main>
      </div>
    </div>
  )
}

export default Login
