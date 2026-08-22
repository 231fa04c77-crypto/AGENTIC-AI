import React, { useContext } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppContext } from '../context/AppContext'
import Banner from './Banner'
import useScrollAnimation from '../utils/useScrollAnimation'

const ContactLocation = () => {
    const { userData } = useContext(AppContext)
    const navigate = useNavigate()
    const scrollRef = useScrollAnimation()
    const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=Vignan+University+Vadlamudi+Guntur`

    return (
        <section className='w-full bg-transparent py-4 sm:py-6 md:py-8' ref={scrollRef}>
            <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>

                {/* Section Header */}
                <div className='text-center mb-6 sm:mb-8 animate-on-scroll'>
                    <h2 className='text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-1'>
                        Health Begins with
                    </h2>
                    <h2 className='text-2xl sm:text-3xl md:text-4xl font-bold text-cyan-500 mb-2 sm:mb-3'>
                        MedClues
                    </h2>
                    <p className='text-gray-500 text-sm sm:text-base max-w-xl mx-auto'>
                        Visit us at our location or get in touch with us
                    </p>
                </div>

                {/* Main Card */}
                <div className='bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden animate-on-scroll stagger-2'>
                    <div className='grid grid-cols-1 lg:grid-cols-2 min-h-[480px] sm:min-h-[520px]'>

                        {/* ── LEFT: Map ── */}
                        <div className='relative w-full h-[280px] sm:h-[360px] lg:h-full'>
                            {/* Map iframe fills the whole left panel */}
                            <iframe
                                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3826.5!2d80.6214!3d16.4244!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3a35eff9482d944b%3A0x939b7e84ab4d026c!2sVignan%27s%20Foundation%20for%20Science%2C%20Technology%20%26%20Research!5e0!3m2!1sen!2sin!4v1700000000000!5m2!1sen!2sin"
                                width="100%"
                                height="100%"
                                style={{ border: 0, display: 'block', position: 'absolute', inset: 0 }}
                                allowFullScreen
                                loading="lazy"
                                referrerPolicy="no-referrer-when-downgrade"
                                title="MedClues Location - Vignan University"
                            />
                            {/* Gradient overlay at top for branding */}
                            <div className='absolute top-0 left-0 right-0 h-10 bg-gradient-to-b from-white/20 to-transparent pointer-events-none z-10' />
                            {/* MedClues pill marker overlaid on map */}
                            <div className='absolute bottom-4 left-1/2 -translate-x-1/2 z-20 pointer-events-none'>
                                <div className='bg-blue-600 text-white text-xs font-bold px-4 py-1.5 rounded-full shadow-lg flex items-center gap-1.5'>
                                    <svg className='w-3 h-3' fill='currentColor' viewBox='0 0 24 24'>
                                        <path d='M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z' />
                                    </svg>
                                    MedClues
                                </div>
                            </div>
                        </div>

                        {/* ── RIGHT: Contact Info ── */}
                        <div className='flex flex-col justify-between p-6 sm:p-8 lg:p-10 bg-white'>

                            {/* Contact rows */}
                            <div className='space-y-5 sm:space-y-6'>
                                {/* Phone */}
                                <div className='group'>
                                    <a 
                                        href='tel:18001234567'
                                        className='flex items-start gap-4 cursor-pointer w-full'
                                    >
                                        <div className='w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center shrink-0 group-hover:bg-red-500 group-hover:scale-110 shadow-sm transition-all duration-300'>
                                            <svg className='w-6 h-6 text-red-500 group-hover:text-white transition-colors duration-300' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                                                <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z' />
                                            </svg>
                                        </div>
                                        <div className='min-w-0'>
                                            <p className='text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-0.5'>Direct Call</p>
                                            <p className='text-gray-900 font-black text-lg sm:text-xl group-hover:text-red-600 transition-colors'>
                                                1800-123-4567
                                            </p>
                                            <p className='text-gray-400 text-[10px] sm:text-xs mt-1 font-bold'>
                                                Available 24/7 for Emergency Support
                                            </p>
                                        </div>
                                    </a>
                                </div>

                                {/* Divider */}
                                <div className='border-t border-gray-50' />

                                {/* Email */}
                                <div className='group'>
                                    <a 
                                        href='mailto:support@medclues.com'
                                        className='flex items-start gap-4 cursor-pointer w-full'
                                    >
                                        <div className='w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center shrink-0 group-hover:bg-blue-500 group-hover:scale-110 shadow-sm transition-all duration-300'>
                                            <svg className='w-6 h-6 text-blue-500 group-hover:text-white transition-colors duration-300' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                                                <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' />
                                            </svg>
                                        </div>
                                        <div className='min-w-0'>
                                            <p className='text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-0.5'>Email Us</p>
                                            <p className='text-gray-900 font-black text-sm sm:text-base group-hover:text-blue-600 transition-colors break-all'>
                                                support@medclues.com
                                            </p>
                                            <p className='text-gray-400 text-[10px] sm:text-xs mt-1 font-bold'>
                                                Typical response time: <span className="text-blue-400">Within 2 hours</span>
                                            </p>
                                        </div>
                                    </a>
                                </div>

                                {/* Divider */}
                                <div className='border-t border-gray-100' />

                                {/* Address */}
                                <div className='flex items-start gap-4'>
                                    <div className='w-10 h-10 rounded-xl bg-cyan-50 flex items-center justify-center shrink-0 mt-0.5'>
                                        <svg className='w-5 h-5 text-cyan-500' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                                            <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z' />
                                            <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M15 11a3 3 0 11-6 0 3 3 0 016 0z' />
                                        </svg>
                                    </div>
                                    <div className='min-w-0'>
                                        <p className='text-xs font-semibold uppercase tracking-widest text-gray-400 mb-0.5'>Address</p>
                                        <p className='text-gray-900 font-bold text-sm sm:text-base mb-0.5'>MedClues Healthcare</p>
                                        <p className='text-gray-600 text-sm leading-relaxed'>
                                            Vignan University Campus, Vadlamudi,<br />
                                            Guntur District, Andhra Pradesh — 522 213, India
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* CTA Buttons */}
                            <div className='flex flex-col sm:flex-row gap-3 mt-6 sm:mt-8 pt-5 border-t border-gray-100'>
                                <button
                                    onClick={() => navigate('/hospitals')}
                                    className='flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 px-5 rounded-xl transition-all duration-200 shadow-sm hover:shadow-md flex items-center justify-center gap-2 text-sm'
                                >
                                    <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                                        <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' />
                                    </svg>
                                    Book Appointment
                                </button>
                                <a
                                    href={directionsUrl}
                                    target='_blank'
                                    rel='noopener noreferrer'
                                    className='flex-1 bg-white border border-gray-200 hover:border-blue-400 hover:bg-blue-50 text-gray-700 hover:text-blue-600 font-semibold py-2.5 px-5 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 text-sm'
                                >
                                    <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                                        <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7' />
                                    </svg>
                                    Get Directions
                                </a>
                            </div>
                        </div>

                    </div>
                </div>

                {/* Banner below */}
                <div className='mt-6 sm:mt-8'>
                    <Banner />
                </div>

            </div>
        </section>
    )
}

export default ContactLocation
