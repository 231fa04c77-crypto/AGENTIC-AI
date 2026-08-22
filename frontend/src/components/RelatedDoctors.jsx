import React, { useContext, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppContext } from '../context/AppContext'
import { getExperienceBadge } from '../utils/experienceBadge'
import AppointmentBookingModal from './AppointmentBookingModal'
import { toast } from 'react-toastify'

const RelatedDoctors = ({ speciality, docId }) => {
    const navigate = useNavigate()
    const { doctors, token } = useContext(AppContext)
    const [relDoc, setRelDoc] = useState([])
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

    useEffect(() => {
        if (doctors.length > 0 && speciality) {
            // Filter out null/undefined doctors and filter by specialty
            // Also ensure each doctor has required properties
            const doctorsData = doctors
                .filter((doc) => {
                    // Ensure doc exists and has required properties
                    if (!doc || !doc._id || !doc.name) return false
                    // Filter by specialty
                    if (doc.speciality !== speciality) return false
                    // Exclude current doctor
                    if (doc._id === docId) return false
                    // Ensure available property exists (set default if missing)
                    if (doc.available === undefined || doc.available === null) {
                        doc.available = true // Default to available for booking
                    }
                    return true
                })
            // Sort: Available doctors first, then unavailable
            doctorsData.sort((a, b) => {
                // Enhanced null safety check
                if (!a || !b) return 0
                // Safely access available property (already ensured to exist above)
                const aAvailable = a.available === true || a.available === 'true'
                const bAvailable = b.available === true || b.available === 'true'
                if (aAvailable === bAvailable) return 0
                return aAvailable ? -1 : 1
            })
            setRelDoc(doctorsData)
        } else {
            setRelDoc([])
        }
    }, [doctors, speciality, docId])

    if (relDoc.length === 0) {
        return null
    }

    return (
        <div className='py-12 mt-8 fade-in'>
            {/* Section Header */}
            <div className='text-center mb-8'>
                <h2 className='section-title'>Related Doctors</h2>
                <p className='section-subtitle max-w-xl mx-auto'>
                    Discover other trusted {speciality} specialists who can provide excellent care.
                </p>
            </div>

            {/* Doctor Cards Grid */}
            <div className='doctors-grid'>
                {relDoc.slice(0, 4).map((item, index) => {
                    // Skip rendering if item is null or missing required fields
                    if (!item || !item._id || !item.name) return null
                    
                    return (
                    <div 
                        onClick={() => handleDoctorClick(item)} 
                        className='doctor-card slide-in-up'
                        key={item._id || index}
                        style={{ animationDelay: `${index * 0.1}s` }}
                    >
                        {/* Image Container */}
                        <div className='relative overflow-hidden'>
                            <img 
                                className='doctor-card-image' 
                                src={item.image} 
                                alt={item.name} 
                            />
                            {/* Availability Badge */}
                            <div className='absolute top-2 right-2'>
                                {(() => {
                                    // Safely check availability with null safety
                                    const isAvailable = item && (item.available === true || item.available === 'true')
                                    return (
                                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium ${
                                            isAvailable 
                                                ? 'bg-green-100 text-green-700' 
                                                : 'bg-gray-100 text-gray-600'
                                        }`}>
                                            <span className={`w-1.5 h-1.5 rounded-full ${isAvailable ? 'bg-green-500' : 'bg-gray-400'}`}></span>
                                            {isAvailable ? 'Available' : 'Unavailable'}
                                        </span>
                                    )
                                })()}
                            </div>
                        </div>

                        {/* Card Content */}
                        <div className='doctor-card-content'>
                            <h3 className='doctor-card-name'>
                                {getDoctorNameWithMD(item.name, index, item.degree || item.qualification)}
                            </h3>
                            <p className='doctor-card-specialty'>{item.speciality}</p>
                            
                            {/* Experience Badge */}
                            {item.experience && (() => {
                                const badge = getExperienceBadge(item.experience)
                                const experienceNum = parseInt(item.experience) || 0
                                return (
                                    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${badge.bg} ${badge.border} ${badge.shadow} shadow-sm mt-2`}>
                                        <div className={`flex items-center justify-center w-3.5 h-3.5 rounded-full ${badge.iconBg}`}>
                                            <svg className='w-2 h-2 text-white' fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                        </div>
                                        <span className={`text-[10px] font-semibold ${badge.color}`}>
                                            {badge.label} • {experienceNum} {experienceNum !== 1 ? 'Yrs' : 'Yr'}
                                        </span>
                                    </div>
                                )
                            })()}
                            
                            {/* Book Appointment Button */}
                            <button 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleDoctorClick(item);
                                }}
                                className='w-full mt-auto h-11 px-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg shadow-sm hover:shadow-md transition-all duration-200 flex items-center justify-center gap-1.5'
                            >
                                <svg className='w-3.5 h-3.5' fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                Book Appointment
                            </button>
                        </div>
                    </div>
                    )
                })}
            </div>

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

export default RelatedDoctors
