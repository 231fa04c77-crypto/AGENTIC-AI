import React, { useContext, useState } from 'react'
import { AppContext } from '../context/AppContext'
import { SkeletonCard } from './LoadingSpinner'
import { getExperienceBadge } from '../utils/experienceBadge'
import { useNavigate } from 'react-router-dom'
import AppointmentBookingModal from './AppointmentBookingModal'
import { toast } from 'react-toastify'

const TopDoctors = () => {

    const { doctors, isDoctorsLoading, token } = useContext(AppContext)
    const navigate = useNavigate()
    const [showBookingModal, setShowBookingModal] = useState(false)
    const [selectedDoctor, setSelectedDoctor] = useState(null)

    // Handle doctor click for booking
    const handleDoctorClick = (doctor) => {
        if (!token) {
            toast.warning('Please login to book an appointment')
            navigate('/login')
            return
        }

        // Show booking modal first (Self or Others)
        const doctorId = doctor?._id || doctor?.id
        if (doctor && doctorId) {
            setSelectedDoctor({ ...doctor, _id: doctorId })
            setShowBookingModal(true)
        } else {
            toast.error('Doctor ID not found. Please try again.')
        }
    }

    // Extract MD/MBBS/MS from name or add it based on variety
    const getDoctorNameWithMD = (name, index, degree) => {
        if (!name) return 'Doctor'
        const degrees = ['MD', 'MBBS', 'MS']
        
        // Use degree if provided, else rotate based on index, else default to 'MD'
        let deg = degree;
        if (!deg || deg === 'undefined') {
            const idx = typeof index === 'number' ? index : 0;
            deg = degrees[idx % degrees.length];
        }
        if (!deg) deg = 'MD';

        // Add degree in parentheses if not already present
        let formattedName = name;
        if (name && !name.includes(`(${deg})`)) {
            formattedName = `${name} (${deg})`;
        }
        
        // Ensure "Dr. " prefix
        return formattedName.startsWith('Dr.') ? formattedName : `Dr. ${formattedName}`;
    }

    // Sort doctors: Available first, then unavailable
    const sortedDoctors = [...doctors].sort((a, b) => {
        if (!a || !b) return 0 // Null safety check
        if (a.available === b.available) return 0
        return a.available ? -1 : 1
    })

    return (
        <div className='py-12 px-4 sm:px-6 lg:px-8'>
            {/* Section Header */}
            <div className='text-center mb-8'>
                <h2 className='section-title'>Top Doctors to Book</h2>
                <p className='section-subtitle max-w-xl mx-auto'>
                    Simply browse through our extensive list of trusted doctors and book your appointment hassle-free.
                </p>
            </div>

            {/* Loading State */}
            {isDoctorsLoading ? (
                <div className='doctors-grid'>
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                        <SkeletonCard key={i} />
                    ))}
                </div>
            ) : (
                <>
                    {/* Doctor Cards Grid - Circular Profile Design */}
                    <div className='top-doctors-grid'>
                        {sortedDoctors.slice(0, 8).map((item, index) => (
                            <div
                                className='top-doctor-card group cursor-pointer hover:scale-105 transition-transform duration-300'
                                key={index}
                                onClick={() => handleDoctorClick(item)}
                            >
                                {/* Circular Profile Picture Container */}
                                <div className='top-doctor-image-wrapper'>
                                    <div className='top-doctor-image-container'>
                                        <img
                                            className='top-doctor-image'
                                            src={item.image}
                                            alt={item.name}
                                        />
                                    </div>
                                </div>

                                {/* Card Content */}
                                <div className='top-doctor-content'>
                                    <h3 className='top-doctor-name'>
                                        {getDoctorNameWithMD(item.name, index, item.degree || item.qualification)}
                                    </h3>
                                    <div className='mb-2'>
                                        <span className='inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-xs font-bold shadow-md'>
                                            <svg className='w-3.5 h-3.5' fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                            </svg>
                                            {item.speciality}
                                        </span>
                                    </div>
                                    {item.experience && (() => {
                                        const badge = getExperienceBadge(item.experience)
                                        const experienceNum = parseInt(item.experience) || 0
                                        return (
                                            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${badge.bg} ${badge.border} ${badge.shadow} shadow-sm`}>
                                                <div className={`flex items-center justify-center w-4 h-4 rounded-full ${badge.iconBg}`}>
                                                    <svg className='w-2.5 h-2.5 text-white' fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                    </svg>
                                                </div>
                                                <span className={`text-[10px] sm:text-xs font-semibold ${badge.color}`}>
                                                    {badge.label} • {experienceNum} {experienceNum !== 1 ? 'Yrs' : 'Yr'}
                                                </span>
                                            </div>
                                        );
                                    })()}
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}

            {/* Appointment Booking Modal - Self or Others */}
            {selectedDoctor && selectedDoctor._id && showBookingModal && (
                <AppointmentBookingModal
                    doctor={selectedDoctor}
                    isOpen={showBookingModal}
                    onClose={() => {
                        setShowBookingModal(false)
                        setSelectedDoctor(null)
                    }}
                    onProceed={(docId, patientInfo) => {
                        if (!docId || !patientInfo) {
                            toast.error('Missing appointment information. Please try again.')
                            return
                        }
                        try {
                            sessionStorage.setItem('appointmentPatientData', JSON.stringify(patientInfo))
                            setShowBookingModal(false)
                            setSelectedDoctor(null)
                            navigate(`/appointment/${docId}`, { state: { doctor: selectedDoctor } })
                            window.scrollTo(0, 0)
                        } catch (error) {
                            console.error('Error saving appointment data:', error)
                            toast.error('Failed to save appointment data. Please try again.')
                        }
                    }}
                />
            )}
        </div>
    )
}

export default TopDoctors
