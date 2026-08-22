import React, { useState, useContext, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AppContext } from '../context/AppContext'
import { toast } from 'react-toastify'
import axios from 'axios'

import { createPortal } from 'react-dom'

const AppointmentBookingModal = ({ doctor, isOpen, onClose, onProceed }) => {
    const { userData, token, backendUrl } = useContext(AppContext)
    const [bookingFor, setBookingFor] = useState(null) // 'myself' or 'someone-else'
    const [savedProfiles, setSavedProfiles] = useState([])
    const [selectedProfile, setSelectedProfile] = useState(null)
    const [showPatientForm, setShowPatientForm] = useState(false)
    const [patientData, setPatientData] = useState({
        name: '',
        age: '',
        gender: '',
        relationship: '',
        medicalHistory: [],
        symptoms: '',
        phone: '',
        prescription: null,
        isSelf: false
    })

    // Load saved profiles
    useEffect(() => {
        if (token && isOpen) {
            loadSavedProfiles()
        }
    }, [token, isOpen])

    // Prevent body scroll when modal is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden'
            return () => {
                document.body.style.overflow = ''
            }
        }
    }, [isOpen])

    const loadSavedProfiles = async () => {
        try {
            const { data } = await axios.get(`${backendUrl}/api/user/saved-profiles`, {
                headers: { token }
            })
            if (data && data.success) {
                setSavedProfiles(data.profiles || [])
            }
        } catch (error) {
            // Endpoint doesn't exist yet - this is optional functionality
            // Silently fail and continue without saved profiles
            setSavedProfiles([])
        }
    }

    const handleBookingFor = (option) => {
        if (!doctor || !doctor._id) {
            toast.error('Doctor information is missing. Please try again.')
            return
        }

        setBookingFor(option)
        if (option === 'myself') {
            // Auto-fill from user profile
            if (userData) {
                const patientInfo = {
                    name: userData.name || '',
                    age: userData.age || '',
                    gender: userData.gender || '',
                    relationship: 'Self',
                    medicalHistory: [],
                    symptoms: '',
                    phone: userData.phone || '',
                    prescription: null,
                    isSelf: true
                }
                setPatientData(patientInfo)
                // Proceed directly to time slots
                setTimeout(() => {
                    if (doctor && doctor._id) {
                        onProceed(doctor._id, patientInfo)
                        onClose()
                    } else {
                        toast.error('Doctor ID not found')
                    }
                }, 300)
            } else {
                toast.error('Please complete your profile first')
            }
        } else {
            setShowPatientForm(true)
        }
    }

    const handleSelectProfile = (profile) => {
        if (!doctor || !doctor._id) {
            toast.error('Doctor information is missing. Please try again.')
            return
        }

        if (!profile || !profile.name) {
            toast.error('Invalid profile selected')
            return
        }

        setSelectedProfile(profile)
        setPatientData({
            name: profile.name || '',
            age: profile.age || '',
            gender: profile.gender || '',
            relationship: profile.relationship || '',
            medicalHistory: profile.medicalHistory || [],
            symptoms: '',
            phone: profile.phone || '',
            prescription: null,
            isSelf: false
        })
    }

    const handleInputChange = (e) => {
        const { name, value } = e.target
        setPatientData(prev => ({
            ...prev,
            [name]: value
        }))
    }

    const handleMedicalHistoryChange = (condition) => {
        setPatientData(prev => ({
            ...prev,
            medicalHistory: prev.medicalHistory.includes(condition)
                ? prev.medicalHistory.filter(c => c !== condition)
                : [...prev.medicalHistory, condition]
        }))
    }

    const handlePrescriptionUpload = (e) => {
        const file = e.target.files[0]
        if (file) {
            if (file.size > 5 * 1024 * 1024) { // 5MB limit
                toast.error('File size must be less than 5MB')
                return
            }
            const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf']
            if (!allowedTypes.includes(file.type)) {
                toast.error('Only PDF, JPG, and PNG files are allowed')
                return
            }
            setPatientData(prev => ({
                ...prev,
                prescription: file
            }))
        }
    }

    const removePrescription = () => {
        setPatientData(prev => ({
            ...prev,
            prescription: null
        }))
    }

    const handleFormSubmit = (e) => {
        e.preventDefault()

        if (!doctor || !doctor._id) {
            toast.error('Doctor information is missing. Please try again.')
            return
        }

        // Validate required fields
        if (!patientData.name || !patientData.name.trim()) {
            toast.error('Please enter patient name')
            return
        }
        if (!patientData.age || !patientData.age.toString().trim()) {
            toast.error('Please enter patient age')
            return
        }
        if (!patientData.gender || !patientData.gender.trim()) {
            toast.error('Please select patient gender')
            return
        }
        if (!patientData.relationship || !patientData.relationship.trim()) {
            toast.error('Please select relationship')
            return
        }

        // Proceed to time slots
        onProceed(doctor._id, {
            ...patientData,
            name: patientData.name.trim(),
            age: patientData.age.toString().trim(),
            gender: patientData.gender.trim(),
            relationship: patientData.relationship.trim(),
            phone: patientData.phone ? patientData.phone.trim() : '',
            symptoms: patientData.symptoms ? patientData.symptoms.trim() : '',
            isSelf: false
        })
        onClose()
    }

    const medicalHistoryOptions = [
        'Diabetes', 'Hypertension', 'Heart Disease', 'Asthma', 'Allergies',
        'Thyroid', 'Kidney Disease', 'Liver Disease', 'Cancer', 'None'
    ]

    const relationshipOptions = [
        'Father', 'Mother', 'Brother', 'Sister', 'Wife', 'Husband', 'Child', 'Friend', 'Other'
    ]

    // Safety check - if no doctor or doctor._id, don't render
    if (!doctor || !doctor._id) {
        return null
    }

    if (!isOpen) return null

    return createPortal(
        <AnimatePresence>
            {/* Viewport lock wrapper */}
            <div
                style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100vw',
                    height: '100vh',
                    zIndex: 999999998,
                }}
            >
                {/* Full-screen backdrop */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(0, 0, 0, 0.6)',
                        backdropFilter: 'blur(4px)',
                        zIndex: 1,
                    }}
                />

                {/* Centered Modal Card using absolute margin auto technique */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                        position: 'absolute',
                        top: 0,
                        bottom: 0,
                        left: 0,
                        right: 0,
                        margin: 'auto',
                        width: 'calc(100% - 2rem)',
                        maxWidth: '672px',
                        height: 'max-content',
                        maxHeight: '90vh',
                        overflowY: 'auto',
                        borderRadius: '1rem',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                        backgroundColor: '#ffffff',
                        zIndex: 2,
                    }}
                >
                    {/* Header - Blue to Purple Gradient */}
                    <div className="sticky top-0 bg-gradient-to-r from-blue-500 via-blue-600 to-purple-600 text-white p-4 sm:p-6 rounded-t-2xl z-10">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-xl sm:text-2xl font-bold">Book Appointment</h2>
                                <p className="text-blue-100 text-[10px] sm:text-sm mt-0.5 sm:mt-1">with {doctor?.name || 'Doctor'}</p>
                            </div>
                            <button
                                onClick={onClose}
                                className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
                            >
                                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="p-4 sm:p-6 relative z-0">
                        {!showPatientForm && bookingFor === null && (
                            <>
                                {/* Initial Question - Matching Image Design */}
                                <div className="text-center mb-8">
                                    <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-cyan-100 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-blue-200">
                                        <svg className="w-10 h-10 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                        </svg>
                                    </div>
                                    <h3 className="text-xl font-bold text-gray-800 mb-2">Who is this appointment for?</h3>
                                    <p className="text-gray-600 text-sm">Select an option to continue</p>
                                </div>

                                {/* Options - Perfect Match to Image */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                                    {/* Left Card - Light Blue/Green Gradient */}
                                    <motion.button
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        onClick={() => handleBookingFor('myself')}
                                        className="p-6 bg-gradient-to-br from-blue-50 via-cyan-50 to-green-50 border-2 border-blue-200 rounded-xl hover:border-blue-400 hover:shadow-md transition-all text-left group"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform shadow-sm">
                                                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                                </svg>
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-gray-800 text-base">Book for Myself</h4>
                                                <p className="text-sm text-gray-600 mt-1">Use my profile details</p>
                                            </div>
                                        </div>
                                    </motion.button>

                                    {/* Right Card - Light Pink/Purple Gradient */}
                                    <motion.button
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        onClick={() => handleBookingFor('someone-else')}
                                        className="p-6 bg-gradient-to-br from-pink-50 via-purple-50 to-purple-50 border-2 border-pink-200 rounded-xl hover:border-purple-400 hover:shadow-md transition-all text-left group"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform shadow-sm">
                                                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                                                </svg>
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-gray-800 text-base">Book for Someone Else</h4>
                                                <p className="text-sm text-gray-600 mt-1">Enter patient details</p>
                                            </div>
                                        </div>
                                    </motion.button>
                                </div>

                                {/* Saved Profiles */}
                                {savedProfiles.length > 0 && (
                                    <div className="mt-6 pt-6 border-t border-gray-200">
                                        <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                                            <svg className="w-4 h-4 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                                            </svg>
                                            Saved Profiles
                                        </h4>
                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                            {savedProfiles.map((profile, idx) => (
                                                <motion.button
                                                    key={idx}
                                                    whileHover={{ scale: 1.05 }}
                                                    whileTap={{ scale: 0.95 }}
                                                    onClick={() => handleSelectProfile(profile)}
                                                    className={`p-3 rounded-lg border-2 transition-all text-left ${selectedProfile?._id === profile._id
                                                        ? 'border-cyan-500 bg-cyan-50'
                                                        : 'border-gray-200 bg-white hover:border-cyan-300'
                                                        }`}
                                                >
                                                    <p className="font-semibold text-sm text-gray-800">{profile.name}</p>
                                                    <p className="text-xs text-gray-600 mt-1">{profile.relationship} • {profile.age} years</p>
                                                </motion.button>
                                            ))}
                                        </div>
                                        {selectedProfile && (
                                            <button
                                                onClick={() => {
                                                    if (!doctor || !doctor._id) {
                                                        toast.error('Doctor information is missing. Please try again.')
                                                        return
                                                    }
                                                    if (!patientData.name || !patientData.age || !patientData.gender || !patientData.relationship) {
                                                        toast.error('Please ensure all profile fields are filled')
                                                        return
                                                    }
                                                    onProceed(doctor._id, {
                                                        ...patientData,
                                                        isSelf: false
                                                    })
                                                    onClose()
                                                }}
                                                className="mt-4 w-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white py-3 rounded-xl font-semibold hover:shadow-lg transition-all"
                                            >
                                                Continue with {selectedProfile.name}
                                            </button>
                                        )}
                                    </div>
                                )}
                            </>
                        )}

                        {/* Patient Form */}
                        {showPatientForm && (
                            <motion.form
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                onSubmit={handleFormSubmit}
                                className="space-y-5"
                            >
                                <div className="flex items-center gap-2 mb-4">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowPatientForm(false)
                                            setBookingFor(null)
                                            setPatientData({
                                                name: '', age: '', gender: '', relationship: '',
                                                medicalHistory: [], symptoms: '', phone: '', prescription: null, isSelf: false
                                            })
                                        }}
                                        className="text-cyan-600 hover:text-cyan-700"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                        </svg>
                                    </button>
                                    <h3 className="text-lg font-bold text-gray-800">Patient Information</h3>
                                </div>

                                {/* Name */}
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Full Name *</label>
                                    <input
                                        type="text"
                                        name="name"
                                        value={patientData.name}
                                        onChange={handleInputChange}
                                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
                                        placeholder="Enter patient's full name"
                                        required
                                    />
                                </div>

                                {/* Age and Gender */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">Age *</label>
                                        <input
                                            type="number"
                                            name="age"
                                            value={patientData.age}
                                            onChange={handleInputChange}
                                            min="1"
                                            max="120"
                                            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
                                            placeholder="Age"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">Gender *</label>
                                        <select
                                            name="gender"
                                            value={patientData.gender}
                                            onChange={handleInputChange}
                                            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
                                            required
                                        >
                                            <option value="">Select</option>
                                            <option value="Male">Male</option>
                                            <option value="Female">Female</option>
                                            <option value="Other">Other</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Relationship */}
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Relationship *</label>
                                    <select
                                        name="relationship"
                                        value={patientData.relationship}
                                        onChange={handleInputChange}
                                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
                                        required
                                    >
                                        <option value="">Select relationship</option>
                                        {relationshipOptions.map(rel => (
                                            <option key={rel} value={rel}>{rel}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Medical History */}
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Medical History</label>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                        {medicalHistoryOptions.map(condition => (
                                            <label key={condition} className="flex items-center gap-2 p-2 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={patientData.medicalHistory.includes(condition)}
                                                    onChange={() => handleMedicalHistoryChange(condition)}
                                                    className="w-4 h-4 text-cyan-600 focus:ring-cyan-500"
                                                />
                                                <span className="text-sm text-gray-700">{condition}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                {/* Current Symptoms */}
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Current Symptoms</label>
                                    <textarea
                                        name="symptoms"
                                        value={patientData.symptoms}
                                        onChange={handleInputChange}
                                        rows={3}
                                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none resize-none"
                                        placeholder="Describe current symptoms or concerns..."
                                    />
                                </div>

                                {/* Phone */}
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Phone Number (Optional)</label>
                                    <input
                                        type="tel"
                                        name="phone"
                                        value={patientData.phone}
                                        onChange={handleInputChange}
                                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
                                        placeholder="+91 1234567890"
                                    />
                                </div>

                                {/* Prescription Upload */}
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Upload Recent Prescription (Optional)</label>
                                    {!patientData.prescription ? (
                                        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-cyan-500 hover:bg-cyan-50 transition-all">
                                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                                <svg className="w-10 h-10 mb-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                                </svg>
                                                <p className="mb-2 text-sm text-gray-500">Click to upload or drag and drop</p>
                                                <p className="text-xs text-gray-500">PDF, JPG, or PNG (MAX. 5MB)</p>
                                            </div>
                                            <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png" onChange={handlePrescriptionUpload} />
                                        </label>
                                    ) : (
                                        <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
                                            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                            </svg>
                                            <div className="flex-1">
                                                <p className="text-sm font-medium text-gray-800">{patientData.prescription.name}</p>
                                                <p className="text-xs text-gray-500">{(patientData.prescription.size / 1024).toFixed(2)} KB</p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const url = URL.createObjectURL(patientData.prescription);
                                                        window.open(url, '_blank');
                                                    }}
                                                    className="p-2 text-cyan-600 hover:bg-cyan-50 rounded-lg transition-all"
                                                    title="View Prescription"
                                                >
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                    </svg>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={removePrescription}
                                                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                                    title="Remove"
                                                >
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                    </svg>
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Submit Button */}
                                <div className="flex flex-col sm:flex-row gap-3 pt-4">
                                    <button
                                        type="button"
                                        onClick={onClose}
                                        className="order-2 sm:order-1 flex-1 px-4 py-3 border-2 border-gray-300 text-gray-700 rounded-xl text-sm font-bold hover:bg-gray-50 transition-all active:scale-95"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="order-1 sm:order-2 flex-[1.5] px-4 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl text-sm font-bold hover:shadow-lg transition-all active:scale-95"
                                    >
                                        Continue
                                    </button>
                                </div>
                            </motion.form>
                        )}
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>,
        document.body
    )
}

export default AppointmentBookingModal

