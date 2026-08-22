import React, { useContext } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { AdminContext } from '../context/AdminContext'
import { DoctorContext } from '../context/DoctorContext'
import { DeanContext } from '../context/DeanContext'
import { ReceptionContext } from '../context/ReceptionContext'
import { AppContext } from '../context/AppContext'
import { RecGlyph } from '../pages/Reception/icons'
import BrandLogo from './BrandLogo'

const RECEPTION_LINKS = [
  { to: '/reception-dashboard', label: 'Dashboard', match: ['/reception-dashboard'], icon: 'dashboard' },
  { to: '/reception-today', label: "Today's Ops", match: ['/reception-today', '/reception-checkin', '/reception-walkin', '/reception-queue', '/reception-noshows', '/reception-grace'], icon: 'clipboard' },
  { to: '/reception-patients', label: 'Patients', match: ['/reception-patients', '/reception-followups'], icon: 'patients' },
  { to: '/reception-online', label: 'Appointments', match: ['/reception-online'], icon: 'calendar' },
  { to: '/reception-lab', label: 'Lab Orders', match: ['/reception-lab'], icon: 'reports' },
  { to: '/reception-referrals', label: 'Referrals', match: ['/reception-referrals'], icon: 'clipboard' },
  { to: '/reception-pharmacy-queue', label: 'Pharmacy Queue', match: ['/reception-pharmacy-queue'], icon: 'reports' },
  { to: '/reception-followup-queue', label: 'Followup Queue', match: ['/reception-followup-queue'], icon: 'calendar' },
  { to: '/doctor-patient-journey', label: 'AI Patient Journey', match: ['/doctor-patient-journey'], icon: 'reports' },
  { to: '/reception-er-dispatch', label: 'ER Dispatch', match: ['/reception-er-dispatch'], icon: 'ambulance' },
  { to: '/reception-payments', label: 'Billing', match: ['/reception-payments', '/reception-refunds'], icon: 'billing' },
  { to: '/reception-reports', label: 'Reports', match: ['/reception-reports'], icon: 'reports' },
  { to: '/reception-settings', label: 'Settings', match: ['/reception-settings'], icon: 'settings' },
]

const Icon = ({ d, className = 'w-5 h-5 flex-shrink-0' }) => (
  <svg className={className} fill='none' stroke='currentColor' viewBox='0 0 24 24'>
    <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d={d} />
  </svg>
)

const DeskNav = ({ to, onClick, active, children }) => (
  <NavLink
    onClick={onClick}
    to={to}
    className={`rd-nav-item flex items-center gap-2.5 py-2.5 px-3 md:px-4 md:min-w-[220px] cursor-pointer ${active ? 'is-active' : ''}`}
  >
    {children}
  </NavLink>
)

const initialsOf = (name, fallback = 'U') =>
  (name || fallback)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('') || fallback

