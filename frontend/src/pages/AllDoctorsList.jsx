import React, { useContext, useState, useEffect, useMemo } from 'react'
import { AppContext } from '../context/AppContext'
import { SkeletonCard } from '../components/LoadingSpinner'
import { getExperienceBadge } from '../utils/experienceBadge'
import BackButton from '../components/BackButton'
import BackArrow from '../components/BackArrow'
import Pagination from '../components/Pagination'
import { useNavigate } from 'react-router-dom'
import AppointmentBookingModal from '../components/AppointmentBookingModal'
import { toast } from 'react-toastify'
import useScrollAnimation from '../utils/useScrollAnimation'

const AllDoctorsList = () => {
  const { doctors, isDoctorsLoading, token, getDoctosData } = useContext(AppContext)
  const navigate = useNavigate()
  const [currentPage, setCurrentPage] = useState(1)
  const scrollRef = useScrollAnimation()
  const [searchQuery, setSearchQuery] = useState('')
  const [specialtyFilter, setSpecialtyFilter] = useState('All')
  const [experienceFilter, setExperienceFilter] = useState('All')
  const [availabilityFilter, setAvailabilityFilter] = useState('All')
  const [selectedDoctor, setSelectedDoctor] = useState(null)
  const [showBookingModal, setShowBookingModal] = useState(false)
  const itemsPerPage = 12

  // Fetch fresh doctors list on mount to guarantee real-time propagation of any changes
  useEffect(() => {
    if (typeof getDoctosData === 'function') {
      getDoctosData()
    }
  }, [])

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

  // Get unique specialties for filter
  const uniqueSpecialties = useMemo(() => {
    if (!doctors || doctors.length === 0) return []
    const specialties = new Set()
    doctors.forEach(doctor => {
      if (doctor.speciality) specialties.add(doctor.speciality)
      if (doctor.specialization) specialties.add(doctor.specialization)
    })
    return Array.from(specialties).sort()
  }, [doctors])

  // Filter and sort doctors
  const filteredAndSortedDoctors = useMemo(() => {
    if (!doctors || doctors.length === 0) return []
    let filtered = [...doctors]

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      filtered = filtered.filter(doctor =>
        doctor.name?.toLowerCase().includes(query) ||
        doctor.speciality?.toLowerCase().includes(query) ||
        doctor.specialization?.toLowerCase().includes(query) ||
        doctor.degree?.toLowerCase().includes(query) ||
        doctor.qualification?.toLowerCase().includes(query) ||
        doctor.hospital?.toLowerCase().includes(query) ||
        doctor.hospitalName?.toLowerCase().includes(query)
      )
    }

    // Filter by specialty
    if (specialtyFilter !== 'All') {
      filtered = filtered.filter(doctor =>
        doctor.speciality === specialtyFilter || doctor.specialization === specialtyFilter
      )
    }

    // Filter by experience
    if (experienceFilter !== 'All') {
      filtered = filtered.filter(doctor => {
        const exp = parseInt(doctor.experience) || 0
        if (experienceFilter === 'Best') return exp >= 10
        if (experienceFilter === 'Experienced') return exp >= 5 && exp < 10
        if (experienceFilter === 'Junior') return exp < 5
        return true
      })
    }

    // Filter by availability
    if (availabilityFilter !== 'All') {
      filtered = filtered.filter(doctor => {
        if (!doctor) return false // Null safety check
        if (availabilityFilter === 'Available') return doctor.available === true
        if (availabilityFilter === 'Unavailable') return doctor.available === false
        return true
      })
    }

    // Sort: Available first, then unavailable
    return filtered.sort((a, b) => {
      if (!a || !b) return 0 // Null safety check
      if (a.available === b.available) return 0
      return a.available ? -1 : 1
    })
  }, [doctors, searchQuery, specialtyFilter, experienceFilter, availabilityFilter])

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, specialtyFilter, experienceFilter, availabilityFilter])

  // Calculate pagination
  const totalPages = Math.ceil(filteredAndSortedDoctors.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedDoctors = filteredAndSortedDoctors.slice(startIndex, endIndex)

  return (
    <div className='page-container fade-in' ref={scrollRef}>
      {/* Back Navigation */}
      <div className='mb-4 sm:mb-6 flex flex-wrap items-center gap-2 sm:gap-4 slide-down'>
        <BackArrow className="flex-shrink-0" />
        <BackButton className="flex-grow sm:flex-grow-0" />
      </div>

      <div className='max-w-7xl mx-auto'>
        {/* Header Section */}
        <div className='text-center mb-8 sm:mb-12 px-4 anim-header'>
          <h1 className='text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-2 sm:mb-3'>
            All <span className='text-cyan-500'>Doctors</span>
          </h1>
          <p className='text-sm sm:text-base text-gray-600 max-w-2xl mx-auto'>
            Browse through our complete list of trusted medical professionals.
          </p>
        </div>

        {/* Search and Filters Section - Single Row */}
        {!isDoctorsLoading && (
          <div className='mb-6 anim-section'>
            <div className='flex flex-wrap items-center gap-3 sm:gap-4 bg-gray-50/50 rounded-xl p-4 border border-gray-100'>
              {/* Search Bar - Takes remaining space */}
              <div className='relative flex-1 min-w-[280px]'>
                <div className='absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none'>
                  <svg className='h-5 w-5 text-gray-400' fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  type='text'
                  placeholder='Search doctors...'
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className='w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-lg bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm transition-all'
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className='absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600'
                  >
                    <svg className='h-5 w-5' fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>

              {/* Specialty Filter */}
              <div className='flex items-center gap-2'>
                <label className='text-sm font-medium text-gray-700 whitespace-nowrap hidden sm:block'>Specialty:</label>
                <div className='relative'>
                  <select
                    value={specialtyFilter}
                    onChange={(e) => setSpecialtyFilter(e.target.value)}
                    className='px-3 py-2.5 border border-gray-300 rounded-lg bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none cursor-pointer pr-8 shadow-sm min-w-[140px]'
                  >
                    <option value="All">All Specialties</option>
                    {uniqueSpecialties.map((specialty, index) => (
                      <option key={index} value={specialty}>
                        {specialty}
                      </option>
                    ))}
                  </select>
                  <div className='pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2'>
                    <svg className='h-4 w-4 text-gray-400' fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Experience Filter */}
              <div className='flex items-center gap-2'>
                <label className='text-sm font-medium text-gray-700 whitespace-nowrap hidden sm:block'>Experience:</label>
                <div className='relative'>
                  <select
                    value={experienceFilter}
                    onChange={(e) => setExperienceFilter(e.target.value)}
                    className='px-3 py-2.5 border border-gray-300 rounded-lg bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none cursor-pointer pr-8 shadow-sm min-w-[120px]'
                  >
                    <option value="All">All Levels</option>
                    <option value="Best">Best (10+ yrs)</option>
                    <option value="Experienced">Exp (5-10 yrs)</option>
                    <option value="Junior">Junior (0-5 yrs)</option>
                  </select>
                  <div className='pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2'>
                    <svg className='h-4 w-4 text-gray-400' fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Availability Filter */}
              <div className='flex items-center gap-2'>
                <label className='text-sm font-medium text-gray-700 whitespace-nowrap hidden sm:block'>Status:</label>
                <div className='relative'>
                  <select
                    value={availabilityFilter}
                    onChange={(e) => setAvailabilityFilter(e.target.value)}
                    className='px-3 py-2.5 border border-gray-300 rounded-lg bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none cursor-pointer pr-8 shadow-sm min-w-[110px]'
                  >
                    <option value="All">All Status</option>
                    <option value="Available">Available</option>
                    <option value="Unavailable">Unavailable</option>
                  </select>
                  <div className='pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2'>
                    <svg className='h-4 w-4 text-gray-400' fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Loading State */}
        {isDoctorsLoading ? (
          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : (
          <>
            {filteredAndSortedDoctors.length === 0 ? (
              <div className='text-center py-16'>
                <div className='w-24 h-24 mx-auto mb-6 rounded-full bg-gray-100 flex items-center justify-center'>
                  <svg className='w-12 h-12 text-gray-400' fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <h3 className='text-2xl font-bold text-gray-900 mb-2'>No Doctors Found</h3>
                <p className='text-gray-600 font-medium mb-4'>
                  {searchQuery || specialtyFilter !== 'All' || experienceFilter !== 'All' || availabilityFilter !== 'All'
                    ? 'No doctors match your search criteria. Try adjusting your filters.'
                    : 'No doctors are currently available. Please check back later.'}
                </p>
                {(searchQuery || specialtyFilter !== 'All' || experienceFilter !== 'All' || availabilityFilter !== 'All') && (
                  <button
                    onClick={() => {
                      setSearchQuery('')
                      setSpecialtyFilter('All')
                      setExperienceFilter('All')
                      setAvailabilityFilter('All')
                    }}
                    className='px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors'
                  >
                    Clear All Filters
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className='mb-6'>
                  <p className='text-base font-semibold text-gray-700'>
                    <span className='text-blue-600 font-bold text-lg'>{filteredAndSortedDoctors.length}</span> {filteredAndSortedDoctors.length !== 1 ? 'doctors' : 'doctor'} found
                    {(searchQuery || specialtyFilter !== 'All' || experienceFilter !== 'All' || availabilityFilter !== 'All') && (
                      <span className='text-gray-500 text-sm ml-2'>
                        (out of {doctors.length} total)
                      </span>
                    )}
                  </p>
                </div>
                {/* Doctor Cards Grid */}
                <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 anim-grid'>
                  {paginatedDoctors.map((doctor, index) => {
                    // Get doctor image with fallback
                    const doctorImage = doctor.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(doctor.name)}&background=667eea&color=fff`

                    // Update name formatting to use parentheses for degrees
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
                      if (!name.includes(`(${deg})`)) {
                        formattedName = `${name} (${deg})`;
                      }
                      
                      // Ensure "Dr. " prefix
                      return formattedName.startsWith('Dr.') ? formattedName : `Dr. ${formattedName}`;
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

                    return (
                      <div
                        key={doctor._id || index}
                        className='relative bg-white rounded-2xl border border-gray-200 shadow-md hover:shadow-xl hover:border-blue-300 transition-all duration-300 overflow-hidden group flex flex-col h-full'
                      >
                        {/* Availability Badge - Top Right of Card */}
                        {doctor.available !== undefined && (
                          <div className='absolute top-3 right-3 z-10'>
                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold shadow-md ${doctor.available
                              ? 'bg-green-500 text-white'
                              : 'bg-gray-400 text-white'
                              }`}>
                              <span className='w-1.5 h-1.5 rounded-full bg-white'></span>
                              {doctor.available ? 'Available' : 'Unavailable'}
                            </span>
                          </div>
                        )}
                        <div className='p-6 flex flex-col items-center text-center h-full'>
                          {/* Circular Headshot with Light Blue Gradient Circle */}
                          <div className='relative mb-5 flex-shrink-0'>
                            <div className='absolute inset-0 bg-gradient-to-br from-blue-100 to-cyan-100 rounded-full blur-sm'></div>
                            <div className='relative w-32 h-32 rounded-full bg-gradient-to-br from-blue-50 to-cyan-50 p-2'>
                              <img
                                src={doctorImage}
                                alt={doctor.name}
                                className='w-full h-full rounded-full object-cover ring-4 ring-white shadow-lg'
                              />
                            </div>
                          </div>

                          {/* Name and Degree */}
                          <h3 className='text-xl font-bold text-gray-900 mb-2 line-clamp-2 text-center w-full'>
                                {getDoctorNameWithMD(doctor.name, index, doctor.degree || doctor.qualification)}
                          </h3>

                          {/* Specialty/Title */}
                          <p className='text-sm font-semibold text-gray-700 mb-2 text-center w-full'>
                            {getSpecialtyTitle(doctor.speciality || doctor.specialization)}
                          </p>

                          {/* Qualification line removed as it's already in the name */}

                          {/* Expertise Description removed as requested */}

                          {/* Book Appointment Button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDoctorClick(doctor)
                            }}
                            className='w-full mt-auto h-11 px-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg transition-all duration-200 flex items-center justify-center gap-2 shadow-md hover:shadow-lg flex-shrink-0'
                          >
                            <svg className='w-4 h-4' fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            Book Appointment
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
                {/* Pagination */}
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={(page) => {
                    setCurrentPage(page)
                    window.scrollTo({ top: 0, behavior: 'smooth' })
                  }}
                  itemsPerPage={itemsPerPage}
                  totalItems={filteredAndSortedDoctors.length}
                />
              </>
            )}
          </>
        )}
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
    </div >
  )
}

export default AllDoctorsList
