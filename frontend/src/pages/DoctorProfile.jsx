import React, { useContext, useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { AppContext } from '../context/AppContext'
import { assets } from '../assets/assets'
import BackButton from '../components/BackButton'
import BackArrow from '../components/BackArrow'
import LoadingSpinner from '../components/LoadingSpinner'
import { motion } from 'framer-motion'
import { toast } from 'react-toastify'
import { getExperienceBadge } from '../utils/experienceBadge'
import AppointmentBookingModal from '../components/AppointmentBookingModal'

const DoctorProfile = () => {
    const { docId } = useParams()
    const navigate = useNavigate()
    const { doctors, isDoctorsLoading, currencySymbol, token } = useContext(AppContext)
    const [docInfo, setDocInfo] = useState(null)
    const [showBookingModal, setShowBookingModal] = useState(false)

    useEffect(() => {
        if (doctors.length > 0 && docId) {
            const doctor = doctors.find(doc => doc._id === docId)
            if (doctor) {
                setDocInfo(doctor)
            }
        }
    }, [doctors, docId])

    if (isDoctorsLoading) {
        return <LoadingSpinner fullScreen text="Loading doctor profile..." />
    }

    if (!docInfo) {
        return (
            <div className="page-container">
                <BackButton to="/doctors" label="Back to Doctors" />
                <div className="empty-state card mt-6">
                    <svg className="empty-state-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <h3 className="empty-state-title">Doctor Not Found</h3>
                    <p className="empty-state-text">We couldn't find the doctor you're looking for.</p>
                </div>
            </div>
        )
    }

    const badge = getExperienceBadge(docInfo.experience)

    return (
        <div className="page-container fade-in">
            {/* Back Arrow Button */}
            <div className="mb-6 flex items-center gap-4">
                <BackArrow />
                <BackButton to="/doctors" label="Back to Doctors" />
            </div>

            {/* Doctor Profile Card */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="card mb-6 overflow-hidden"
            >
                {/* Header Section with Gradient */}
                <div className="bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-600 text-white p-6 sm:p-8">
                    <div className="flex flex-col md:flex-row gap-6 items-start md:items-center">
                        {/* Doctor Photo */}
                        <div className="flex-shrink-0 mx-auto md:mx-0">
                            <div className="relative">
                                <div className="absolute inset-0 bg-white/20 rounded-full blur-xl"></div>
                                <img 
                                    src={docInfo.image} 
                                    alt={docInfo.name}
                                    className="relative w-32 h-32 sm:w-40 sm:h-40 rounded-full object-cover border-4 border-white/30 shadow-xl"
                                />
                                {/* Availability Badge */}
                                <div className={`absolute bottom-2 right-2 w-6 h-6 rounded-full border-4 border-white ${
                                    docInfo.available ? 'bg-green-500' : 'bg-gray-400'
                                }`}></div>
                            </div>
                        </div>

                        {/* Doctor Info */}
                        <div className="flex-1 text-center md:text-left">
                            <div className="flex items-center justify-center md:justify-start gap-2 mb-2">
                                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold">
                                    {docInfo.name}
                                </h1>
                                <img className="w-6 h-6" src={assets.verified_icon} alt="Verified" />
                            </div>
                            <p className="text-lg sm:text-xl text-cyan-100 mb-3">
                                {docInfo.degree} - {docInfo.speciality}
                            </p>
                            <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
                                <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border-2 ${badge.bg} ${badge.border} ${badge.shadow} shadow-sm`}>
                                    <span className="text-lg">{badge.emoji}</span>
                                    <span className={`text-sm font-semibold ${badge.color}`}>
                                        {badge.label} ({docInfo.experience} {typeof docInfo.experience === 'number' && docInfo.experience === 1 ? 'Year' : 'Years'})
                                    </span>
                                </div>
                                {docInfo.hospital && (
                                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-sm">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                        </svg>
                                        <span className="text-sm font-medium">{docInfo.hospital}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main Content */}
                <div className="p-6 sm:p-8">
                    {/* About Section */}
                    <div className="mb-6 pb-6 border-b border-gray-200">
                        <h2 className="text-xl font-bold text-gray-900 mb-3 flex items-center gap-2">
                            <svg className="w-5 h-5 text-cyan-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            About
                        </h2>
                        <p className="text-gray-700 leading-relaxed">{docInfo.about}</p>
                    </div>

                    {/* Qualifications */}
                    <div className="mb-6 pb-6 border-b border-gray-200">
                        <h2 className="text-xl font-bold text-gray-900 mb-3 flex items-center gap-2">
                            <svg className="w-5 h-5 text-cyan-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
                            </svg>
                            Qualifications
                        </h2>
                        <p className="text-gray-700">{docInfo.degree}</p>
                    </div>

                    {/* Fee */}
                    <div className="mb-6">
                        <div className="inline-flex items-center gap-2 bg-cyan-50 px-4 py-2 rounded-lg">
                            <span className="text-gray-600 font-medium text-sm sm:text-base">Consultation Fee:</span>
                            <span className="text-lg sm:text-xl font-bold text-cyan-600">{currencySymbol}{docInfo.fees}</span>
                        </div>
                    </div>
                </div>

            </motion.div>

            {/* Book Appointment Button - Redirects to Appointment Page */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="card"
            >
                <div className="p-6 sm:p-8 text-center">
                    <h2 className="text-2xl font-bold text-gray-900 mb-4">Ready to Book an Appointment?</h2>
                    <p className="text-gray-600 mb-6">Click below to select your preferred date and time slot</p>
                    <button
                        onClick={() => {
                            if (!token) {
                                toast.warning('Please login to book an appointment')
                                navigate('/login')
                                return
                            }
                            // Show booking modal first (Self or Others)
                            setShowBookingModal(true)
                        }}
                        className="w-full sm:w-auto px-8 py-4 rounded-xl font-semibold text-white shadow-lg transition-all duration-200 flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 hover:shadow-xl cursor-pointer mx-auto"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        Book Appointment
                    </button>
                </div>
            </motion.div>

            {/* Appointment Booking Modal - Self or Others */}
            {docInfo && showBookingModal && (
                <AppointmentBookingModal
                    doctor={docInfo}
                    isOpen={showBookingModal}
                    onClose={() => {
                        setShowBookingModal(false)
                    }}
                    onProceed={(docId, patientInfo) => {
                        sessionStorage.setItem('appointmentPatientData', JSON.stringify(patientInfo))
                        setShowBookingModal(false)
                        navigate(`/appointment/${docId}`, { state: { doctor: docInfo } })
                        window.scrollTo(0, 0)
                    }}
                />
            )}
        </div>
    )
}

export default DoctorProfile

