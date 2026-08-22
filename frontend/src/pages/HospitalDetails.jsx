import React, { useContext, useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { AppContext } from '../context/AppContext'
import axios from 'axios'
import { SkeletonCard } from '../components/LoadingSpinner'
import { toast } from 'react-toastify'
import { getExperienceBadge } from '../utils/experienceBadge'
import AppointmentBookingModal from '../components/AppointmentBookingModal'

const HospitalDetails = () => {
    const { id } = useParams()
    const { backendUrl, token } = useContext(AppContext)
    const [hospital, setHospital] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [selectedDoctor, setSelectedDoctor] = useState(null)
    const [showBookingModal, setShowBookingModal] = useState(false)
    const navigate = useNavigate()

    // Helper to get doctor image - only use doctor's uploaded image, no hardcoded photos
    const getDoctorImage = (doc) => {
        // Only return image if it exists and is a valid uploaded image
        // Doctors should upload their own photos in their doctor panel
        if (doc.image &&
            doc.image.trim() !== '' &&
            !doc.image.includes('data:image/png;base64') &&
            !doc.image.includes('placeholder')) {
            return doc.image;
        }
        // Return null/empty if no image - will show placeholder
        return null;
    }

    // Get specialty title
    const getSpecialtyTitle = (specialty) => {
        if (!specialty) return 'Medical Specialist'
        const titleMap = {
            'Cardiology': 'Head of Cardiologist',
            'Cardiologist': 'Head of Cardiologist',
            'Orthopedics': 'Orthopedic Surgeon',
            'Orthopedic': 'Orthopedic Surgeon',
            'Psychiatry': 'Psychiatrist',
            'Psychiatrist': 'Psychiatrist',
            'Ophthalmology': 'Ophthalmologist',
            'Ophthalmologist': 'Ophthalmologist',
            'ENT': 'ENT Specialist',
            'Pediatrics': 'Board-certified Pediatrician',
            'Pediatricians': 'Board-certified Pediatrician',
            'General Medicine': 'General Physician',
            'General physician': 'General Physician',
            'Dentist': 'Dentist',
            'Dermatologist': 'Dermatologist'
        }
        return titleMap[specialty] || `${specialty} Specialist`
    }

    // Get expertise description based on specialty
    const getExpertiseText = (specialty) => {
        if (!specialty) return 'With extensive experience in providing quality healthcare services'
        const expertiseMap = {
            'Cardiology': 'With expertise in managing complex heart conditions and performing advanced cardiac procedures',
            'Cardiologist': 'With expertise in managing complex heart conditions and performing advanced cardiac procedures',
            'Orthopedics': 'With expertise in treating bone, joint, and muscle injuries and disorders',
            'Orthopedic': 'With expertise in treating bone, joint, and muscle injuries and disorders',
            'Psychiatry': 'With expertise in treating mental health conditions and providing compassionate care',
            'Psychiatrist': 'With expertise in treating mental health conditions and providing compassionate care',
            'Ophthalmology': 'With expertise in diagnosing and treating eye conditions and vision problems',
            'Ophthalmologist': 'With expertise in diagnosing and treating eye conditions and vision problems',
            'ENT': 'With expertise in treating ear, nose, and throat disorders',
            'Pediatrics': 'With experience in managing complex medical conditions in children',
            'Pediatricians': 'With experience in managing complex medical conditions in children',
            'General Medicine': 'With expertise in treating acute illnesses and injuries',
            'General physician': 'With expertise in treating acute illnesses and injuries',
            'Dentist': 'With expertise in dental care, oral health, and cosmetic dentistry',
            'Dermatologist': 'With expertise in treating skin conditions and disorders'
        }
        return expertiseMap[specialty] || `With extensive experience in ${specialty} and providing quality healthcare services`
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

    const handleBookAppointment = (doctor) => {
        if (!token) {
            toast.warn('Please Login to Book Appointment', {
                position: "top-center",
                autoClose: 5000,
                hideProgressBar: false,
                closeOnClick: true,
                pauseOnHover: true,
                draggable: true,
                progress: undefined,
                theme: "light",
            });
            navigate('/login?mode=login')
            return
        }

        // Check if available as string or boolean
        const isAvailable = doctor.available === true || doctor.available === 'true';

        if (!isAvailable) {
            toast.error('Doctor is not available at the moment')
            return
        }

        // Show booking modal first (Self or Others)
        const doctorId = doctor._id || doctor.id
        if (doctorId) {
            setSelectedDoctor({
                ...doctor,
                _id: doctorId,
                hospitalName: hospital?.name,
                hospital_name: hospital?.name,
                hospital_id: hospital?.id || id,
                location: hospital?.address
            })
            setShowBookingModal(true)
        } else {
            toast.error('Doctor ID not found. Please try again.')
        }
    }

    useEffect(() => {
        const fetchHospitalDetails = async () => {
            try {
                const { data } = await axios.get(`${backendUrl}/api/hospital-tieup/details/${id}`)
                if (data.success) {
                    setHospital(data.hospital)
                } else {
                    setError('Hospital not found')
                }
            } catch (err) {
                setError(err.message)
            } finally {
                setLoading(false)
            }
        }
        fetchHospitalDetails()
    }, [backendUrl, id])

    if (loading) {
        return (
            <div className='min-h-screen bg-white'>
                <div className='page-container fade-in pt-24'>
                    <div className="bg-white/40 backdrop-blur-md rounded-[2.5rem] p-8 border border-white/60 h-72 animate-pulse"></div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 mt-8">
                        {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="h-72 bg-white/40 backdrop-blur-md rounded-3xl animate-pulse border border-white/60"></div>)}
                    </div>
                </div>
            </div>
        )
    }

    if (error || !hospital) {
        return (
            <div className='min-h-screen bg-white flex items-center justify-center'>
                <div className="text-center bg-white/60 backdrop-blur-xl p-16 rounded-[3rem] border border-white shadow-2xl max-w-lg mx-4">
                    <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-8 shadow-sm">
                        <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                    </div>
                    <h2 className="text-3xl font-black text-slate-900 mb-4 tracking-tight uppercase">Registry Access Error</h2>
                    <p className="text-slate-600 mb-10 font-bold leading-relaxed">{error || "The requested institution record is currently being verified."}</p>
                    <button onClick={() => navigate('/hospitals')} className="group flex items-center justify-center gap-3 w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-blue-600 transition-all duration-300">
                        Return to Directory
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className='min-h-screen bg-white pb-32'>
            <div className='page-container fade-in'>
                {/* Hospital Header - Enhanced Design */}
                <div className="bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-700 text-white pt-6 pb-5 px-4 sm:px-6 relative overflow-hidden rounded-lg mb-6 shadow-md">
                    <div className="max-w-7xl mx-auto relative z-10">
                        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                            <div className="flex-1">
                                {/* Badges */}
                                <div className="flex flex-wrap items-center gap-2 mb-3">
                                    <span className="bg-white/20 backdrop-blur-sm text-white text-[9px] font-semibold px-2 py-1 rounded-full border border-white/30 uppercase tracking-wide">
                                        {hospital.type || 'GENERAL'}
                                    </span>
                                    <span className="bg-emerald-500/20 backdrop-blur-sm text-white text-[9px] font-semibold px-2 py-1 rounded-full border border-emerald-300/30 uppercase tracking-wide flex items-center gap-1">
                                        <svg className="w-3 h-3 text-emerald-300" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                        </svg>
                                        Verified Partner
                                    </span>
                                </div>

                                {/* Hospital Name */}
                                <h1 className="text-xl sm:text-2xl md:text-2xl font-bold text-white mb-2 tracking-tight">
                                    {hospital.name}
                                </h1>

                                {/* Specialty */}
                                <div className="mb-2">
                                    <div className="flex items-center gap-2">
                                        <div className="w-5 h-5 rounded bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/20 flex-shrink-0">
                                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                            </svg>
                                        </div>
                                        <p className="text-xs sm:text-sm font-medium text-blue-50">
                                            {hospital.specialization || 'General Medicine'}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Contact Cards - Neat Layout */}
                            <div className="flex flex-col gap-2 w-full lg:w-auto lg:min-w-[200px]">
                                {/* Address - Clickable to Map */}
                                {hospital.address && (
                                    <a
                                        href={hospital.latitude && hospital.longitude 
                                            ? `https://www.google.com/maps/place/${encodeURIComponent(hospital.name)}/@${hospital.latitude},${hospital.longitude},17z`
                                            : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(hospital.name + ' ' + (hospital.address || ''))}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="bg-white/15 backdrop-blur-xl border border-white/30 p-3 rounded-lg hover:bg-white/20 transition-all duration-200 cursor-pointer group"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-white/25 backdrop-blur-sm rounded-lg flex items-center justify-center border border-white/30 flex-shrink-0">
                                                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                                </svg>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[9px] text-blue-200/80 font-medium uppercase tracking-wide mb-1">Location</p>
                                                <p className="text-sm font-semibold text-white truncate group-hover:underline">{hospital.address}</p>
                                            </div>
                                            <svg className="w-3.5 h-3.5 text-white/50 group-hover:text-white transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                            </svg>
                                        </div>
                                    </a>
                                )}

                                {/* Emergency Contact Card */}
                                {hospital.contact && (
                                    <div className="bg-white/15 backdrop-blur-xl border border-white/30 p-3 rounded-lg hover:bg-white/20 transition-all duration-200">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-white/25 backdrop-blur-sm rounded-lg flex items-center justify-center border border-white/30 flex-shrink-0">
                                                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                                </svg>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[9px] text-blue-200/80 font-medium uppercase tracking-wide mb-1">Emergency Contact</p>
                                                <p className="text-sm font-semibold text-white">{hospital.contact}</p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Doctors Section */}
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 border-l-4 border-blue-600 pl-4 gap-3">
                        <div>
                            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight mb-1">Our Doctors</h2>
                            <p className="text-slate-500 text-[10px] font-semibold uppercase tracking-wider">Authorized Staff Roster</p>
                        </div>
                        <div className="text-left sm:text-right">
                            <p className="text-3xl sm:text-4xl font-bold text-blue-600 leading-none">{hospital?.doctors?.length || 0}</p>
                            <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-wide mt-1">Verified Specialists</p>
                        </div>
                    </div>

                    {(hospital?.doctors || []).length === 0 ? (
                        <div className="bg-white/40 backdrop-blur-xl rounded-[3rem] p-24 text-center border border-white border-dashed shadow-sm">
                            <div className="w-24 h-24 bg-white/60 rounded-full flex items-center justify-center mx-auto mb-8 shadow-sm">
                                <svg className="w-12 h-12 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                            </div>
                            <h3 className="text-2xl font-black text-slate-800 mb-2 uppercase tracking-tight">Personnel Directory Empty</h3>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 lg:gap-5">
                            {(hospital?.doctors || []).map((doctor, index) => {
                                const isAvailable = doctor.available === true || doctor.available === 'true';
                                const doctorImage = getDoctorImage(doctor);

                                return (
                                    <div key={doctor.id || doctor._id || index} className="relative bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-blue-300 transition-all duration-300 overflow-hidden group flex flex-col">
                                        {/* Available Badge - Top Right of Card */}
                                        <div className="absolute top-2 right-2 z-10">
                                            {isAvailable ? (
                                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-green-500 text-white">
                                                    <span className="w-1 h-1 rounded-full bg-white"></span>
                                                    Available
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-red-500 text-white">
                                                    <span className="w-1 h-1 rounded-full bg-white"></span>
                                                    On Leave
                                                </span>
                                            )}
                                        </div>
                                        <div className="p-4 flex flex-col items-center text-center">
                                            {/* Circular Headshot */}
                                            <div className="relative mb-3 flex-shrink-0">
                                                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-50 to-cyan-50 p-1">
                                                    {doctorImage ? (
                                                        <img
                                                            src={doctorImage}
                                                            alt={doctor.name}
                                                            className="w-full h-full rounded-full object-cover ring-2 ring-white shadow-sm"
                                                        />
                                                    ) : (
                                                        <div className="w-full h-full rounded-full bg-gray-200 flex items-center justify-center ring-2 ring-white shadow-sm">
                                                            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                                            </svg>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Name and Degree */}
                                            <h3 className="text-sm font-bold text-gray-900 mb-1 line-clamp-2 text-center w-full">
                                                {getDoctorNameWithMD(doctor.name, index, doctor.degree || doctor.qualification)}
                                            </h3>

                                            {/* Specialty/Title */}
                                            <p className="text-xs font-semibold text-gray-700 mb-1 text-center w-full line-clamp-1">
                                                {getSpecialtyTitle(doctor.specialization || doctor.speciality || 'General Medicine')}
                                            </p>

                                            {/* Qualification line removed as it's already in the name */}

                                            {/* Expertise Description removed as requested */}

                                            {/* Book Appointment Button */}
                                            <button
                                                disabled={!isAvailable}
                                                onClick={() => handleBookAppointment(doctor)}
                                                className={`w-full mt-auto h-11 px-3 rounded-lg text-sm font-bold transition-all duration-200 flex items-center justify-center gap-1.5 shadow-sm hover:shadow-md flex-shrink-0 ${isAvailable
                                                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                                                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                                    }`}
                                            >
                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                </svg>
                                                Book Appointment
                                            </button>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Appointment Booking Modal - Self or Others */}
            {selectedDoctor && showBookingModal && (
                <AppointmentBookingModal
                    doctor={selectedDoctor}
                    isOpen={showBookingModal}
                    onClose={() => {
                        setShowBookingModal(false)
                        setSelectedDoctor(null)
                    }}
                    onProceed={(docId, patientInfo) => {
                        sessionStorage.setItem('appointmentPatientData', JSON.stringify(patientInfo))
                        setShowBookingModal(false)
                        setSelectedDoctor(null)
                        navigate(`/appointment/${docId}`, { state: { doctor: selectedDoctor } })
                        window.scrollTo(0, 0)
                    }}
                />
            )}
        </div>
    )
}

export default HospitalDetails
