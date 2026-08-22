import React, { useState, useContext } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppContext } from '../context/AppContext'

const Footer = () => {
  const { userData } = useContext(AppContext)
  const navigate = useNavigate()
  const [email, setEmail] = useState('')

  // Handle navigation with scroll to top
  const handleNavClick = (path) => {
    navigate(path)
    window.scrollTo(0, 0)
  }

  // Handle newsletter submission
  const handleSubmit = (e) => {
    e.preventDefault()
    if (email) {
      alert('Thank you for subscribing!')
      setEmail('')
    }
  }

  return (
    <footer className='text-gray-800 w-full relative'>
      {/* Top Section with Hexagons */}
      <div className='relative bg-transparent pt-4 pb-16 px-4'>
        {/* Large Hexagon Pattern - Left Side */}
        <div className='absolute left-8 sm:left-16 lg:left-24 top-12 opacity-15'>
          <svg width="350" height="350" viewBox="0 0 350 350" className="text-blue-300">
            <polygon points="50,25 85,5 120,25 120,65 85,85 50,65" fill="none" stroke="currentColor" strokeWidth="4" />
            <polygon points="120,25 155,5 190,25 190,65 155,85 120,65" fill="none" stroke="currentColor" strokeWidth="4" />
            <polygon points="190,25 225,5 260,25 260,65 225,85 190,65" fill="none" stroke="currentColor" strokeWidth="4" />

            <polygon points="15,85 50,65 85,85 85,125 50,145 15,125" fill="none" stroke="currentColor" strokeWidth="4" />
            <polygon points="85,85 120,65 155,85 155,125 120,145 85,125" fill="none" stroke="currentColor" strokeWidth="4" />
            <polygon points="155,85 190,65 225,85 225,125 190,145 155,125" fill="none" stroke="currentColor" strokeWidth="4" />
            <polygon points="225,85 260,65 295,85 295,125 260,145 225,125" fill="none" stroke="currentColor" strokeWidth="4" />

            <polygon points="50,145 85,125 120,145 120,185 85,205 50,185" fill="none" stroke="currentColor" strokeWidth="4" />
            <polygon points="120,145 155,125 190,145 190,185 155,205 120,185" fill="none" stroke="currentColor" strokeWidth="4" />
            <polygon points="190,145 225,125 260,145 260,185 225,205 190,185" fill="none" stroke="currentColor" strokeWidth="4" />

            <polygon points="15,205 50,185 85,205 85,245 50,265 15,245" fill="none" stroke="currentColor" strokeWidth="4" />
            <polygon points="85,205 120,185 155,205 155,245 120,265 85,245" fill="none" stroke="currentColor" strokeWidth="4" />
            <polygon points="155,205 190,185 225,205 225,245 190,265 155,245" fill="none" stroke="currentColor" strokeWidth="4" />
          </svg>
        </div>

        {/* Large Hexagon Pattern - Right Side */}
        <div className='absolute right-8 sm:right-16 lg:right-24 top-12 opacity-15'>
          <svg width="350" height="350" viewBox="0 0 350 350" className="text-blue-300">
            <polygon points="50,25 85,5 120,25 120,65 85,85 50,65" fill="none" stroke="currentColor" strokeWidth="4" />
            <polygon points="120,25 155,5 190,25 190,65 155,85 120,65" fill="none" stroke="currentColor" strokeWidth="4" />
            <polygon points="190,25 225,5 260,25 260,65 225,85 190,65" fill="none" stroke="currentColor" strokeWidth="4" />

            <polygon points="15,85 50,65 85,85 85,125 50,145 15,125" fill="none" stroke="currentColor" strokeWidth="4" />
            <polygon points="85,85 120,65 155,85 155,125 120,145 85,125" fill="none" stroke="currentColor" strokeWidth="4" />
            <polygon points="155,85 190,65 225,85 225,125 190,145 155,125" fill="none" stroke="currentColor" strokeWidth="4" />
            <polygon points="225,85 260,65 295,85 295,125 260,145 225,125" fill="none" stroke="currentColor" strokeWidth="4" />

            <polygon points="50,145 85,125 120,145 120,185 85,205 50,185" fill="none" stroke="currentColor" strokeWidth="4" />
            <polygon points="120,145 155,125 190,145 190,185 155,205 120,185" fill="none" stroke="currentColor" strokeWidth="4" />
            <polygon points="190,145 225,125 260,145 260,185 225,205 190,185" fill="none" stroke="currentColor" strokeWidth="4" />

            <polygon points="15,205 50,185 85,205 85,245 50,265 15,245" fill="none" stroke="currentColor" strokeWidth="4" />
            <polygon points="85,205 120,185 155,205 155,245 120,265 85,245" fill="none" stroke="currentColor" strokeWidth="4" />
            <polygon points="155,205 190,185 225,205 225,245 190,265 155,245" fill="none" stroke="currentColor" strokeWidth="4" />
          </svg>
        </div>
      </div>

      {/* Upward ^ Shape with Shield Logo in the Middle */}
      <div className='relative -mt-6 mb-0 pointer-events-none'>
        {/* Upward pointing ^ shape - connects to shield */}
        <svg viewBox="0 0 1440 120" className="w-full" preserveAspectRatio="none" style={{ height: '120px' }}>
          {/* ^ shape pointing upward - connects to shield bottom */}
          <path
            fill="#BFDBFE"
            d="M0,120 L720,20 L1440,120 L1440,120 L0,120 Z"
          />
        </svg>

        {/* Shield Logo - Exactly as per image */}
        <div className='absolute left-1/2 top-[42%] -translate-x-1/2 -translate-y-1/2 z-50 pointer-events-auto'>
          <div className='relative'>
            {/* Shield SVG */}
            <svg width="220" height="240" viewBox="0 0 220 240" className="drop-shadow-xl">
              <defs>
                <linearGradient id="exactShieldGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" style={{ stopColor: '#93C5FD', stopOpacity: 1 }} />
                  <stop offset="100%" style={{ stopColor: '#60A5FA', stopOpacity: 1 }} />
                </linearGradient>
              </defs>
              {/* Refined Shield shape to match image */}
              <path
                d="M110,20 L195,50 L195,120 Q195,185 110,225 Q25,185 25,120 L25,50 Z"
                fill="url(#exactShieldGradient)"
                stroke="white"
                strokeWidth="8"
              />
            </svg>

            {/* Shield Content */}
            <div className='absolute inset-0 flex flex-col items-center justify-center -mt-4'>
              {/* White Circular Shield Icon */}
              <div className='w-14 h-14 rounded-full bg-white/20 border-2 border-white/40 flex items-center justify-center mb-2'>
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <span className='text-white font-bold text-xl tracking-tight leading-none pt-2'>medclues</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Footer Content - Ensure it's on top of background elements */}
      <div className='relative z-30 w-full px-4 sm:px-6 lg:px-12 py-8 lg:py-10 bg-gradient-to-b from-blue-200 to-blue-300 shadow-inner'>
        <div className='flex flex-col lg:flex-row items-start gap-8 lg:gap-10 max-w-7xl mx-auto'>

          {/* Company Info Section */}
          <div className='space-y-3 lg:w-64 xl:w-72 flex-shrink-0'>
            {/* Logo */}
            <div className='flex items-center gap-2 mb-2'>
              <svg width="40" height="40" viewBox="0 0 40 40" className="text-cyan-500">
                <circle cx="20" cy="20" r="18" fill="currentColor" opacity="0.2" />
                <path d="M20 8 L28 12 L28 22 Q28 28 20 32 Q12 28 12 22 L12 12 Z" fill="currentColor" />
                <path d="M20 15 L20 25 M15 20 L25 20" stroke="white" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <span className='text-2xl font-bold text-gray-800'>MedClues</span>
            </div>

            <p className='text-sm text-gray-700 leading-relaxed'>
              MedClues is a secure, transparent, and modern healthcare management system. We connect patients with trusted doctors, ensuring seamless appointments, secure medical records, and comprehensive healthcare solutions.
            </p>

            {/* Social Media Icons */}
            <div className='flex gap-3 mt-2'>
              <a
                href="https://facebook.com"
                target="_blank"
                rel="noopener noreferrer"
                className='w-10 h-10 rounded-full bg-blue-600 hover:bg-blue-700 flex items-center justify-center transition-all duration-200 transform hover:scale-110'
                aria-label="Facebook"
              >
                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                </svg>
              </a>
              <a
                href="https://twitter.com"
                target="_blank"
                rel="noopener noreferrer"
                className='w-10 h-10 rounded-full bg-sky-500 hover:bg-sky-600 flex items-center justify-center transition-all duration-200 transform hover:scale-110'
                aria-label="Twitter"
              >
                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z" />
                </svg>
              </a>
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noopener noreferrer"
                className='w-10 h-10 rounded-full bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 hover:from-purple-700 hover:via-pink-700 hover:to-orange-600 flex items-center justify-center transition-all duration-200 transform hover:scale-110'
                aria-label="Instagram"
              >
                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                </svg>
              </a>
              <a
                href="https://linkedin.com"
                target="_blank"
                rel="noopener noreferrer"
                className='w-10 h-10 rounded-full bg-blue-700 hover:bg-blue-800 flex items-center justify-center transition-all duration-200 transform hover:scale-110'
                aria-label="LinkedIn"
              >
                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                </svg>
              </a>
            </div>
          </div>

          {/* Link Columns Area */}
          <div className='flex-1 flex flex-col w-full'>
            <div className='grid grid-cols-2 lg:grid-cols-3 gap-8 sm:gap-4 w-full mb-8 lg:mb-0'>

              {/* About Us Section */}
              <div className='space-y-2 min-w-0'>
                <h3 className='text-base font-semibold text-gray-800 pb-1 border-b border-blue-300/60'>
                  About Us
                </h3>
                <ul className='space-y-1.5'>
                  <li>
                    <button
                      onClick={() => handleNavClick('/')}
                      className='text-gray-700 hover:text-cyan-600 text-sm transition-colors duration-200 cursor-pointer flex items-center gap-2'
                    >
                      <span className='text-gray-400'>›</span> Home
                    </button>
                  </li>
                  <li>
                    <button
                      onClick={() => handleNavClick('/all-doctors')}
                      className='text-gray-700 hover:text-cyan-600 text-sm transition-colors duration-200 cursor-pointer flex items-center gap-2'
                    >
                      <span className='text-gray-400'>›</span> All Doctors
                    </button>
                  </li>
                  <li>
                    <button
                      onClick={() => handleNavClick('/about')}
                      className='text-gray-700 hover:text-cyan-600 text-sm transition-colors duration-200 cursor-pointer flex items-center gap-2'
                    >
                      <span className='text-gray-400'>›</span> About Us
                    </button>
                  </li>
                  <li>
                    <button
                      onClick={() => handleNavClick('/my-appointments')}
                      className='text-gray-700 hover:text-cyan-600 text-sm transition-colors duration-200 cursor-pointer flex items-center gap-2'
                    >
                      <span className='text-gray-400'>›</span> My Appointments
                    </button>
                  </li>
                  <li>
                    <button
                      onClick={() => handleNavClick('/my-profile')}
                      className='text-gray-700 hover:text-cyan-600 text-sm transition-colors duration-200 cursor-pointer flex items-center gap-2'
                    >
                      <span className='text-gray-400'>›</span> My Profile
                    </button>
                  </li>
                  <li>
                    <button
                      onClick={() => handleNavClick('/careers')}
                      className='text-gray-700 hover:text-cyan-600 text-sm transition-colors duration-200 cursor-pointer flex items-center gap-2'
                    >
                      <span className='text-gray-400'>›</span> Careers
                    </button>
                  </li>
                </ul>
              </div>

              {/* Resources Section */}
              <div className='space-y-2 min-w-0'>
                <h3 className='text-base font-semibold text-gray-800 pb-1 border-b border-blue-300/60'>
                  Resources
                </h3>
                <ul className='space-y-1.5'>
                  <li>
                    <button
                      onClick={() => handleNavClick('/contact')}
                      className='text-gray-700 hover:text-cyan-600 text-sm transition-colors duration-200 cursor-pointer flex items-center gap-2'
                    >
                      <span className='text-gray-400'>›</span> Contact Us
                    </button>
                  </li>
                  <li>
                    <button
                      onClick={() => handleNavClick('/privacy-policy')}
                      className='text-gray-700 hover:text-cyan-600 text-sm transition-colors duration-200 cursor-pointer flex items-center gap-2'
                    >
                      <span className='text-gray-400'>›</span> Privacy Policy
                    </button>
                  </li>
                  <li>
                    <button
                      onClick={() => handleNavClick('/data-security')}
                      className='text-gray-700 hover:text-cyan-600 text-sm transition-colors duration-200 cursor-pointer flex items-center gap-2'
                    >
                      <span className='text-gray-400'>›</span> Data Security
                    </button>
                  </li>
                  <li>
                    <button
                      onClick={() => handleNavClick('/labs')}
                      className='text-gray-700 hover:text-cyan-600 text-sm transition-colors duration-200 cursor-pointer flex items-center gap-2'
                    >
                      <span className='text-gray-400'>›</span> Diagnostic Labs
                    </button>
                  </li>
                  <li>
                    <button
                      onClick={() => handleNavClick('/emergency')}
                      className='text-gray-700 hover:text-red-500 text-sm font-bold transition-colors duration-200 cursor-pointer flex items-center gap-2'
                    >
                      <span className='text-red-400'>›</span> Emergency 108
                    </button>
                  </li>
                </ul>
              </div>

              {/* Get In Touch Section - Spans 2 cols on mobile */}
              <div className='col-span-2 lg:col-span-1 space-y-4 mt-6 lg:mt-0 flex flex-col items-center lg:items-start text-center lg:text-left'>
                <h3 className='text-base font-semibold text-gray-800 pb-1 border-b border-blue-300/60 w-max lg:w-full lg:text-left'>
                  GET IN TOUCH
                </h3>
                <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-6 w-full max-w-sm lg:max-w-none'>
                  {/* Phone */}
                  <a
                    href="tel:18001234567"
                    className='relative z-40 flex items-center gap-4 group cursor-pointer w-full'
                  >
                    <div className='w-12 h-12 rounded-2xl bg-white/50 backdrop-blur-sm border border-white/40 flex items-center justify-center flex-shrink-0 group-hover:bg-cyan-500 group-hover:border-cyan-400 group-hover:scale-110 shadow-sm transition-all duration-300'>
                      <svg className="w-6 h-6 text-cyan-600 group-hover:text-white transition-colors duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                    </div>
                    <div className='flex flex-col'>
                      <p className='text-[10px] font-black text-cyan-700/60 uppercase tracking-widest mb-0.5'>Emergency & Support</p>
                      <p className='text-lg sm:text-base text-gray-800 group-hover:text-cyan-700 transition-colors duration-200 font-bold'>
                        1800-123-4567
                      </p>
                    </div>
                  </a>

                  {/* Email */}
                  <a
                    href="mailto:support@medclues.com"
                    className='relative z-40 flex items-center gap-4 group cursor-pointer w-full'
                  >
                    <div className='w-12 h-12 rounded-2xl bg-white/50 backdrop-blur-sm border border-white/40 flex items-center justify-center flex-shrink-0 group-hover:bg-cyan-500 group-hover:border-cyan-400 group-hover:scale-110 shadow-sm transition-all duration-300'>
                      <svg className="w-6 h-6 text-cyan-600 group-hover:text-white transition-colors duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div className='flex flex-col'>
                      <p className='text-[10px] font-black text-cyan-700/60 uppercase tracking-widest mb-0.5'>Official Inquiries</p>
                      <p className='text-lg sm:text-base text-gray-800 group-hover:text-cyan-700 transition-colors duration-200 font-bold break-all'>
                        support@medclues.com
                      </p>
                    </div>
                  </a>
                </div>
              </div>

            </div>

            {/* Copyright Line - Centered under everything */}
            <div className='pt-6 border-t border-blue-400/20 text-center w-full mt-auto lg:mt-8'>
              <p className='text-sm sm:text-base text-gray-700 font-medium tracking-tight'>
                Copyright © 2026 MedClues. All Rights Reserved
              </p>
            </div>
          </div>

        </div>

      </div>

    </footer>
  )
}

export default Footer