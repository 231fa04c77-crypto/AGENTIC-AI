import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import QRCode from 'react-qr-code'
import html2canvas from 'html2canvas'
import { toast } from 'react-toastify'
import { getExperienceBadge } from '../utils/experienceBadge'

/**
 * DoctorAppointmentBooking Component
 * 
 * Features:
 * - Display list of doctors with profiles
 * - Experience badges (Gold/Silver/Bronze)
 * - Availability indicators
 * - Animated ticket modal with QR code
 * - Download ticket as PNG
 * 
 * Backend Integration Points:
 * - Replace sample doctors array with API call
 * - Integrate booking API in handleBookAppointment
 * - Store appointment data in MongoDB
 * - Generate unique appointment IDs on server
 */

const DoctorAppointmentBooking = ({ doctors = [], userData = null }) => {
  const [selectedDoctor, setSelectedDoctor] = useState(null)
  const [showTicket, setShowTicket] = useState(false)
  const [appointmentData, setAppointmentData] = useState(null)
  const [selectedDate, setSelectedDate] = useState('')
  const [selectedTime, setSelectedTime] = useState('')
  const [showConfetti, setShowConfetti] = useState(false)

  // Sample doctors data - Replace with API call to get doctors
  const sampleDoctors = doctors.length > 0 ? doctors : [
    {
      _id: '1',
      name: 'Dr. Sarah Johnson',
      speciality: 'Cardiologist',
      image: 'https://via.placeholder.com/200',
      experience: 12,
      available: true,
      fees: 1500
    },
    {
      _id: '2',
      name: 'Dr. Michael Chen',
      speciality: 'Neurologist',
      image: 'https://via.placeholder.com/200',
      experience: 8,
      available: true,
      fees: 2000
    },
    {
      _id: '3',
      name: 'Dr. Emily Rodriguez',
      speciality: 'Pediatrician',
      image: 'https://via.placeholder.com/200',
      experience: 4,
      available: false,
      fees: 1200
    }
  ]


  // Generate unique appointment ID
  const generateAppointmentId = () => {
    const timestamp = Date.now()
    const random = Math.floor(Math.random() * 10000)
    return `APT-2025-${timestamp.toString().slice(-4)}${random.toString().padStart(4, '0')}`
  }

  // Format date and time
  const getDateInfo = () => {
    if (!selectedDate) return { date: '', day: '', time: '' }
    const date = new Date(selectedDate)
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    
    return {
      date: `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`,
      day: days[date.getDay()],
      time: selectedTime
    }
  }

  // Handle booking appointment
  const handleBookAppointment = () => {
    if (!selectedDoctor) {
      toast.error('Please select a doctor')
      return
    }

    if (!selectedDate || !selectedTime) {
      toast.error('Please select date and time')
      return
    }

    if (!userData) {
      toast.error('Please login to book appointment')
      return
    }

    // Generate appointment ID
    const appointmentId = generateAppointmentId()
    const dateInfo = getDateInfo()

    // Create appointment data
    const appointment = {
      id: appointmentId,
      patientName: userData.name || 'Patient Name',
      doctorName: selectedDoctor.name,
      doctorSpecialty: selectedDoctor.speciality,
      date: dateInfo.date,
      day: dateInfo.day,
      time: dateInfo.time,
      price: selectedDoctor.fees,
      // Unfinished demo component — no real booking_id; do not emit fake check-in QR.
      bookingId: null,
    }

    setAppointmentData(appointment)
    setShowTicket(true)
    setShowConfetti(true)

    // Hide confetti after animation
    setTimeout(() => setShowConfetti(false), 3000)

    // TODO: Backend API integration
    // const bookAppointment = async () => {
    //   try {
    //     const response = await axios.post(`${backendUrl}/api/user/book-appointment`, {
    //       userId: userData._id,
    //       doctorId: selectedDoctor._id,
    //       appointmentDate: selectedDate,
    //       appointmentTime: selectedTime,
    //       appointmentId: appointmentId
    //     }, {
    //       headers: { token }
    //     })
    //     if (response.data.success) {
    //       toast.success('Appointment booked successfully!')
    //       setShowTicket(true)
    //     }
    //   } catch (error) {
    //     toast.error(error.response?.data?.message || 'Booking failed')
    //   }
    // }

    toast.success('Appointment booking initiated!')
  }

  // Download ticket as PNG
  const downloadTicket = async () => {
    const ticketElement = document.getElementById('appointment-ticket')
    if (!ticketElement) return

    try {
      const canvas = await html2canvas(ticketElement, {
        backgroundColor: '#0a0a0f',
        scale: 2,
        useCORS: true
      })
      const link = document.createElement('a')
      link.download = `appointment-${appointmentData.id}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
      toast.success('Ticket downloaded successfully!')
    } catch (error) {
      toast.error('Failed to download ticket')
      console.error(error)
    }
  }

  // Get available dates (next 7 days)
  const getAvailableDates = () => {
    const dates = []
    const today = new Date()
    for (let i = 0; i < 7; i++) {
      const date = new Date(today)
      date.setDate(today.getDate() + i)
      dates.push(date.toISOString().split('T')[0])
    }
    return dates
  }

  // Get available times
  const getAvailableTimes = () => {
    return [
      '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
      '12:00', '12:30', '14:00', '14:30', '15:00', '15:30',
      '16:00', '16:30', '17:00', '17:30', '18:00'
    ]
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 p-6">
      {/* Confetti Effect */}
      <AnimatePresence>
        {showConfetti && (
          <div className="fixed inset-0 pointer-events-none z-50">
            {[...Array(50)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-2 h-2 rounded-full"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  backgroundColor: ['#00ffff', '#0080ff', '#8000ff', '#ff00ff'][Math.floor(Math.random() * 4)]
                }}
                initial={{ opacity: 1, y: -100, scale: 1 }}
                animate={{ 
                  opacity: 0, 
                  y: window.innerHeight + 100,
                  x: (Math.random() - 0.5) * 200,
                  rotate: 360,
                  scale: 0
                }}
                transition={{ 
                  duration: 2 + Math.random(),
                  delay: Math.random() * 0.5
                }}
              />
            ))}
          </div>
        )}
      </AnimatePresence>

      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent">
            Book Your Appointment
          </h1>
          <p className="text-gray-400 text-lg">Select a doctor and schedule your visit</p>
        </motion.div>

        {/* Doctors Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {sampleDoctors.map((doctor, index) => {
            const badge = getExperienceBadge(doctor.experience)
            return (
              <motion.div
                key={doctor._id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`relative group bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border-2 transition-all duration-300 ${
                  selectedDoctor?._id === doctor._id
                    ? 'border-cyan-400 shadow-[0_0_30px_rgba(6,182,212,0.5)] scale-105'
                    : 'border-gray-700 hover:border-cyan-500 hover:shadow-[0_0_20px_rgba(6,182,212,0.3)]'
                }`}
              >
                {/* Availability Dot */}
                <div className="absolute top-4 right-4">
                  <div className={`w-4 h-4 rounded-full ${
                    doctor.available ? 'bg-green-400 shadow-[0_0_10px_rgba(74,222,128,0.8)]' : 'bg-gray-500'
                  }`}>
                    {doctor.available && (
                      <div className="absolute inset-0 bg-green-400 rounded-full animate-ping opacity-75"></div>
                    )}
                  </div>
                </div>

                {/* Profile Photo */}
                <div className="flex justify-center mb-4">
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 to-blue-400 rounded-full blur-md opacity-50 group-hover:opacity-100 transition-opacity"></div>
                    <img
                      src={doctor.image}
                      alt={doctor.name}
                      className="relative w-24 h-24 rounded-full object-cover border-4 border-gray-700 group-hover:border-cyan-400 transition-all"
                    />
                  </div>
                </div>

                {/* Doctor Info */}
                <div className="text-center">
                  <h3 className="text-xl font-bold text-white mb-2">{doctor.name}</h3>
                  <p className="text-gray-400 mb-3">{doctor.speciality}</p>

                  {/* Experience Badge */}
                  <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border ${badge.bg} ${badge.border} ${badge.shadow} shadow-sm mb-4`}>
                    <span className="text-lg">{badge.emoji}</span>
                    <span className={`text-sm font-semibold ${badge.color}`}>
                      {badge.label} ({doctor.experience} years)
                    </span>
                  </div>

                  {/* Availability Status */}
                  <p className={`text-sm mb-4 ${doctor.available ? 'text-green-400' : 'text-gray-500'}`}>
                    {doctor.available ? '✓ Available Now' : '✗ Not Available'}
                  </p>

                  {/* Book Appointment Button */}
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setSelectedDoctor(doctor)}
                    disabled={!doctor.available}
                    className={`w-full py-3 px-6 rounded-xl font-semibold transition-all ${
                      doctor.available
                        ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-[0_0_20px_rgba(6,182,212,0.5)] hover:shadow-[0_0_30px_rgba(6,182,212,0.8)]'
                        : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    Book Appointment
                  </motion.button>
                </div>
              </motion.div>
            )
          })}
        </div>

        {/* Booking Form */}
        {selectedDoctor && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 border-2 border-cyan-500/50 shadow-[0_0_30px_rgba(6,182,212,0.3)]"
          >
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
              <span className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse"></span>
              Schedule with {selectedDoctor.name}
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              {/* Date Selection */}
              <div>
                <label className="block text-gray-400 mb-2">Select Date</label>
                <select
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full bg-gray-900 border-2 border-gray-700 rounded-xl px-4 py-3 text-white focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 transition-all"
                >
                  <option value="">Choose a date</option>
                  {getAvailableDates().map((date) => {
                    const d = new Date(date)
                    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }
                    return (
                      <option key={date} value={date}>
                        {d.toLocaleDateString('en-US', options)}
                      </option>
                    )
                  })}
                </select>
              </div>

              {/* Time Selection */}
              <div>
                <label className="block text-gray-400 mb-2">Select Time</label>
                <select
                  value={selectedTime}
                  onChange={(e) => setSelectedTime(e.target.value)}
                  className="w-full bg-gray-900 border-2 border-gray-700 rounded-xl px-4 py-3 text-white focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 transition-all"
                >
                  <option value="">Choose a time</option>
                  {getAvailableTimes().map((time) => (
                    <option key={time} value={time}>
                      {time} {parseInt(time.split(':')[0]) >= 12 ? 'PM' : 'AM'}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Confirm Booking Button */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleBookAppointment}
              className="w-full py-4 bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-500 text-white font-bold text-lg rounded-xl shadow-[0_0_30px_rgba(6,182,212,0.5)] hover:shadow-[0_0_40px_rgba(6,182,212,0.8)] transition-all"
            >
              Confirm Booking
            </motion.button>
          </motion.div>
        )}

        {/* Animated Ticket Modal */}
        <AnimatePresence>
          {showTicket && appointmentData && (
            <>
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowTicket(false)}
                className="fixed inset-0 bg-black/80 backdrop-blur-sm"
                style={{ zIndex: 9999999998 }}
              />

              {/* Ticket */}
              <div className="fixed inset-0 flex items-center justify-center p-4 pointer-events-none" style={{ zIndex: 9999999999 }}>
                <motion.div
                  initial={{ opacity: 0, y: 50, scale: 0.8 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 50, scale: 0.8 }}
                  transition={{ type: 'spring', duration: 0.5 }}
                  className="pointer-events-auto max-w-2xl w-full"
                  id="appointment-ticket"
                >
                  {/* Ticket Card */}
                  <div className="relative bg-gradient-to-br from-gray-800 via-gray-900 to-black rounded-3xl p-8 border-2 border-cyan-400/50 shadow-[0_0_50px_rgba(6,182,212,0.5)] overflow-hidden">
                    {/* Glow Effects */}
                    <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-50"></div>
                    <div className="absolute -top-20 -right-20 w-40 h-40 bg-cyan-400 rounded-full blur-3xl opacity-20"></div>
                    <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-purple-400 rounded-full blur-3xl opacity-20"></div>

                    {/* Ticket Content */}
                    <div className="relative z-10">
                      {/* Header */}
                      <div className="text-center mb-8">
                        <h2 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent mb-2">
                          Appointment Ticket
                        </h2>
                        <p className="text-gray-400">MedClues Healthcare</p>
                      </div>

                      {/* Ticket Details */}
                      <div className="bg-gray-900/50 rounded-2xl p-6 mb-6 border border-gray-700">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {/* Left Column */}
                          <div className="space-y-4">
                            <div>
                              <p className="text-gray-400 text-sm mb-1">Patient Name</p>
                              <p className="text-white font-semibold text-lg">{appointmentData.patientName}</p>
                            </div>
                            <div>
                              <p className="text-gray-400 text-sm mb-1">Doctor Name</p>
                              <p className="text-white font-semibold text-lg">{appointmentData.doctorName}</p>
                              <p className="text-cyan-400 text-sm">{appointmentData.doctorSpecialty}</p>
                            </div>
                            <div>
                              <p className="text-gray-400 text-sm mb-1">Appointment ID</p>
                              <p className="text-cyan-400 font-mono font-bold">{appointmentData.id}</p>
                            </div>
                          </div>

                          {/* Right Column */}
                          <div className="space-y-4">
                            <div>
                              <p className="text-gray-400 text-sm mb-1">Date</p>
                              <p className="text-white font-semibold">{appointmentData.date}</p>
                              <p className="text-gray-400 text-sm">{appointmentData.day}</p>
                            </div>
                            <div>
                              <p className="text-gray-400 text-sm mb-1">Time</p>
                              <p className="text-white font-semibold text-lg">{appointmentData.time}</p>
                            </div>
                            <div>
                              <p className="text-gray-400 text-sm mb-1">Fee</p>
                              <p className="text-green-400 font-bold text-xl">₹{appointmentData.price}</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* QR Code — only real BK check-in codes (demo booking has none) */}
                      <div className="flex justify-center mb-6">
                        <div className="bg-white p-4 rounded-xl text-center max-w-xs">
                          {appointmentData.bookingId ? (
                            <QRCode
                              value={String(appointmentData.bookingId).toUpperCase()}
                              size={150}
                              level="H"
                              style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                            />
                          ) : (
                            <p className="text-sm text-gray-600 px-2">
                              Demo ticket only — not a reception check-in QR. Use the live Appointment booking flow for a BK code.
                            </p>
                          )}
                          <p className="text-xs text-gray-500 mt-2">Scan at reception</p>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex gap-4">
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={downloadTicket}
                          className="flex-1 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-semibold rounded-xl shadow-[0_0_20px_rgba(6,182,212,0.5)] hover:shadow-[0_0_30px_rgba(6,182,212,0.8)] transition-all"
                        >
                          Download Ticket
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => setShowTicket(false)}
                          className="flex-1 py-3 bg-gray-700 text-white font-semibold rounded-xl hover:bg-gray-600 transition-all"
                        >
                          Close
                        </motion.button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </div>
            </>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

export default DoctorAppointmentBooking

