import React, { useContext, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppContext } from '../context/AppContext'
import axios from 'axios'
import useScrollAnimation from '../utils/useScrollAnimation'

const HospitalTieUps = () => {
    const { backendUrl } = useContext(AppContext)
    const navigate = useNavigate()
    const [hospitals, setHospitals] = useState([])
    const [loading, setLoading] = useState(true)
    const [showAll, setShowAll] = useState(false)
    const [initialDisplayCount, setInitialDisplayCount] = useState(4)
    const scrollRef = useScrollAnimation()

    // Set initial display count based on screen size
    useEffect(() => {
        const updateDisplayCount = () => {
            // Desktop/laptop (1024px and above) = 8, Mobile/tablet = 4
            setInitialDisplayCount(window.innerWidth >= 1024 ? 8 : 4)
        }

        updateDisplayCount()
        window.addEventListener('resize', updateDisplayCount)
        return () => window.removeEventListener('resize', updateDisplayCount)
    }, [])

    useEffect(() => {
        const fetchHospitals = async () => {
            try {
                const { data } = await axios.get(backendUrl + '/api/hospital-tieup/public')
                if (data.success) {
                    setHospitals(data.hospitals)
                }
            } catch (error) {
                console.error("Error fetching hospitals:", error)
            } finally {
                setLoading(false)
            }
        }
        fetchHospitals()
    }, [backendUrl])

    if (!loading && hospitals.length === 0) {
        return null
    }

    return (
        <div className='py-12 px-4 sm:px-6 lg:px-8 bg-transparent' ref={scrollRef}>
            {/* Section Header */}
            <div className='text-center mb-10 anim-header'>
                <h2 className='text-3xl font-bold text-gray-900 mb-4'>Partner Hospitals</h2>
                <p className='text-gray-600 max-w-2xl mx-auto'>
                    We have tied up with top-rated hospitals to provide you the best medical care and facilities.
                </p>
            </div>

            {/* Loading State */}
            {loading ? (
                <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto'>
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="bg-white rounded-xl p-6 shadow-sm animate-pulse h-48"></div>
                    ))}
                </div>
            ) : (
                <>
                    <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 max-w-7xl mx-auto anim-grid'>
                        {(showAll ? hospitals : hospitals.slice(0, initialDisplayCount)).map((hospital, index) => (
                            <div
                                key={index}
                                className='bg-white rounded-xl p-6 border border-blue-200 shadow-sm hover:shadow-md hover:-translate-y-1 hover:border-blue-400 transition-all duration-300 flex flex-col'
                            >
                                {/* Header with Icon and Type Tag */}
                                <div className='flex items-center justify-between mb-5'>
                                    <div className='relative'>
                                        <div className='w-12 h-12 bg-blue-50 border border-blue-100 rounded-lg flex items-center justify-center'>
                                            <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                            </svg>
                                        </div>
                                        <div className='absolute -top-1 -right-1 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-white shadow-sm'></div>
                                    </div>
                                    <span className={`px-3 py-1 rounded-full text-[11px] font-bold tracking-wide uppercase ${hospital.type === 'Teaching Hospital'
                                        ? 'bg-purple-100 text-purple-700'
                                        : hospital.type === 'Super Specialty'
                                            ? 'bg-indigo-100 text-indigo-700'
                                            : 'bg-blue-100 text-blue-700'
                                        }`}>
                                        {hospital.type || 'GENERAL'}
                                    </span>
                                </div>

                                {/* Hospital Name */}
                                <h3 className='text-lg font-bold text-gray-900 mb-4 tracking-tight line-clamp-1'>
                                    {hospital.name}
                                </h3>

                                {/* Location */}
                                <div className='flex items-start gap-3 mb-3'>
                                    <div className='mt-0.5 bg-gray-50 p-1.5 rounded-md flex-shrink-0'>
                                        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                        </svg>
                                    </div>
                                    <div className='flex-1 overflow-hidden'>
                                        <p className='text-sm text-gray-600 mb-1.5 truncate leading-relaxed'>{hospital.address}</p>
                                        <a
                                            href={hospital.latitude && hospital.longitude 
                                                ? `https://www.google.com/maps/place/${encodeURIComponent(hospital.name)}/@${hospital.latitude},${hospital.longitude},17z`
                                                : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(hospital.name + ' ' + (hospital.address || ''))}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className='text-blue-600 hover:text-blue-700 text-sm font-semibold inline-flex items-center gap-1 transition-colors'
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            View on Map
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                            </svg>
                                        </a>
                                    </div>
                                </div>

                                {/* Contact Number */}
                                <div className='flex items-center gap-3 mb-6'>
                                    <div className='bg-gray-50 p-1.5 rounded-md flex-shrink-0'>
                                        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                        </svg>
                                    </div>
                                    <span className="text-sm font-medium text-gray-700 truncate">{hospital.contact || 'Not available'}</span>
                                </div>

                                {/* Specialization Button */}
                                <div className='mt-auto pt-4 border-t border-gray-100'>
                                    <div className='flex items-center justify-center gap-2 w-full py-2.5 bg-purple-50 hover:bg-purple-100 transition-colors rounded-lg cursor-default'>
                                        <svg className="w-4 h-4 text-purple-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                        </svg>
                                        <span className='text-sm font-semibold text-purple-700 tracking-wide truncate max-w-[200px]'>
                                            {hospital.specialization || 'General'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                    {/* View More Button - Navigate to Hospitals Page */}
                    {
                        hospitals.length > initialDisplayCount && !showAll && (
                            <div className='text-center mt-8'>
                                <button
                                    onClick={() => navigate('/hospitals')}
                                    className='px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md hover:shadow-lg inline-flex items-center gap-2'
                                >
                                    View All Hospitals
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                    </svg>
                                </button>
                            </div>
                        )
                    }
                    {/* View Less Button - Show when all are displayed */}
                    {
                        showAll && hospitals.length > initialDisplayCount && (
                            <div className='text-center mt-8'>
                                <button
                                    onClick={() => {
                                        setShowAll(false)
                                        window.scrollTo({ top: 0, behavior: 'smooth' })
                                    }}
                                    className='px-6 py-3 bg-gray-600 text-white font-semibold rounded-lg hover:bg-gray-700 transition-all shadow-md hover:shadow-lg'
                                >
                                    View Less
                                </button>
                            </div>
                        )
                    }
                </>
            )}
        </div >
    )
}

export default HospitalTieUps
