import React, { useContext, useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { AppContext } from '../context/AppContext'
import axios from 'axios'
import { toast } from 'react-toastify'
import LoadingSpinner from '../components/LoadingSpinner'
import BackButton from '../components/BackButton'
import BackArrow from '../components/BackArrow'
import BrandLogo from '../components/BrandLogo'

const VerifyAppointment = () => {
    const [searchParams] = useSearchParams()
    const navigate = useNavigate()
    const { backendUrl } = useContext(AppContext)
    const [appointmentData, setAppointmentData] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    const appointmentId = searchParams.get('id')

    useEffect(() => {
        const fetchAppointmentDetails = async () => {
            if (!appointmentId) {
                setError('Appointment ID is missing')
                setLoading(false)
                return
            }

            try {
                // Fetch appointment details from backend (public endpoint)
                const { data } = await axios.get(`${backendUrl}/api/user/appointment/verify/${appointmentId}`)

                if (data && data.success) {
                    setAppointmentData(data.appointment)
                } else {
                    setError(data?.message || 'Appointment not found')
                }
            } catch (error) {
                console.error('Error fetching appointment:', error)
                const errorMessage = error?.response?.data?.message || error?.message || 'Unable to fetch appointment details'
                setError(errorMessage)
            } finally {
                setLoading(false)
            }
        }

        fetchAppointmentDetails()
    }, [appointmentId, backendUrl])

    if (loading) {
        return <LoadingSpinner fullScreen text="Loading appointment details..." />
    }

    if (error && !appointmentData) {
        return (
            <div className="page-container fade-in">
                <div className="flex items-center gap-4">
                    <BackArrow />
                    <BackButton to="/" label="Back to Home" />
                </div>
                <div className="empty-state card mt-6">
                    <svg className="empty-state-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <h3 className="empty-state-title">Appointment Not Found</h3>
                    <p className="empty-state-text">{error}</p>
                    {appointmentId && (
                        <p className="text-sm text-gray-500 mt-2">Appointment ID: {appointmentId}</p>
                    )}
                </div>
            </div>
        )
    }

    const appointment = appointmentData || {}
    const patient = appointment.actualPatient || appointment.userData || {}
    const doctor = appointment.docData || {}

    return (
        <div className="page-container fade-in">
            <div className="flex items-center gap-4 mb-6">
                <BackArrow />
                <BackButton to="/" label="Back to Home" />
            </div>

            <div className="card mt-6 max-w-4xl mx-auto">
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-500 via-blue-600 to-purple-600 text-white p-6 rounded-t-2xl">
                    <div className="flex items-center justify-between">
                        <div>
                            <BrandLogo size="small" variant="header" clickable={false} className="brightness-0 invert mb-2" />
                            <h1 className="text-2xl font-bold">Appointment Verification</h1>
                            <p className="text-blue-100 text-sm mt-1">Scan QR Code to view details</p>
                        </div>
                        <div className="bg-green-500 px-4 py-2 rounded-lg flex items-center gap-2">
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                            </svg>
                            <span className="font-bold text-sm">VERIFIED</span>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6">
                    {/* Appointment ID */}
                    <div className="mb-6 pb-4 border-b border-gray-200">
                        <p className="text-sm text-gray-500 mb-1">Appointment ID</p>
                        <p className="font-mono text-lg font-bold text-gray-900">{appointmentId || 'N/A'}</p>
                    </div>

                    {/* Patient Details Section */}
                    <div className="mb-6">
                        <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            Patient Details
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-gray-50 rounded-lg p-4">
                                <p className="text-sm text-gray-500 mb-1">Full Name</p>
                                <p className="font-semibold text-gray-900">{patient.name || 'N/A'}</p>
                            </div>
                            <div className="bg-gray-50 rounded-lg p-4">
                                <p className="text-sm text-gray-500 mb-1">Age</p>
                                <p className="font-semibold text-gray-900">{patient.age || 'N/A'}</p>
                            </div>
                            <div className="bg-gray-50 rounded-lg p-4">
                                <p className="text-sm text-gray-500 mb-1">Gender</p>
                                <p className="font-semibold text-gray-900">{patient.gender || 'N/A'}</p>
                            </div>
                            <div className="bg-gray-50 rounded-lg p-4">
                                <p className="text-sm text-gray-500 mb-1">Phone Number</p>
                                <p className="font-semibold text-gray-900">{patient.phone || 'N/A'}</p>
                            </div>
                            {patient.relationship && (
                                <div className="bg-gray-50 rounded-lg p-4">
                                    <p className="text-sm text-gray-500 mb-1">Relationship</p>
                                    <p className="font-semibold text-gray-900">{patient.relationship}</p>
                                </div>
                            )}
                        </div>

                        {/* Medical History */}
                        {patient.medicalHistory && patient.medicalHistory.length > 0 && (
                            <div className="mt-4 bg-gray-50 rounded-lg p-4">
                                <p className="text-sm text-gray-500 mb-2">Medical History</p>
                                <div className="flex flex-wrap gap-2">
                                    {patient.medicalHistory.map((condition, index) => (
                                        <span key={index} className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                                            {condition}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Symptoms */}
                        {patient.symptoms && (
                            <div className="mt-4 bg-gray-50 rounded-lg p-4">
                                <p className="text-sm text-gray-500 mb-2">Current Symptoms</p>
                                <p className="text-gray-900">{patient.symptoms}</p>
                            </div>
                        )}
                    </div>

                    {/* Doctor Details Section */}
                    <div className="mb-6">
                        <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                            </svg>
                            Doctor Details
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-gray-50 rounded-lg p-4">
                                <p className="text-sm text-gray-500 mb-1">Doctor Name</p>
                                <p className="font-semibold text-gray-900">{doctor.name || 'N/A'}</p>
                            </div>
                            <div className="bg-gray-50 rounded-lg p-4">
                                <p className="text-sm text-gray-500 mb-1">Specialty</p>
                                <p className="font-semibold text-gray-900">{doctor.speciality || doctor.specialization || 'N/A'}</p>
                            </div>
                        </div>
                    </div>

                    {/* Appointment Details Section */}
                    <div className="mb-6">
                        <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            Appointment Details
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-gray-50 rounded-lg p-4">
                                <p className="text-sm text-gray-500 mb-1">Date</p>
                                <p className="font-semibold text-gray-900">
                                    {appointment.slotDate
                                        ? (() => {
                                            const dateArray = appointment.slotDate.split('_')
                                            const day = dateArray[0]
                                            const month = dateArray[1]
                                            const year = dateArray[2]
                                            const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
                                            return `${day} ${monthNames[parseInt(month) - 1]} ${year}`
                                        })()
                                        : 'N/A'
                                    }
                                </p>
                            </div>
                            <div className="bg-gray-50 rounded-lg p-4">
                                <p className="text-sm text-gray-500 mb-1">Time</p>
                                <p className="font-semibold text-gray-900">{appointment.slotTime || 'N/A'}</p>
                            </div>
                            {appointment.tokenNumber && (
                                <div className="bg-gray-50 rounded-lg p-4">
                                    <p className="text-sm text-gray-500 mb-1">Token Number</p>
                                    <p className="font-semibold text-gray-900">#{appointment.tokenNumber}</p>
                                </div>
                            )}
                            <div className="bg-gray-50 rounded-lg p-4">
                                <p className="text-sm text-gray-500 mb-1">Consultation Fee</p>
                                <p className="font-semibold text-gray-900">₹{appointment.amount || 0}</p>
                            </div>
                        </div>
                    </div>

                    {/* Status */}
                    {appointment.status && (
                        <div className="mb-6">
                            <p className="text-sm text-gray-500 mb-2">Status</p>
                            <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-semibold ${appointment.status === 'completed'
                                    ? 'bg-green-100 text-green-700'
                                    : appointment.status === 'cancelled'
                                        ? 'bg-red-100 text-red-700'
                                        : 'bg-blue-100 text-blue-700'
                                }`}>
                                {appointment.status === 'completed' && (
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                )}
                                {appointment.status.charAt(0).toUpperCase() + appointment.status.slice(1)}
                            </span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

export default VerifyAppointment

