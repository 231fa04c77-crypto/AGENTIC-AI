import React, { useContext, useState, useRef, useEffect } from 'react'
import { assets } from '../assets/assets'
import { NavLink, useNavigate } from 'react-router-dom'
import { AppContext } from '../context/AppContext'
import BrandLogo from './BrandLogo'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "./ui/dropdown-menu"
import { useLocation } from 'react-router-dom'

const Navbar = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const [showMenu, setShowMenu] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const { token, setToken, userData } = useContext(AppContext)
  const dropdownRef = useRef(null)
  const menuRef = useRef(null)

  const isAboutActive = location.pathname === '/about' || location.pathname === '/contact'

  const logout = () => {
    localStorage.removeItem('token')
    setToken(false)
    setShowDropdown(false)
    navigate('/login?mode=login')
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (showMenu) {
      document.body.classList.add('menu-open')
    } else {
      document.body.classList.remove('menu-open')
    }
    return () => {
      document.body.classList.remove('menu-open')
    }
  }, [showMenu])

  return (
    <nav className='fixed top-0 left-0 right-0 bg-white/95 backdrop-blur-md shadow-sm border-b border-gray-200 w-full z-[200]'>
      <div className='w-full px-4 sm:px-6 lg:px-8 xl:px-12'>
        <div className='flex items-center justify-between py-2 lg:py-2.5'>

          {/* Mobile Navigation Layout - Balanced 3-Column Grid */}
          <div className='flex lg:hidden items-center justify-between w-full h-14 relative'>
            {/* Left: Hamburger Button (fixed width to match right side proportions) */}
            <div className='w-1/4 flex items-center justify-start'>
              <button
                onClick={() => setShowMenu(!showMenu)}
                className='p-2 -ml-2 rounded-xl hover:bg-gray-100 transition-all duration-300 focus:outline-none active:scale-95'
                aria-label="Menu"
                aria-expanded={showMenu}
              >
                {showMenu ? (
                  <svg className="w-6 h-6 text-gray-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6 text-gray-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 7h16M4 12h16M4 17h16" />
                  </svg>
                )}
              </button>
            </div>

            {/* Center: Centered Logo */}
            <div className='flex-1 flex items-center justify-center'>
              <div className="scale-110">
                <BrandLogo
                  size="mobile"
                  variant="header"
                  clickable={true}
                />
              </div>
            </div>

            {/* Right: Emergency Button (fixed width to balance left side) */}
            <div className='w-1/4 flex items-center justify-end'>
              <NavLink
                to='/emergency'
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded-full font-bold text-[10px] sm:text-xs transition-all duration-300 flex items-center gap-1.5 border shadow-sm ${isActive
                    ? 'text-red-700 bg-red-100 border-red-200'
                    : 'text-red-600 bg-red-50 border-red-100 active:scale-95 hover:bg-red-100'
                  }`
                }
              >
                <span className="text-sm animate-pulse-emergency">🚨</span>
                <span className="hidden min-[360px]:inline">EMERGENCY</span>
              </NavLink>
            </div>
          </div>

          {/* Desktop Logo */}
          <div className='hidden lg:flex items-center flex-shrink-0' style={{ paddingLeft: '8px' }}>
            <BrandLogo
              size="mobile"
              variant="header"
              clickable={true}
            />
          </div>

          {/* Desktop Navigation */}
          <ul className='hidden lg:flex items-center gap-1'>
            <li>
              <NavLink
                to='/hospitals'
                className={({ isActive }) =>
                  `nav-link group px-4 py-1.5 rounded-lg font-semibold text-sm transition-all duration-300 relative inline-block ${isActive
                    ? 'text-purple-600 bg-purple-50 active'
                    : 'text-gray-700 hover:text-purple-600 hover:bg-purple-50'
                  }`
                }
              >
                HOSPITALS
                <span className='nav-link-line absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-purple-500 to-indigo-500 transform origin-left transition-transform duration-300 scale-x-0 group-hover:scale-x-100'></span>
              </NavLink>
            </li>
            <li>
              <NavLink
                to='/all-doctors'
                className={({ isActive }) =>
                  `nav-link group px-4 py-1.5 rounded-lg font-semibold text-sm transition-all duration-300 relative inline-block ${isActive
                    ? 'text-cyan-600 bg-cyan-50 active'
                    : 'text-gray-700 hover:text-cyan-600 hover:bg-gray-50'
                  }`}
              >
                DOCTORS
                <span className='nav-link-line absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-cyan-500 to-blue-500 transform origin-left transition-transform duration-300 scale-x-0 group-hover:scale-x-100'></span>
              </NavLink>
            </li>
            <li>
              <NavLink
                to='/labs'
                className={({ isActive }) =>
                  `nav-link group px-4 py-1.5 rounded-lg font-semibold text-sm transition-all duration-300 relative inline-block ${isActive
                    ? 'text-cyan-600 bg-cyan-50 active'
                    : 'text-gray-700 hover:text-cyan-600 hover:bg-gray-50'
                  }`
                }
              >
                LABS
                <span className='nav-link-line absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-cyan-500 to-blue-500 transform origin-left transition-transform duration-300 scale-x-0 group-hover:scale-x-100'></span>
              </NavLink>
            </li>
            <li>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className={`nav-link group px-4 py-1.5 rounded-lg font-semibold text-sm transition-all duration-300 relative inline-flex items-center gap-1 ${isAboutActive
                      ? 'text-cyan-600 bg-cyan-50 active'
                      : 'text-gray-700 hover:text-cyan-600 hover:bg-gray-50'
                      }`}
                  >
                    ABOUT
                    <svg className="w-3.5 h-3.5 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                    <span className='nav-link-line absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-cyan-500 to-blue-500 transform origin-left transition-transform duration-300 scale-x-0 group-hover:scale-x-100'></span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="bg-white rounded-md shadow-lg border border-gray-100 py-1 min-w-[150px] z-[99999]" align="end">
                  <DropdownMenuItem
                    className="px-4 py-2 text-sm text-gray-700 hover:bg-cyan-50 hover:text-cyan-600 cursor-pointer transition-colors"
                    onClick={() => navigate('/about')}
                  >
                    About Us
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="px-4 py-2 text-sm text-gray-700 hover:bg-cyan-50 hover:text-cyan-600 cursor-pointer transition-colors"
                    onClick={() => navigate('/contact')}
                  >
                    Contact Us
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </li>

            <li>
              <NavLink
                to='/emergency'
                className={({ isActive }) =>
                  `nav-link group px-4 py-1.5 rounded-lg font-bold text-sm transition-all duration-300 relative inline-block ${isActive
                    ? 'text-red-600 bg-red-50 active'
                    : 'text-red-600 hover:text-red-700 hover:bg-red-50'
                  }`
                }
              >
                🚨 EMERGENCY
                <span className='nav-link-line absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-red-500 to-red-600 transform origin-left transition-transform duration-300 scale-x-0 group-hover:scale-x-100'></span>
              </NavLink>
            </li>
          </ul>

          {/* Right Side Actions - Hidden on mobile (shown in hamburger menu) */}
          <div className='hidden lg:flex items-center gap-2 sm:gap-3'>
            {token && userData ? (
              /* Profile Section with Dropdown */
              <div className='relative' ref={dropdownRef} style={{ zIndex: 9999999999 }}>
                {/* Profile Avatar - Clickable to toggle dropdown */}
                <button
                  onClick={() => setShowDropdown(!showDropdown)}
                  className='flex items-center gap-2 cursor-pointer group focus:outline-none'
                  title="Profile Menu"
                  aria-label="Profile Menu"
                >
                  <div className='relative'>
                    <img
                      className='w-8 h-8 sm:w-9 sm:h-9 rounded-full ring-2 ring-cyan-400/30 group-hover:ring-cyan-400/60 transition-all duration-300 object-cover'
                      src={userData.image}
                      alt="Profile"
                    />
                    {/* Online Status */}
                    <div className='absolute -bottom-0.5 -right-0.5 bg-green-500 border-2 border-white rounded-full w-3 h-3 shadow-md'>
                      <div className='w-full h-full bg-green-400 rounded-full animate-pulse'></div>
                    </div>
                  </div>
                </button>

                {/* Dropdown Menu */}
                {showDropdown && (
                  <div
                    className='absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-2xl border border-gray-100 py-2 animate-fadeIn'
                    style={{ zIndex: 9999999999 }}
                  >
                    {/* User Info */}
                    <div className='px-4 py-3 border-b border-gray-100'>
                      <p className='font-semibold text-gray-900 truncate'>{userData.name}</p>
                      <p className='text-xs text-gray-500 truncate'>{userData.email}</p>
                    </div>

                    {/* Menu Items */}
                    <div className='py-1'>
                      <button
                        onClick={() => { navigate('/my-profile'); setShowDropdown(false); }}
                        className='w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3 transition-colors'
                      >
                        <svg className='w-4 h-4 text-gray-500' fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        My Profile
                      </button>
                      <button
                        onClick={() => {
                          if (location.pathname === '/my-appointments') {
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                            navigate('/my-appointments?reset=true', { replace: true });
                          } else {
                            navigate('/my-appointments');
                          }
                          setShowDropdown(false);
                        }}
                        className='w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3 transition-colors'
                      >
                        <svg className='w-4 h-4 text-gray-500' fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        My Appointments
                      </button>
                      <button
                        onClick={() => { navigate('/my-care-journey'); setShowDropdown(false); }}
                        className='w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3 transition-colors'
                      >
                        <svg className='w-4 h-4 text-gray-500' fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        My Care Journey
                      </button>
                      <button
                        onClick={() => { navigate('/my-labs'); setShowDropdown(false); }}
                        className='w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3 transition-colors'
                      >
                        <svg className='w-4 h-4 text-gray-500' fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                        </svg>
                        My Labs
                      </button>
                      <button
                        onClick={() => { navigate('/all-doctors'); setShowDropdown(false); }}
                        className='w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3 transition-colors'
                      >
                        <svg className='w-4 h-4 text-gray-500' fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        Find Doctors
                      </button>
                      <button
                        onClick={() => { navigate('/data-security'); setShowDropdown(false); }}
                        className='w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3 transition-colors'
                      >
                        <svg className='w-4 h-4 text-gray-500' fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                        Security
                      </button>
                    </div>

                    {/* Logout */}
                    <div className='border-t border-gray-100 pt-1 mt-1'>
                      <button
                        onClick={logout}
                        className='w-full px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-3 transition-colors'
                      >
                        <svg className='w-4 h-4' fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        Logout
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className='flex items-center gap-1 lg:gap-2'>
                {/* Login Button - Visible on mobile */}
                <button
                  onClick={() => navigate('/login?mode=login')}
                  className='flex items-center gap-1 bg-cyan-500 text-white px-2 py-1.5 lg:px-4 lg:py-2 rounded-full font-semibold text-xs lg:text-sm hover:bg-cyan-600 hover:shadow-lg transition-all duration-300'
                >
                  <span>Login</span>
                  <svg className="w-3 h-3 lg:w-4 lg:h-4 hidden sm:block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                  </svg>
                </button>
                {/* Create Account Button - Visible on mobile */}
                <button
                  onClick={() => navigate('/login?mode=signup')}
                  className='flex items-center gap-1 bg-gradient-to-r from-blue-500 to-indigo-500 text-white px-2 py-1.5 lg:px-4 lg:py-2 rounded-full font-semibold text-xs lg:text-sm hover:shadow-lg hover:scale-105 transition-all duration-300'
                >
                  <span className='hidden sm:inline'>Create account</span>
                  <span className='sm:hidden'>Signup</span>
                  <svg className="w-3 h-3 lg:w-4 lg:h-4 hidden sm:block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Menu - No Overlay */}
      {showMenu && (
        <div
          ref={menuRef}
          className='fixed top-0 left-0 h-full w-[280px] sm:w-80 bg-white shadow-2xl z-[10001] lg:hidden mobile-menu-panel'
          onClick={(e) => {
            e.stopPropagation()
          }}
          onTouchStart={(e) => {
            e.stopPropagation()
          }}
        >
          {/* Header */}
          <div className='flex items-center justify-between px-4 sm:px-6 py-4 sm:py-6 border-b border-gray-200 bg-white'>
            <div className='flex items-center'>
              <BrandLogo size="mobile" variant="header" clickable={true} />
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation()
                setShowMenu(false)
              }}
              className='p-2 rounded-lg hover:bg-gray-100 transition-colors'
              aria-label="Close"
            >
              <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Scrollable Content with Strong Background */}
          <div className='h-[calc(100vh-80px)] overflow-y-auto px-4 sm:px-6 py-4 sm:py-6 pb-20 bg-white'>
            {token && userData && (
              <div className='mb-6 pb-6 border-b border-gray-200'>
                <div className='flex items-center gap-3 mb-2'>
                  <div className='relative'>
                    <img className='w-11 h-11 sm:w-12 sm:h-12 rounded-full ring-2 ring-cyan-400/30 object-cover' src={userData.image} alt="" />
                    <div className='absolute bottom-0 right-0'>
                      <div className='bg-green-500 border-2 border-white rounded-full w-3 h-3 shadow-sm'>
                        <div className='w-full h-full bg-green-400 rounded-full animate-pulse'></div>
                      </div>
                    </div>
                  </div>
                  <div className='flex-1 min-w-0'>
                    <p className='font-semibold text-gray-900 truncate'>{userData.name}</p>
                    <div className='flex items-center gap-2 mt-0.5'>
                      <div className='w-2 h-2 bg-green-500 rounded-full'></div>
                      <p className='text-xs text-gray-500 font-medium'>Online</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <ul className='flex flex-col gap-1 sm:gap-2 mb-4'>
              <li>
                <NavLink
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    navigate('/hospitals')
                    setTimeout(() => setShowMenu(false), 150)
                  }}
                  to='/hospitals'
                  className={({ isActive }) =>
                    `block px-4 py-2.5 sm:py-3 rounded-lg font-bold text-sm sm:text-base transition-all duration-200 bg-white ${isActive
                      ? 'text-purple-600 bg-purple-50'
                      : 'text-gray-900 hover:text-purple-600 hover:bg-purple-50'
                    }`
                  }
                >
                  HOSPITALS
                </NavLink>
              </li>
              <li>
                <NavLink
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    navigate('/labs')
                    setTimeout(() => setShowMenu(false), 150)
                  }}
                  to='/labs'
                  className={({ isActive }) =>
                    `block px-4 py-2.5 sm:py-3 rounded-lg font-bold text-sm sm:text-base transition-all duration-200 bg-white ${isActive
                      ? 'text-cyan-600 bg-cyan-50'
                      : 'text-gray-900 hover:text-cyan-600 hover:bg-gray-50'
                    }`
                  }
                >
                  LABS
                </NavLink>
              </li>
              <li>
                <NavLink
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    navigate('/all-doctors')
                    setTimeout(() => setShowMenu(false), 150)
                  }}
                  to='/all-doctors'
                  className={({ isActive }) =>
                    `block px-4 py-2.5 sm:py-3 rounded-lg font-bold text-sm sm:text-base transition-all duration-200 bg-white ${isActive
                      ? 'text-cyan-600 bg-cyan-50'
                      : 'text-gray-900 hover:text-cyan-600 hover:bg-gray-50'
                    }`}
                >
                  DOCTORS
                </NavLink>
              </li>
              <li>
                <div className="px-4 py-2.5 sm:py-3 rounded-lg font-bold text-sm sm:text-base text-gray-900 bg-gray-50/50 mb-1">
                  ABOUT
                </div>
                <div className="ml-4 space-y-1 mb-2">
                  <NavLink
                    onClick={() => { navigate('/about'); setShowMenu(false); }}
                    to='/about'
                    className={({ isActive }) =>
                      `block px-4 py-2 rounded-lg font-semibold text-xs sm:text-sm transition-all duration-200 ${isActive ? 'text-cyan-600 bg-cyan-50' : 'text-gray-600 hover:text-cyan-600 hover:bg-gray-50'}`
                    }
                  >About Us</NavLink>
                  <NavLink
                    onClick={() => { navigate('/contact'); setShowMenu(false); }}
                    to='/contact'
                    className={({ isActive }) =>
                      `block px-4 py-2 rounded-lg font-semibold text-xs sm:text-sm transition-all duration-200 ${isActive ? 'text-cyan-600 bg-cyan-50' : 'text-gray-600 hover:text-cyan-600 hover:bg-gray-50'}`
                    }
                  >Contact Us</NavLink>
                </div>
              </li>

              <li>
                <NavLink
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    navigate('/emergency')
                    setTimeout(() => setShowMenu(false), 150)
                  }}
                  to='/emergency'
                  className={({ isActive }) =>
                    `block px-4 py-2.5 sm:py-3 rounded-lg font-bold text-sm sm:text-base transition-all duration-200 bg-white ${isActive
                      ? 'text-red-600 bg-red-50'
                      : 'text-red-600 hover:text-red-700 hover:bg-red-50'
                    }`
                  }
                >
                  🚨 EMERGENCY
                </NavLink>
              </li>
            </ul>

            {token && userData ? (
              <div className='mt-6 pt-6 border-t border-gray-200 space-y-1 sm:space-y-2 bg-white'>
                <button
                  onClick={() => { navigate('/my-profile'); setShowMenu(false); }}
                  className='w-full px-4 py-2.5 sm:py-3 rounded-lg text-left font-bold text-sm sm:text-base text-gray-900 bg-white hover:bg-gray-50 transition-colors flex items-center gap-3'
                >
                  <svg className='w-5 h-5 text-gray-700 flex-shrink-0' fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  My Profile
                </button>
                <button
                  onClick={() => {
                    if (location.pathname === '/my-appointments') {
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                      navigate('/my-appointments?reset=true', { replace: true });
                    } else {
                      navigate('/my-appointments');
                    }
                    setShowMenu(false);
                  }}
                  className='w-full px-4 py-2.5 sm:py-3 rounded-lg text-left font-bold text-sm sm:text-base text-gray-900 bg-white hover:bg-gray-50 transition-colors flex items-center gap-3'
                >
                  <svg className='w-5 h-5 text-gray-700 flex-shrink-0' fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  My Appointments
                </button>
                <button
                  onClick={() => { navigate('/my-care-journey'); setShowMenu(false); }}
                  className='w-full px-4 py-2.5 sm:py-3 rounded-lg text-left font-bold text-sm sm:text-base text-gray-900 bg-white hover:bg-gray-50 transition-colors flex items-center gap-3'
                >
                  <svg className='w-5 h-5 text-gray-700 flex-shrink-0' fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  My Care Journey
                </button>
                <button
                  onClick={() => { navigate('/my-labs'); setShowMenu(false); }}
                  className='w-full px-4 py-2.5 sm:py-3 rounded-lg text-left font-bold text-sm sm:text-base text-gray-900 bg-white hover:bg-gray-50 transition-colors flex items-center gap-3'
                >
                  <svg className='w-5 h-5 text-gray-700 flex-shrink-0' fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                  My Labs
                </button>
                <button
                  onClick={() => { navigate('/all-doctors'); setShowMenu(false); }}
                  className='w-full px-4 py-2.5 sm:py-3 rounded-lg text-left font-bold text-sm sm:text-base text-gray-900 bg-white hover:bg-gray-50 transition-colors flex items-center gap-3'
                >
                  <svg className='w-5 h-5 text-gray-700 flex-shrink-0' fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  Find Doctors
                </button>
                <button
                  onClick={() => { navigate('/data-security'); setShowMenu(false); }}
                  className='w-full px-4 py-2.5 sm:py-3 rounded-lg text-left font-bold text-sm sm:text-base text-gray-900 bg-white hover:bg-gray-50 transition-colors flex items-center gap-3'
                >
                  <svg className='w-5 h-5 text-gray-700 flex-shrink-0' fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  Security
                </button>
                <button
                  onClick={() => { logout(); setShowMenu(false); }}
                  className='w-full px-4 py-2.5 sm:py-3 rounded-lg text-left font-bold text-sm sm:text-base bg-white hover:bg-red-50 transition-colors flex items-center gap-3'
                  style={{ color: '#dc2626', fill: '#dc2626' }}
                >
                  <svg className='w-5 h-5 flex-shrink-0' fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#dc2626' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} stroke="#dc2626" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  <span style={{ color: '#dc2626' }}>Logout</span>
                </button>
              </div>
            ) : (
              <div className='mt-6 space-y-3'>
                <button
                  onClick={() => { navigate('/login?mode=login'); setShowMenu(false); }}
                  className='w-full flex items-center justify-center gap-2 bg-cyan-500 text-white px-6 py-3 rounded-full font-semibold hover:bg-cyan-600 transition-all duration-300 text-sm sm:text-base'
                >
                  Login
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                  </svg>
                </button>
                <button
                  onClick={() => { navigate('/login?mode=signup'); setShowMenu(false); }}
                  className='w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white px-6 py-3 rounded-full font-semibold hover:shadow-lg transition-all duration-300 text-sm sm:text-base'
                >
                  Create account
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Animation Styles + Mobile Navbar Overrides */}
      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }
        
        /* Mobile Menu Slide Animation - From Left */
        @keyframes slideInFromLeft {
          from {
            transform: translateX(-100%);
          }
          to {
            transform: translateX(0);
          }
        }
        
        .mobile-menu-panel {
          animation: slideInFromLeft 0.3s ease-out forwards;
          will-change: transform;
          background: white !important;
        }
        
        .mobile-menu-panel * {
          color: inherit;
        }
        
        @media (max-width: 1024px) {
          .mobile-menu-panel {
            display: block !important;
          }
        }
        
        .mobile-menu-panel > div:last-child {
          -webkit-overflow-scrolling: touch;
          scrollbar-width: thin;
          scrollbar-color: #cbd5e1 #f1f5f9;
        }
        
        .mobile-menu-panel > div:last-child::-webkit-scrollbar {
          width: 6px;
        }
        
        .mobile-menu-panel > div:last-child::-webkit-scrollbar-track {
          background: #f1f5f9;
        }
        
        .mobile-menu-panel > div:last-child::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 3px;
        }
        
        .mobile-menu-panel > div:last-child::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
        
        /* Mobile Profile Dropdown - Ensure visibility */
        @media (max-width: 768px) {
          /* Make dropdown full width on mobile for better visibility */
          nav .animate-fadeIn {
            position: fixed !important;
            top: 60px !important;
            right: 0.5rem !important;
            left: 0.5rem !important;
            width: auto !important;
            max-width: 320px !important;
            margin: 0 auto !important;
          }
        }
        
        /* Prevent body scroll when mobile menu is open */
        body.menu-open {
          overflow: hidden;
        }
      `}</style>
    </nav>
  )
}

export default Navbar
