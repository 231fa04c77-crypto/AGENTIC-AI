import React, { useState, useEffect } from 'react'
import { assets } from '../assets/assets'
import BackButton from '../components/BackButton'
import BackArrow from '../components/BackArrow'
import axios from 'axios'
import useScrollAnimation from '../utils/useScrollAnimation'

const About = () => {
  const [specialties, setSpecialties] = useState([])
  const [loading, setLoading] = useState(true)
  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000'
  const scrollRef = useScrollAnimation()

  useEffect(() => {
    fetchSpecialties()
  }, [])

  const fetchSpecialties = async () => {
    try {
      const response = await axios.get(`${backendUrl}/api/specialty/public/all`)
      if (response.data.success) {
        setSpecialties(response.data.data || [])
      }
    } catch (error) {
      console.error('Error fetching specialties:', error)
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

      <div className="max-w-5xl mx-auto">
        {/* Header Section */}
        <div className='text-center mb-8 sm:mb-12 px-4 anim-header'>
          <h1 className='text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-2 sm:mb-3'>
            About <span className='text-cyan-500'>MedClues</span>
          </h1>
          <p className='text-sm sm:text-base text-gray-600 max-w-2xl mx-auto'>
            Revolutionizing healthcare through modern technology and patient-centric solutions
          </p>
        </div>

        {/* Main Content */}
        <div className='card mb-6 sm:mb-8 card-hover-lift'>
          <div className='flex flex-col lg:flex-row gap-6 sm:gap-8 p-4 sm:p-6 lg:p-8'>
            {/* Image Section */}
            <div className='lg:w-2/5 flex-shrink-0'>
              <div className='relative overflow-hidden rounded-xl'>
                {/* Back Arrow Button */}
                <div className="mb-4 sm:mb-6 flex flex-wrap items-center gap-2 sm:gap-4">
                    <BackArrow className="flex-shrink-0" />
                    <BackButton className="flex-grow sm:flex-grow-0" />
                </div>
                <img
                  className='w-full h-auto object-cover'
                  src={assets.about_image}
                  alt="MedClues Healthcare"
                />
              </div>
            </div>

            {/* Content Section */}
            <div className='flex-1 space-y-3 sm:space-y-4 text-gray-600'>
              <p className='text-sm sm:text-base leading-relaxed text-justify'>
                Welcome to MedClues, where we're transforming healthcare through innovation and technology.
                We understand the critical importance of secure, accessible, and seamless healthcare services in today's digital world.
              </p>

              <p className='text-sm sm:text-base leading-relaxed text-justify'>
                MedClues is committed to revolutionizing healthcare by putting patients first.
                Our platform ensures your health data remains secure, your appointments are hassle-free,
                and you have easy access to trusted healthcare providers when you need them most.
              </p>

              <div className='pt-2 sm:pt-4'>
                <h3 className='text-base sm:text-lg font-bold text-gray-800 mb-1 sm:mb-2'>Our Vision</h3>
                <p className='text-sm sm:text-base leading-relaxed text-justify'>
                  We envision a future where healthcare is accessible to everyone, data flows seamlessly
                  between patients and providers, and technology enhances the healing process rather than
                  complicating it.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Technology Highlights */}
        <div className='card p-4 sm:p-6 lg:p-8 mb-6 sm:mb-8 anim-section'>
          <h2 className='text-lg sm:text-xl font-bold text-gray-800 text-center mb-6 sm:mb-8'>
            Our <span className='text-cyan-500'>Technology</span>
          </h2>

          <div className='grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 anim-grid'>
            <div className='text-center p-4 sm:p-6 rounded-xl bg-gradient-to-br from-cyan-50 to-blue-50 border border-cyan-100 hover:shadow-lg transition-shadow card-hover-lift'>
              <div className='text-3xl sm:text-4xl mb-3 sm:mb-4 anim-float'>🔒</div>
              <h3 className='text-sm sm:text-base font-semibold text-gray-800 mb-1 sm:mb-2'>Secure Platform</h3>
              <p className='text-gray-600 text-xs sm:text-sm'>
                Enterprise-grade security protecting your health data with encryption and secure protocols.
              </p>
            </div>

            <div className='text-center p-4 sm:p-6 rounded-xl bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-100 hover:shadow-lg transition-shadow card-hover-lift'>
              <div className='text-3xl sm:text-4xl mb-3 sm:mb-4 anim-float' style={{ animationDelay: '0.5s' }}>⚡</div>
              <h3 className='text-sm sm:text-base font-semibold text-gray-800 mb-1 sm:mb-2'>Smart Scheduling</h3>
              <p className='text-gray-600 text-xs sm:text-sm'>
                Intelligent appointment management for seamless booking and rescheduling.
              </p>
            </div>

            <div className='text-center p-4 sm:p-6 rounded-xl bg-gradient-to-br from-green-50 to-teal-50 border border-green-100 hover:shadow-lg transition-shadow sm:col-span-2 md:col-span-1 card-hover-lift'>
              <div className='text-3xl sm:text-4xl mb-3 sm:mb-4 anim-float' style={{ animationDelay: '1s' }}>🌐</div>
              <h3 className='text-sm sm:text-base font-semibold text-gray-800 mb-1 sm:mb-2'>Connected Care</h3>
              <p className='text-gray-600 text-xs sm:text-sm'>
                Unified system connecting patients with healthcare providers across the network.
              </p>
            </div>
          </div>
        </div>

        {/* Why Choose Us */}
        <div className='text-center mb-6 sm:mb-8 px-4 anim-header'>
          <h2 className='text-lg sm:text-xl font-bold text-gray-800 mb-1 sm:mb-2'>
            Why Choose <span className='text-cyan-500'>MedClues</span>
          </h2>
          <p className='text-sm sm:text-base text-gray-600'>Experience the future of healthcare management</p>
        </div>

        <div className='grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 mb-8 sm:mb-12 px-4 sm:px-0 anim-grid'>
          <div className='card p-4 sm:p-6 text-center hover:shadow-xl transition-shadow card-hover-lift'>
            <div className='text-2xl sm:text-3xl mb-2 sm:mb-3 anim-float'>🔐</div>
            <h3 className='text-sm sm:text-base font-semibold text-gray-800 mb-1 sm:mb-2'>Data Privacy</h3>
            <p className='text-gray-600 text-xs sm:text-sm'>
              You control your health data. Secure access management ensures only authorized providers see your records.
            </p>
          </div>

          <div className='card p-4 sm:p-6 text-center hover:shadow-xl transition-shadow card-hover-lift'>
            <div className='text-2xl sm:text-3xl mb-2 sm:mb-3 anim-float' style={{ animationDelay: '0.5s' }}>🔄</div>
            <h3 className='text-sm sm:text-base font-semibold text-gray-800 mb-1 sm:mb-2'>Seamless Experience</h3>
            <p className='text-gray-600 text-xs sm:text-sm'>
              From booking to consultation, enjoy a smooth healthcare journey with our intuitive platform.
            </p>
          </div>

          <div className='card p-4 sm:p-6 text-center hover:shadow-xl transition-shadow sm:col-span-2 md:col-span-1 card-hover-lift'>
            <div className='text-2xl sm:text-3xl mb-2 sm:mb-3 anim-float' style={{ animationDelay: '1s' }}>⚡</div>
            <h3 className='text-sm sm:text-base font-semibold text-gray-800 mb-1 sm:mb-2'>Instant Access</h3>
            <p className='text-gray-600 text-xs sm:text-sm'>
              Quick access to healthcare providers, appointment scheduling, and medical records anytime.
            </p>
          </div>
        </div>

        {/* Specialty Helpline Section */}
        {specialties.length > 0 && (
          <div className='card p-4 sm:p-6 lg:p-8 mb-6 sm:mb-8'>
            <div className='text-center mb-6 sm:mb-8'>
              <h2 className='text-lg sm:text-xl font-bold text-gray-800 mb-2'>
                <span className='text-cyan-500'>Specialty</span> Helpline Numbers
              </h2>
              <p className='text-sm sm:text-base text-gray-600'>
                Contact our specialized helplines for immediate medical assistance
              </p>
            </div>

            {loading ? (
              <div className='text-center py-8'>
                <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500 mx-auto'></div>
                <p className='text-gray-500 mt-2 text-sm'>Loading helplines...</p>
              </div>
            ) : (
              <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6'>
                {specialties.map((specialty, index) => (
                  <div
                    key={index}
                    className='rounded-xl bg-gradient-to-br from-cyan-50 to-blue-50 border border-cyan-100 hover:shadow-lg transition-all duration-300 hover:scale-[1.02] overflow-hidden group'
                  >
                    {specialty.helplineNumber ? (
                      <a
                        href={`tel:${specialty.helplineNumber.replace(/\s/g, '')}`}
                        className='p-4 sm:p-5 h-full w-full flex flex-col cursor-pointer'
                      >
                        <div className='flex items-start justify-between mb-3'>
                          <div className='flex-1'>
                            <h3 className='text-base sm:text-lg font-bold text-gray-800 mb-2 group-hover:text-cyan-600 transition-colors'>
                              {specialty.specialtyName || 'General'}
                            </h3>
                            <div className='inline-flex items-center gap-2 text-cyan-600 group-hover:text-cyan-700 font-semibold text-sm sm:text-base'>
                              <svg className='w-5 h-5 group-hover:scale-110 transition-transform' fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                              </svg>
                              {specialty.helplineNumber}
                            </div>
                          </div>
                          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${specialty.availability === '24x7'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-blue-100 text-blue-700'
                            }`}>
                            {specialty.availability}
                          </span>
                        </div>
                        <p className='text-xs text-gray-500 mt-2 font-medium'>
                          {specialty.availability === '24x7' ? '✓ Available 24/7' : '✓ Available during working hours'}
                        </p>
                      </a>
                    ) : (
                      <div className='p-4 sm:p-5'>
                        <h3 className='text-base sm:text-lg font-bold text-gray-800 mb-2'>{specialty.specialtyName || 'General'}</h3>
                        <p className='text-sm text-gray-500'>No helpline available at this time.</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default About
