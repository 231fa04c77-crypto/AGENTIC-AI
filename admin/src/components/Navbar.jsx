import React, { useContext, useState, useEffect } from 'react'
import { DoctorContext } from '../context/DoctorContext'
import { AdminContext } from '../context/AdminContext'
import { DeanContext } from '../context/DeanContext'
import { ReceptionContext } from '../context/ReceptionContext'
import { AppContext } from '../context/AppContext'
import BrandLogo from './BrandLogo'

const initialsOf = (name, fallback = 'U') =>
  (name || fallback)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('') || fallback

const Navbar = () => {
  const { dToken, profileData, getProfileData } = useContext(DoctorContext)
  const { aToken } = useContext(AdminContext)
  const { deanToken, deanInfo } = useContext(DeanContext)
  const { recToken, recInfo } = useContext(ReceptionContext)
  const { sidebarOpen, setSidebarOpen, darkMode, toggleDarkMode } = useContext(AppContext)
  const [currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (dToken && !profileData) getProfileData()
  }, [dToken, profileData, getProfileData])

  const displayName = aToken
    ? 'Super Admin'
    : recToken
      ? (recInfo?.name || 'Receptionist')
      : deanToken
        ? (deanInfo?.name || 'Dean')
        : (dToken && profileData?.name) || 'User'

  const roleLabel = aToken
    ? 'Super Admin'
    : recToken
      ? 'Receptionist'
      : deanToken
        ? 'Hospital Dean'
        : 'Doctor'

  const avatarBg = aToken ? '#0ea5e9' : deanToken ? '#14b8a6' : dToken ? '#6366f1' : '#2563EB'
  const initials = aToken
    ? 'SA'
    : initialsOf(displayName, roleLabel[0] || 'U')

  const dateLabel = currentTime.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  return (
    <div className='rd-topbar sticky top-0 z-20 flex justify-between items-center px-3 sm:px-5'>
      <div className='flex items-center gap-2 min-w-0'>
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className='lg:hidden p-1.5 rounded-lg text-[#0F2744] hover:bg-slate-100 dark:text-white dark:hover:bg-white/10 transition-[background-color] duration-100'
          aria-label='Toggle Menu'
        >
          <svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
            <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d={sidebarOpen ? 'M6 18L18 6M6 6l12 12' : 'M4 6h16M4 12h16M4 18h16'} />
          </svg>
        </button>
        <div className='lg:hidden'>
          <BrandLogo size='mobile' variant='sidebar' clickable={true} />
        </div>
      </div>

      <div className='flex items-center gap-2 sm:gap-3 min-w-0 justify-end'>
        <span className='hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#F4F7FB] border border-[#E8EEF5] text-xs font-semibold text-[#0F2744] dark:bg-white/5 dark:border-white/10 dark:text-white'>
          <svg className='w-3.5 h-3.5 text-[#2563EB]' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
            <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' />
          </svg>
          {dateLabel}
        </span>

        <button
          type='button'
          onClick={toggleDarkMode}
          className='p-1.5 rounded-lg border border-[#E8EEF5] bg-[#F4F7FB] hover:bg-slate-100 transition-[background-color] duration-100 shrink-0 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10'
          aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          title={darkMode ? 'Light mode' : 'Dark mode'}
        >
          {darkMode ? (
            <svg className='w-4 h-4 text-amber-300' fill='currentColor' viewBox='0 0 20 20'><path d='M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 01-1.414 1.414l-.707-.707a1 1 0 011.414-1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.413 0zm2.829 2.829a1 1 0 010 1.414l-.707.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 15.536l.707.707a1 1 0 01-1.414 1.414l-.707-.707a1 1 0 011.414-1.414zm-2.829-2.829a1 1 0 011.414 0l.707.707a1 1 0 11-1.414 1.414l-.707-.707a1 1 0 010-1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z'/></svg>
          ) : (
            <svg className='w-4 h-4 text-slate-600' fill='currentColor' viewBox='0 0 20 20'><path d='M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z'/></svg>
          )}
        </button>

        <div className='hidden md:flex items-center gap-2 pl-1 min-w-0'>
          <div
            className='w-8 h-8 rounded-full text-white flex items-center justify-center text-xs font-bold shrink-0'
            style={{ backgroundColor: avatarBg }}
          >
            {initials}
          </div>
          <div className='min-w-0 leading-tight'>
            <p className='text-xs font-bold text-[#0F2744] truncate dark:text-white'>{displayName}</p>
            <p className='text-[10px] font-medium text-slate-500 dark:text-white/60'>{roleLabel}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Navbar
