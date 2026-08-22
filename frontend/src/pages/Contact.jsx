import React, { useState, useEffect } from 'react'
import { assets } from '../assets/assets'
import BackButton from '../components/BackButton'
import BackArrow from '../components/BackArrow'
import { useAppContext } from '../context/AppContext'
import useScrollAnimation from '../utils/useScrollAnimation'

const Contact = () => {
  const { backendUrl, token, userData } = useAppContext()
  const scrollRef = useScrollAnimation()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState(null) // { type: 'success' | 'error', message: string }

  // Auto-fill name and email when user is logged in
  useEffect(() => {
    if (token && userData) {
      // Auto-fill with logged-in user data
      setName(userData.name || '')
      setEmail(userData.email || '')
    } else {
      // Clear fields when user logs out
      setName('')
      setEmail('')
    }
  }, [token, userData])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setStatus(null)

    if (!name || !email || !message) {
      setStatus({ type: 'error', message: 'Please fill in all fields.' })
      return
    }

    try {
      setLoading(true)
      const res = await fetch(`${backendUrl}/api/user/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, message })
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to send message. Please try again.')
      }

      setStatus({ type: 'success', message: 'Your message has been sent. We will get back to you shortly.' })

      // Clear message field always
      setMessage('')

      // Only clear name/email if user is NOT logged in
      if (!token || !userData) {
        setName('')
        setEmail('')
      }
    } catch (error) {
      console.error('Error sending contact message:', error)
      setStatus({ type: 'error', message: error.message || 'Failed to send message. Please try again.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page-container fade-in" ref={scrollRef}>
      {/* Back Arrow Button */}
      <div className='mb-4 sm:mb-6 flex flex-wrap items-center gap-2 sm:gap-4 slide-down'>
        <BackArrow className="flex-shrink-0" />
        <BackButton className="flex-grow sm:flex-grow-0" />
      </div>

      <div className='max-w-5xl mx-auto'>
        {/* Header Section */}
        <div className='text-center mb-8 sm:mb-12 px-4 anim-header'>
          <h1 className='text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-2 sm:mb-3'>
            Contact <span className='text-cyan-500'>MedClues</span>
          </h1>
          <p className='text-sm sm:text-base text-gray-600'>Get in touch with our team</p>
        </div>

        {/* Main Contact Section */}
        <div className='grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 mb-8 sm:mb-12 px-4 sm:px-0'>
          {/* Image Section */}
          <div className='card overflow-hidden anim-left card-hover-lift'>
            <img
              className='w-full h-full object-cover min-h-[300px]'
              src={assets.contact_image}
              alt="MedClues Office"
            />
          </div>

          {/* Contact Information */}
          <div className='card p-6 anim-right'>
            <h2 className='text-xl font-bold text-gray-800 mb-6 text-center'>
              GET IN TOUCH
            </h2>

            <div className='space-y-4 sm:space-y-5'>
              {/* Phone Row */}
              <a 
                href="tel:18001234567" 
                className='flex items-start sm:items-center gap-3 sm:gap-4 group cursor-pointer'
              >
                <div className='w-10 h-10 bg-cyan-50 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-cyan-500 transition-all duration-300 shadow-sm'>
                  <svg className="w-5 h-5 text-cyan-600 group-hover:text-white transition-colors duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                </div>
                <div className='flex-1 min-w-0'>
                  <span className='block text-xs sm:text-sm text-gray-500 mb-1 group-hover:text-cyan-700 font-bold uppercase tracking-widest'>Official Support</span>
                  <span className='block text-sm sm:text-base text-gray-900 font-bold group-hover:text-cyan-600 transition-colors break-all'>
                    1800-123-4567
                  </span>
                </div>
              </a>

              {/* Email Row */}
              <a 
                href="mailto:support@medclues.com" 
                className='flex items-start sm:items-center gap-3 sm:gap-4 group cursor-pointer'
              >
                <div className='w-10 h-10 bg-cyan-50 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-cyan-500 transition-all duration-300 shadow-sm'>
                  <svg className="w-5 h-5 text-cyan-600 group-hover:text-white transition-colors duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <div className='flex-1 min-w-0'>
                  <span className='block text-xs sm:text-sm text-gray-500 mb-1 group-hover:text-cyan-700 font-bold uppercase tracking-widest'>Inquiry Email</span>
                  <span className='block text-sm sm:text-base text-gray-900 font-bold group-hover:text-cyan-600 transition-colors break-all'>
                    support@medclues.com                  </span>
                </div>
              </a>
            </div>

            {/* Careers Section */}
            <div className='mt-8 pt-6 border-t border-gray-200'>
              <h3 className='text-lg font-bold text-gray-800 mb-2'>Careers at MedClues</h3>
              <p className='text-gray-600 text-sm mb-4'>
                Join our mission to make quality healthcare more accessible, intelligent, and human.
                At MedClues you&apos;ll work with doctors, engineers, and operations experts who care deeply
                about patient impact, data privacy, and long-term innovation. Whether you&apos;re early in your
                career or an experienced professional, we offer opportunities to grow, learn, and lead.
              </p>
              <button
                type="button"
                className='btn btn-primary'
                onClick={() => window.open('/careers', '_blank', 'noopener,noreferrer')}
              >
                Explore Careers at MedClues
                <svg className='w-4 h-4' fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Contact Form Section */}
        <div className='card p-6 lg:p-8 anim-section'>
          <div className='text-center mb-8'>
            <h2 className='text-xl font-bold text-gray-800 mb-2'>Get In Touch</h2>
            <p className='text-gray-600 text-sm max-w-lg mx-auto'>
              Have questions about our services? We'd love to hear from you.
            </p>
          </div>

          <div className='grid grid-cols-1 lg:grid-cols-2 gap-8'>
            {/* Contact Form */}
            <div>
              <h3 className='font-semibold text-gray-800 mb-4'>Send us a message</h3>
              {token && userData && (
                <div className='mb-4 p-3 bg-cyan-50 border border-cyan-200 rounded-lg flex items-start gap-2'>
                  <svg className='w-5 h-5 text-cyan-600 flex-shrink-0 mt-0.5' fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className='text-sm text-cyan-800'>
                    <strong>Logged in as:</strong> Your name and email are auto-filled from your profile.
                  </p>
                </div>
              )}
              <form className='space-y-4' onSubmit={handleSubmit}>
                <div>
                  <input
                    type="text"
                    placeholder="Your Name"
                    className={`w-full ${token && userData ? 'bg-gray-50 cursor-not-allowed' : ''}`}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={token && userData}
                    required
                  />
                  {token && userData && (
                    <p className='text-xs text-gray-500 mt-1'>✓ Auto-filled from your profile</p>
                  )}
                </div>
                <div>
                  <input
                    type="email"
                    placeholder="Your Email"
                    className={`w-full ${token && userData ? 'bg-gray-50 cursor-not-allowed' : ''}`}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={token && userData}
                    required
                  />
                  {token && userData && (
                    <p className='text-xs text-gray-500 mt-1'>✓ Auto-filled from your profile</p>
                  )}
                </div>
                <div>
                  <textarea
                    placeholder="Your Message"
                    rows="4"
                    className='w-full resize-none'
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    required
                  ></textarea>
                </div>

                {status && (
                  <div className={`text-sm rounded-md p-3 ${status.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                    {status.message}
                  </div>
                )}

                <button type="submit" className='btn btn-primary btn-full' disabled={loading}>
                  {loading ? 'Sending...' : 'Send Message'}
                </button>
              </form>
            </div>

            {/* Social & Hours */}
            <div>
              <h3 className='font-semibold text-gray-800 mb-4'>Connect with us</h3>
              <p className='text-gray-600 text-sm mb-4'>
                Follow us on social media to stay updated with the latest news.
              </p>

              <div className='flex gap-3 mb-6'>
                {['Facebook', 'Twitter', 'LinkedIn', 'Instagram'].map((social) => (
                  <a
                    key={social}
                    href="#"
                    className='w-10 h-10 bg-gray-100 hover:bg-cyan-100 rounded-lg flex items-center justify-center transition-colors'
                    aria-label={social}
                  >
                    <svg className='w-5 h-5 text-gray-600' fill="currentColor" viewBox="0 0 24 24">
                      {social === 'Facebook' && <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />}
                      {social === 'Twitter' && <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z" />}
                      {social === 'LinkedIn' && <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />}
                      {social === 'Instagram' && <path d="M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm7.846-10.405a1.44 1.44 0 11-2.88 0 1.44 1.44 0 012.88 0z" />}
                    </svg>
                  </a>
                ))}
              </div>

              <div className='bg-gray-50 rounded-xl p-4 mb-4'>
                <div className='flex items-center gap-2 mb-3'>
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <h4 className='font-semibold text-gray-800'>Business Hours</h4>
                </div>
                <div className='space-y-2 text-sm'>
                  <div className='flex justify-between items-center'>
                    <span className='text-gray-600'>Monday - Friday</span>
                    <span className='text-gray-800 font-medium'>9:00 AM - 5:00 PM</span>
                  </div>
                  <div className='flex justify-between items-center'>
                    <span className='text-gray-600'>Saturday</span>
                    <span className='text-gray-800 font-medium'>10:00 AM - 2:00 PM</span>
                  </div>
                  <div className='flex justify-between items-center'>
                    <span className='text-gray-600'>Sunday</span>
                    <span className='text-gray-500'>Closed</span>
                  </div>
                </div>
              </div>

              {/* Location Section - Classic & Official Design */}
              <div className='bg-white rounded-xl p-5 border border-gray-200 shadow-sm'>
                <div className='flex items-center gap-2 mb-4'>
                  <div className='w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center'>
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <h4 className='font-semibold text-gray-800 text-base'>Location</h4>
                </div>

                <div className='space-y-3'>
                  {/* Business Name */}
                  <div className='flex items-start gap-3'>
                    <svg className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                    <div className='flex-1'>
                      <p className='text-gray-900 font-semibold text-sm mb-1'>MedClues Healthcare</p>
                      <p className='text-gray-600 text-sm leading-relaxed'>Vignan University Campus, Vadlamudi, Guntur District, Andhra Pradesh - 522 213, India</p>
                    </div>
                  </div>

                  {/* Get Directions Button */}
                  <a
                    href="https://www.google.com/maps/dir/?api=1&destination=Vignan+University+Vadlamudi+Guntur"
                    target="_blank"
                    rel="noopener noreferrer"
                    className='w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-4 rounded-lg transition-colors duration-200 shadow-sm hover:shadow-md group'
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                    </svg>
                    <span>Get Directions</span>
                    <svg className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Contact