const Sidebar = () => {
  const { aToken } = useContext(AdminContext)
  const { dToken, profileData } = useContext(DoctorContext)
  const { deanToken, deanInfo } = useContext(DeanContext)
  const { recToken, recInfo, logout: recLogout } = useContext(ReceptionContext)
  const { sidebarOpen, setSidebarOpen } = useContext(AppContext)
  const location = useLocation()

  const closeSidebar = () => {
    if (window.innerWidth < 1024) setSidebarOpen(false)
  }

  const handleLogout = () => {
    if (aToken || deanToken || dToken) {
      sessionStorage.clear()
      window.location.reload()
    } else if (recToken) {
      recLogout()
      window.location.href = '/'
    }
    closeSidebar()
  }

  const isAuthenticated = aToken || dToken || deanToken || recToken
  const pathActive = (to) => location.pathname === to || location.pathname.startsWith(to + '/')

  const profile = aToken
    ? { name: 'Super Admin', role: 'Super Admin', initials: 'SA', avatar: '#0ea5e9' }
    : deanToken
      ? { name: deanInfo?.name || 'Dean', role: 'Hospital Dean', initials: initialsOf(deanInfo?.name, 'D'), avatar: '#14b8a6' }
      : dToken
        ? { name: profileData?.name || 'Doctor', role: 'Doctor', initials: initialsOf(profileData?.name, 'DR'), avatar: '#6366f1' }
        : { name: recInfo?.name || 'Receptionist', role: 'Receptionist', initials: initialsOf(recInfo?.name, 'R'), avatar: '#5B6CFF' }

  return (
    <div className={`
      fixed lg:static inset-y-0 left-0 z-30
      transition-transform duration-300 ease-out
      ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      w-[min(240px,88vw)] lg:w-auto
      rd-sidebar
      h-full self-stretch max-h-full shrink-0
      flex flex-col overflow-hidden
    `}>
      <div className='lg:hidden flex items-center justify-between px-4 py-3 shrink-0 border-b border-white/10'>
        <p className='text-sm font-bold text-rd-inverse'>Menu</p>
        <button
          type='button'
          onClick={() => setSidebarOpen(false)}
          className='p-2 hover:bg-white/10 text-rd-inverse'
          aria-label='Close menu'
        >
          <Icon d='M6 18L18 6M6 6l12 12' />
        </button>
      </div>

      <div className='flex lg:hidden items-center px-4 py-3 shrink-0 relative z-10 border-b border-white/10'>
        <BrandLogo size='sidebar' variant='sidebar' clickable={true} />
      </div>
      <div className='hidden lg:flex items-center px-4 pt-5 pb-3 shrink-0 relative z-10'>
        <BrandLogo size='sidebar' variant='sidebar' clickable={true} />
      </div>

      <div className='flex-1 overflow-y-auto overflow-x-hidden overscroll-contain pb-4 relative z-10'>
        {aToken && (
          <ul className='mt-2 space-y-0.5'>
            <DeskNav to='/admin-dashboard' onClick={closeSidebar} active={pathActive('/admin-dashboard')}>
              <Icon d='M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' /><p className='text-sm'>Dashboard</p>
            </DeskNav>
            <DeskNav to='/revenue-analytics' onClick={closeSidebar} active={pathActive('/revenue-analytics')}>
              <Icon d='M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' /><p className='text-sm'>Revenue Hub</p>
            </DeskNav>
            <DeskNav to='/all-appointments' onClick={closeSidebar} active={pathActive('/all-appointments')}>
              <Icon d='M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' /><p className='text-sm'>Appointments</p>
            </DeskNav>
            <DeskNav to='/doctor-list' onClick={closeSidebar} active={pathActive('/doctor-list')}>
              <Icon d='M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' /><p className='text-sm'>Doctors List</p>
            </DeskNav>
            <DeskNav to='/hospital-tieups' onClick={closeSidebar} active={pathActive('/hospital-tieups')}>
              <Icon d='M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' /><p className='text-sm'>Hospital Tie ups</p>
            </DeskNav>
            <div className='h-px bg-white/10 my-2 mx-4' />
            <DeskNav to='/manage-deans' onClick={closeSidebar} active={pathActive('/manage-deans')}>
              <Icon d='M12 14l9-5-9-5-9 5 9 5z' /><p className='text-sm'>Manage Deans</p>
            </DeskNav>
            <DeskNav to='/manage-receptionists' onClick={closeSidebar} active={pathActive('/manage-receptionists')}>
              <Icon d='M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11m16-11v11M8 14v3m4-3v3m4-3v3' /><p className='text-sm'>Receptionists</p>
            </DeskNav>
            <DeskNav to='/manage-admins' onClick={closeSidebar} active={pathActive('/manage-admins')}>
              <Icon d='M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' /><p className='text-sm'>System Admins</p>
            </DeskNav>
            <DeskNav to='/manage-users' onClick={closeSidebar} active={pathActive('/manage-users')}>
              <Icon d='M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 10-4-4 4 4 0 004 4z' /><p className='text-sm'>Users / Patients</p>
            </DeskNav>
            <div className='h-px bg-white/10 my-2 mx-4' />
            <DeskNav to='/manage-labs' onClick={closeSidebar} active={pathActive('/manage-labs')}>
              <Icon d='M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.22a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z' /><p className='text-sm'>Diagnostic Labs</p>
            </DeskNav>
            <DeskNav to='/manage-blood-banks' onClick={closeSidebar} active={pathActive('/manage-blood-banks')}>
              <Icon d='M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z' /><p className='text-sm'>Blood Banks</p>
            </DeskNav>
            <DeskNav to='/refund-management' onClick={closeSidebar} active={pathActive('/refund-management')}>
              <Icon d='M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z' /><p className='text-sm'>Refund Queue</p>
            </DeskNav>
            <DeskNav to='/partner-integrations' onClick={closeSidebar} active={pathActive('/partner-integrations')}>
              <Icon d='M13 10V3L4 14h7v7l9-11h-7z' /><p className='text-sm'>Enterprise Integrations</p>
            </DeskNav>
            <DeskNav to='/community-moderation' onClick={closeSidebar} active={pathActive('/community-moderation')}>
              <Icon d='M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z' /><p className='text-sm'>Community Moderation</p>
            </DeskNav>
            <DeskNav to='/system-settings' onClick={closeSidebar} active={pathActive('/system-settings')}>
              <Icon d='M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' /><p className='text-sm'>System Settings</p>
            </DeskNav>
            <DeskNav to='/home-banners' onClick={closeSidebar} active={pathActive('/home-banners')}>
              <Icon d='M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z' /><p className='text-sm'>Home Banners</p>
            </DeskNav>
            <DeskNav to='/slo-health' onClick={closeSidebar} active={pathActive('/slo-health')}>
              <Icon d='M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' /><p className='text-sm'>SLO & Health</p>
            </DeskNav>
          </ul>
        )}

        {deanToken && (
          <ul className='mt-2 space-y-0.5'>
            <DeskNav to='/dean-dashboard' onClick={closeSidebar} active={pathActive('/dean-dashboard')}>
              <Icon d='M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' /><p className='text-sm'>Dashboard</p>
            </DeskNav>
            <DeskNav to='/dean-appointments' onClick={closeSidebar} active={pathActive('/dean-appointments')}>
              <Icon d='M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' /><p className='text-sm'>Appointments</p>
            </DeskNav>
            <DeskNav to='/dean-doctors' onClick={closeSidebar} active={pathActive('/dean-doctors')}>
              <Icon d='M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' /><p className='text-sm'>Doctors List</p>
            </DeskNav>
            <DeskNav to='/dean-patients' onClick={closeSidebar} active={pathActive('/dean-patients')}>
              <Icon d='M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 10-4-4 4 4 0 004 4z' /><p className='text-sm'>Patients</p>
            </DeskNav>
            <div className='h-px bg-white/10 my-2 mx-4' />
            <DeskNav to='/dean-add-doctor' onClick={closeSidebar} active={pathActive('/dean-add-doctor')}>
              <Icon d='M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z' /><p className='text-sm'>Add Doctors</p>
            </DeskNav>
            <DeskNav to='/dean-hospital' onClick={closeSidebar} active={pathActive('/dean-hospital')}>
              <Icon d='M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' /><p className='text-sm'>Hospital Profile</p>
            </DeskNav>
            <DeskNav to='/dean-receptionists' onClick={closeSidebar} active={pathActive('/dean-receptionists')}>
              <Icon d='M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11m16-11v11M8 14v3m4-3v3m4-3v3' /><p className='text-sm'>Receptionists</p>
            </DeskNav>
            <DeskNav to='/dean-ambulances' onClick={closeSidebar} active={pathActive('/dean-ambulances')}>
              <Icon d='M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z' /><p className='text-sm'>Ambulance Fleet</p>
            </DeskNav>
            <DeskNav to='/dean-pharmacies' onClick={closeSidebar} active={pathActive('/dean-pharmacies')}>
              <Icon d='M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.22a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z' /><p className='text-sm'>Pharmacies</p>
            </DeskNav>
            <DeskNav to='/dean-community' onClick={closeSidebar} active={pathActive('/dean-community')}>
              <Icon d='M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z' /><p className='text-sm'>Community</p>
            </DeskNav>
            <DeskNav to='/dean-er-dispatch' onClick={closeSidebar} active={pathActive('/dean-er-dispatch')}>
              <Icon d='M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9' /><p className='text-sm'>ER Dispatch</p>
            </DeskNav>
          </ul>
        )}

        {recToken && (
          <ul className='mt-2 space-y-0.5'>
            {RECEPTION_LINKS.map((link) => {
              const active = (link.match || [link.to]).some(
                (m) => location.pathname === m || location.pathname.startsWith(m + '/')
              )
              return (
                <DeskNav key={link.to} to={link.to} onClick={closeSidebar} active={active}>
                  <RecGlyph name={link.icon} className='w-5 h-5 flex-shrink-0' />
                  <p className='text-sm'>{link.label}</p>
                </DeskNav>
              )
            })}
          </ul>
        )}

        {dToken && (
          <ul className='mt-2 space-y-0.5'>
            <DeskNav to='/doctor-dashboard' onClick={closeSidebar} active={pathActive('/doctor-dashboard')}>
              <Icon d='M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' /><p className='text-sm'>Dashboard</p>
            </DeskNav>
            <DeskNav to='/doctor-in-queue' onClick={closeSidebar} active={pathActive('/doctor-in-queue')}>
              <Icon d='M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' /><p className='text-sm'>Queue Manager</p>
            </DeskNav>
            <DeskNav to='/doctor-video-calls' onClick={closeSidebar} active={pathActive('/doctor-video-calls')}>
              <Icon d='M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z' /><p className='text-sm'>Video Call</p>
            </DeskNav>
            <DeskNav to='/doctor-patients' onClick={closeSidebar} active={pathActive('/doctor-patients')}>
              <Icon d='M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' /><p className='text-sm'>Patients</p>
            </DeskNav>
            <DeskNav to='/doctor-patient-journey' onClick={closeSidebar} active={pathActive('/doctor-patient-journey')}>
              <Icon d='M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' /><p className='text-sm'>AI Patient Journey</p>
            </DeskNav>
            <DeskNav to='/doctor-community' onClick={closeSidebar} active={pathActive('/doctor-community')}>
              <Icon d='M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z' /><p className='text-sm'>Health Community</p>
            </DeskNav>
            <DeskNav to='/doctor-profile' onClick={closeSidebar} active={pathActive('/doctor-profile')}>
              <Icon d='M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' /><p className='text-sm'>Profile</p>
            </DeskNav>
          </ul>
        )}
      </div>

      {isAuthenticated && (
        <div className='mt-auto shrink-0 relative z-10 px-3 pb-3 pt-2'>
          <div className='mb-3 rounded-2xl bg-black/25 border border-white/10 px-3 py-3 flex items-center gap-2.5'>
            <div
              className='w-10 h-10 rounded-full text-white flex items-center justify-center font-bold text-sm shrink-0'
              style={{ backgroundColor: profile.avatar }}
            >
              {profile.initials}
            </div>
            <div className='min-w-0'>
              <p className='text-sm font-semibold text-white truncate leading-tight'>{profile.name}</p>
              <p className='text-[11px] text-sky-200/90 font-medium mt-0.5'>{profile.role}</p>
              <p className='text-[11px] text-sky-200/80 font-medium flex items-center gap-1.5 mt-0.5'>
                <span className='w-1.5 h-1.5 rounded-full bg-emerald-400' /> Online
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className='flex items-center gap-2.5 w-full py-2.5 px-3 rounded-xl text-white hover:bg-white/10 transition-[background-color] duration-100 font-semibold text-sm'
          >
            <RecGlyph name='logout' className='w-5 h-5 flex-shrink-0' />
            <span>Log Out</span>
          </button>
        </div>
      )}
    </div>
  )
}

export default Sidebar
