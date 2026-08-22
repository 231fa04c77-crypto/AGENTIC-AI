import React, { useContext, useEffect, useState, useMemo } from 'react'
import { AppContext } from '../context/AppContext'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import BackButton from '../components/BackButton'
import BackArrow from '../components/BackArrow'
import LoadingSpinner, { SkeletonCard } from '../components/LoadingSpinner'
import AppointmentBookingModal from '../components/AppointmentBookingModal'
import Pagination from '../components/Pagination'
import { getExperienceBadge } from '../utils/experienceBadge'
import { getUserLocation, geocodeAddress, calculateDistance, formatDistance, findNearbyHospitals } from '../utils/locationUtils'
import axios from 'axios'
import { toast } from 'react-toastify'
import { assets, specialityData } from '../assets/assets'

const Doctors = () => {
  const [hospitals, setHospitals] = useState([])
  const [selectedHospital, setSelectedHospital] = useState(null)
  const [hospitalDoctors, setHospitalDoctors] = useState([])
  const [filteredDoctors, setFilteredDoctors] = useState([])
  const [doctorFilter, setDoctorFilter] = useState('All')
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingDoctors, setIsLoadingDoctors] = useState(false)
  const [selectedDoctor, setSelectedDoctor] = useState(null)
  const [showBookingModal, setShowBookingModal] = useState(false)
  const [allDoctorsFromHospitals, setAllDoctorsFromHospitals] = useState([])
  const [currentPage, setCurrentPage] = useState(1)
  const [doctorsCurrentPage, setDoctorsCurrentPage] = useState(1)
  const [viewMode, setViewMode] = useState('all') // 'all' or 'nearby'
  const [userLocation, setUserLocation] = useState(null)
  const [hospitalsWithDistance, setHospitalsWithDistance] = useState([])
  const [isLoadingLocation, setIsLoadingLocation] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [hospitalTypeFilter, setHospitalTypeFilter] = useState('All')
  const [doctorSearchQuery, setDoctorSearchQuery] = useState('')
  const itemsPerPage = 12
  const doctorsItemsPerPage = 12
  const navigate = useNavigate();
  const { speciality } = useParams();
  const [searchParams] = useSearchParams();

  const { backendUrl, token, getDoctosData } = useContext(AppContext)

  // Clear cache and fetch fresh doctors data on mount to guarantee real-time propagation
  useEffect(() => {
    sessionStorage.removeItem('nearbyHospitalsDoctorsCache');
    if (typeof getDoctosData === 'function') {
      getDoctosData()
    }
  }, [])

  // Helper to generate the same avatar style used in AppContext for any ad‑hoc doctor objects
  const fixDoctorImage = (doc) => {
    const hasCustomImage = doc.image &&
      !doc.image.includes('data:image/png;base64') &&
      doc.image !== '' &&
      !doc.image.includes('placeholder');

    if (hasCustomImage) {
      return doc.image;
    }

    const name = doc.name || 'Doctor';
    const encoded = encodeURIComponent(name.replace(/\s+/g, '+'));
    return `https://ui-avatars.com/api/?name=${encoded}&background=0ea5e9&color=ffffff&size=256&rounded=true&bold=true`;
  }

  // Helper to normalize specialty names for matching
  const normalizeSpecialty = (specialty) => {
    if (!specialty) return '';
    return specialty.toLowerCase().trim();
  }

  // Helper to check if specialty matches (handles variations with strict matching)
  const matchesSpecialty = (doctorSpecialty, selectedSpecialty) => {
    if (!doctorSpecialty || !selectedSpecialty) return false;

    const normalizedDoctor = normalizeSpecialty(doctorSpecialty);
    const normalizedSelected = normalizeSpecialty(selectedSpecialty);

    // Exact match first
    if (normalizedDoctor === normalizedSelected) return true;

    // Handle common specialty name variations - each specialty group is isolated
    const specialtyVariations = {
      'general medicine': ['general medicine', 'general physician', 'general practice', 'family medicine'],
      'gynecology': ['gynecology', 'gynecologist', 'gynaecology', 'gynaecologist', 'obstetrics', 'obgyn'],
      'dermatology': ['dermatology', 'dermatologist'],
      'pediatrics': ['pediatrics', 'pediatricians', 'paediatrics', 'paediatrician'],
      'neurology': ['neurology', 'neurologist'],
      'gastroenterology': ['gastroenterology', 'gastroenterologist'],
      'cardiology': ['cardiology', 'cardiologist'],
      'orthopedics': ['orthopedics', 'orthopedic', 'orthopaedics'],
      'psychiatry': ['psychiatry', 'psychiatrist'],
      'ophthalmology': ['ophthalmology', 'ophthalmologist'],
      'ent': ['ent', 'ear nose throat', 'ear, nose, throat', 'otolaryngologist', 'otolaryngology', 'ent specialist'],
      'dentistry': ['dentistry', 'dentist', 'dental']
    };

    // Find which group the selected specialty belongs to
    let selectedGroup = null;
    for (const [key, variations] of Object.entries(specialtyVariations)) {
      const normalizedKey = normalizeSpecialty(key);
      if (normalizedSelected === normalizedKey) {
        selectedGroup = key;
        break;
      }
      if (variations.some(v => {
        const normalizedV = normalizeSpecialty(v);
        return normalizedSelected === normalizedV ||
          (normalizedSelected.includes(normalizedV) && normalizedV.length > 3) ||
          (normalizedV.includes(normalizedSelected) && normalizedSelected.length > 3);
      })) {
        selectedGroup = key;
        break;
      }
    }

    if (!selectedGroup) return false;

    // Now check if doctor specialty matches the same group
    const groupVariations = specialtyVariations[selectedGroup];
    const doctorMatches = groupVariations.some(v => {
      const normalizedV = normalizeSpecialty(v);
      if (normalizedDoctor === normalizedV) return true;
      // Use word boundary matching to avoid cross-matches
      if (normalizedDoctor.includes(normalizedV) && normalizedV.length > 3) {
        // Check for word boundaries to avoid "dentistry" matching "ent"
        const regex = new RegExp(`\\b${normalizedV}\\b`, 'i');
        return regex.test(normalizedDoctor);
      }
      if (normalizedV.includes(normalizedDoctor) && normalizedDoctor.length > 3) {
        const regex = new RegExp(`\\b${normalizedDoctor}\\b`, 'i');
        return regex.test(normalizedV);
      }
      return false;
    });

    if (!doctorMatches) return false;

    // Special case: Prevent ENT and Dentistry cross-matching
    if (selectedGroup === 'ent') {
      const dentalTerms = ['dentistry', 'dentist', 'dental'];
      if (dentalTerms.some(term => normalizedDoctor.includes(term) && term.length > 3)) {
        return false;
      }
    }

    if (selectedGroup === 'dentistry') {
      const entTerms = ['ent', 'otolaryngology', 'otolaryngologist'];
      // Check if doctor specialty contains ENT as a whole word, not as part of "dentistry"
      if (entTerms.some(term => {
        if (term === 'ent') {
          // ENT should only match if it's a standalone term, not part of "dentistry"
          const entRegex = /\bent\b/i;
          return entRegex.test(normalizedDoctor) && !normalizedDoctor.includes('dent');
        }
        return normalizedDoctor.includes(term) && term.length > 3;
      })) {
        return false;
      }
    }

    return true;
  }

  // Fetch hospitals with doctors from hospital-tieup API (same as admin panel)
  useEffect(() => {
    const fetchHospitals = async () => {
      setIsLoading(true)
      try {
        const response = await axios.get(backendUrl + '/api/hospital-tieup/public/all')
        if (response.data.success) {
          // Sort: Main hospitals (type: "Teaching Hospital" or specific types) first, then others
          const sorted = response.data.hospitals.sort((a, b) => {
            const priority = { 'Teaching Hospital': 1, 'Super Specialty': 2, 'General': 3 }
            const aPriority = priority[a.type] || 3
            const bPriority = priority[b.type] || 3
            if (aPriority !== bPriority) return aPriority - bPriority
            return a.name.localeCompare(b.name)
          })

          setHospitals(sorted)

          // Add images to doctors
          sorted.forEach(hospital => {
            if (hospital.doctors) {
              hospital.doctors.forEach(doctor => {
                doctor.image = fixDoctorImage(doctor)
                if (doctor.specialization && !doctor.speciality) {
                  doctor.speciality = doctor.specialization
                }
                if (doctor.qualification && !doctor.degree) {
                  doctor.degree = doctor.qualification
                }
                if (!doctor.fees) {
                  doctor.fees = 500
                }
              })
            }
          })
        }
      } catch (error) {
        console.error('Error fetching hospitals:', error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchHospitals()
  }, [backendUrl])

  // Get user location and find REAL nearby hospitals from OpenStreetMap
  useEffect(() => {
    // BUG FIX: isMounted guard prevents stale async updates after user switches modes
    let isMounted = true

    const fetchRealNearbyHospitals = async () => {
      if (viewMode !== 'nearby') {
        setHospitalsWithDistance([])
        setIsLoadingLocation(false)
        return
      }

      // --- ⚡ SPEED OPTIMIZATION: Check Session Cache First ---
      const cachedData = sessionStorage.getItem('nearbyHospitalsDoctorsCache');
      if (cachedData) {
        try {
          const { hospitals: cachedHospitals, timestamp, lat, lon, radius: cachedRadius } = JSON.parse(cachedData);
          const now = new Date().getTime();

          // If cache is less than 5 minutes old AND the radius matches, use it
          if (now - timestamp < 5 * 60 * 1000 && cachedRadius === 10) {
            console.log('Using cached nearby hospitals for speed');
            if (isMounted) {
              setHospitalsWithDistance(cachedHospitals);
              setUserLocation({ lat, lon });
              setIsLoadingLocation(false);
            }
            return; // Exit early!
          }
        } catch (e) {
          console.error('Cache error:', e);
        }
      }

      if (isMounted) setIsLoadingLocation(true)

      try {
        // Get user location
        const location = await getUserLocation()
        if (!isMounted) return
        setUserLocation(location)

        // Find REAL nearby hospitals using backend API (from OpenStreetMap)
        const nearbyHospitals = await findNearbyHospitals(
          location.lat,
          location.lon,
          10, // Set to 10km range as requested
          backendUrl
        )

        if (!isMounted) return

        if (nearbyHospitals && nearbyHospitals.length > 0) {
          // Transform the data to match our hospital card format
          const formattedHospitals = nearbyHospitals.map(hospital => ({
            _id: `osm_${hospital.latitude}_${hospital.longitude}`, // Generate unique ID
            name: hospital.name,
            address: hospital.address,
            contact: hospital.phone,
            type: hospital.type,
            specialization: hospital.specialization,
            distance: hospital.distance,
            coordinates: {
              lat: hospital.latitude,
              lon: hospital.longitude
            },
            website: hospital.website,
            openingHours: hospital.openingHours,
            isRealHospital: true // Flag to indicate this is from OSM, not database
          }))

          setHospitalsWithDistance(formattedHospitals)

          // --- 💾 SPEED OPTIMIZATION: Save to Cache ---
          sessionStorage.setItem('nearbyHospitalsDoctorsCache', JSON.stringify({
            hospitals: formattedHospitals,
            lat: location.lat,
            lon: location.lon,
            radius: 10,
            timestamp: new Date().getTime()
          }));

        } else {
          // BUG FIX: Do NOT call setViewMode('all') here — it caused a recursive
          // useEffect loop. Show empty state instead; let user switch manually.
          toast.info('No hospitals found nearby. Try expanding your search area.', {
            position: "top-center",
            autoClose: 4000,
          })
          setHospitalsWithDistance([])
        }
      } catch (error) {
        if (!isMounted) return
        console.error('Error getting location or nearby hospitals:', error)
        if (error.message?.includes('denied') || error.code === 1) {
          toast.error('Location access denied. Please enable location permissions to use nearby hospitals.', {
            position: "top-center",
            autoClose: 4000,
          })
        } else if (error.message?.includes('timeout') || error.code === 3) {
          toast.error('Location request timed out. Please try again.', {
            position: "top-center",
            autoClose: 3000,
          })
        } else {
          toast.error('Unable to find nearby hospitals. Please try again later.', {
            position: "top-center",
            autoClose: 3000,
          })
        }
        // BUG FIX: Do NOT call setViewMode('all') — it caused the effect to re-run
        // and clear results, creating a blank screen / flicker loop.
        setHospitalsWithDistance([])
      } finally {
        if (isMounted) setIsLoadingLocation(false)
      }
    }

    fetchRealNearbyHospitals()

    // Cleanup: prevent stale async state updates
    return () => { isMounted = false }
  }, [viewMode, backendUrl])

  // Navigate to hospital details page
  const handleHospitalClick = (hospital) => {
    // If it's a real hospital from OSM (not in our database), open in Google Maps
    if (hospital.isRealHospital) {
      const name = encodeURIComponent(hospital.name);
      const mapsUrl = (hospital.coordinates?.lat && hospital.coordinates?.lon)
        ? `https://www.google.com/maps/place/${name}/@${hospital.coordinates.lat},${hospital.coordinates.lon},17z`
        : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(hospital.name + ' ' + (hospital.address || ''))}`
      window.open(mapsUrl, '_blank')
      return
    }
    // Regular hospital from database - navigate to details page
    navigate(`/hospital/${hospital._id}`)
    window.scrollTo(0, 0)
  }

  const handleBackToHospitals = () => {
    setSelectedHospital(null)
    setHospitalDoctors([])
    setFilteredDoctors([])
    setDoctorFilter('All')
    setDoctorsCurrentPage(1)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Filter doctors based on experience/quality
  useEffect(() => {
    if (hospitalDoctors.length === 0) {
      setFilteredDoctors([])
      return
    }

    let filtered = [...hospitalDoctors]

    // Filter by experience level
    if (doctorFilter === 'Best') {
      // Best doctors: 10+ years experience
      filtered = hospitalDoctors.filter(doctor => {
        const exp = parseInt(doctor.experience) || 0
        return exp >= 10
      })
    } else if (doctorFilter === 'Experienced') {
      // Experienced: 5-9 years
      filtered = hospitalDoctors.filter(doctor => {
        const exp = parseInt(doctor.experience) || 0
        return exp >= 5 && exp < 10
      })
    } else if (doctorFilter === 'Junior') {
      // Junior: 0-4 years
      filtered = hospitalDoctors.filter(doctor => {
        const exp = parseInt(doctor.experience) || 0
        return exp < 5
      })
    }

    // Filter by search query
    if (doctorSearchQuery.trim()) {
      const query = doctorSearchQuery.toLowerCase().trim();
      filtered = filtered.filter(doctor =>
        doctor.name?.toLowerCase().includes(query) ||
        doctor.specialization?.toLowerCase().includes(query) ||
        doctor.speciality?.toLowerCase().includes(query) ||
        doctor.qualification?.toLowerCase().includes(query) ||
        doctor.degree?.toLowerCase().includes(query)
      );
    }

    setFilteredDoctors(filtered)
    setDoctorsCurrentPage(1) // Reset to page 1 when filter changes
  }, [doctorFilter, hospitalDoctors, doctorSearchQuery])

  const handleDoctorClick = (doctor) => {
    if (!token) {
      toast.warning('Please login to book an appointment')
      navigate('/login')
      return
    }

    // Validate doctor object before showing modal
    if (!doctor) {
      toast.error('Doctor information is missing. Please try again.')
      return
    }

    if (!doctor._id && !doctor.id) {
      toast.error('Doctor ID not found. Please try again.')
      return
    }

    const doctorId = doctor._id || doctor.id
    const doctorWithId = { ...doctor, _id: doctorId }

    // Close any existing modal first, then open new one
    setShowBookingModal(false)
    setSelectedDoctor(null)

    // Small delay to ensure state is reset
    setTimeout(() => {
      setSelectedDoctor(doctorWithId)
      setShowBookingModal(true)
    }, 100)
  }

  // Get hospitals based on view mode
  const hospitalsToFilter = viewMode === 'nearby' ? hospitalsWithDistance : hospitals

  // Filter hospitals by specialty, search query, and type
  const filteredHospitals = useMemo(() => {
    return hospitalsToFilter.filter(hospital => {
      // Filter by specialty if selected
      if (speciality) {
        let matchesSpecialtyFilter = false;
        // First check if hospital's specialization matches
        if (hospital.specialization) {
          const hospitalSpecialty = hospital.specialization;
          if (matchesSpecialty(hospitalSpecialty, speciality)) {
            matchesSpecialtyFilter = true;
          }
        }
        // Also check if hospital has doctors with matching specialty
        if (!matchesSpecialtyFilter && hospital.doctors && hospital.doctors.length > 0) {
          matchesSpecialtyFilter = hospital.doctors.some(doctor => {
            const doctorSpecialty = doctor.specialization || doctor.speciality;
            return matchesSpecialty(doctorSpecialty, speciality);
          });
        }
        if (!matchesSpecialtyFilter) return false;
      }

      // Filter by search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesSearch =
          hospital.name?.toLowerCase().includes(query) ||
          hospital.address?.toLowerCase().includes(query) ||
          hospital.specialization?.toLowerCase().includes(query) ||
          hospital.contact?.includes(query);
        if (!matchesSearch) return false;
      }

      // Filter by hospital type
      if (hospitalTypeFilter !== 'All') {
        if (hospitalTypeFilter === 'Teaching Hospital' && hospital.type !== 'Teaching Hospital') return false;
        if (hospitalTypeFilter === 'Super Specialty' && hospital.type !== 'Super Specialty') return false;
        if (hospitalTypeFilter === 'General' && hospital.type !== 'General') return false;
      }

      return true;
    });
  }, [hospitalsToFilter, speciality, searchQuery, hospitalTypeFilter]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [speciality, viewMode, searchQuery, hospitalTypeFilter])

  // Calculate paginated hospitals
  const totalPages = Math.ceil(filteredHospitals.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedHospitals = filteredHospitals.slice(startIndex, endIndex)

  // Collect all doctors from filtered hospitals (with deduplication)
  const allDoctorsFromHospitalsMemo = useMemo(() => {
    if (filteredHospitals.length === 0) {
      return []
    }

    // Use Map to deduplicate doctors by _id
    const doctorsMap = new Map()

    filteredHospitals.forEach(hospital => {
      if (hospital.doctors && hospital.doctors.length > 0) {
        hospital.doctors.forEach(doctor => {
          // Skip if doctor doesn't have an _id
          if (!doctor || !doctor._id) return

          const doctorSpecialty = doctor.specialization || doctor.speciality

          // Filter by specialty if selected
          if (!speciality || matchesSpecialty(doctorSpecialty, speciality)) {
            // Check if doctor already exists
            if (!doctorsMap.has(doctor._id)) {
              // Add hospital name to doctor object
              const doctorWithHospital = {
                ...doctor,
                hospitalName: hospital.name,
                hospitalId: hospital._id,
                image: fixDoctorImage(doctor),
                speciality: doctor.specialization || doctor.speciality,
                degree: doctor.qualification || doctor.degree,
                fees: doctor.fees || 500
              }
              doctorsMap.set(doctor._id, doctorWithHospital)
            } else {
              // If doctor already exists, update hospital info if needed (for doctors at multiple hospitals)
              const existingDoctor = doctorsMap.get(doctor._id)
              // Keep the first hospital or merge hospital names if needed
              if (existingDoctor.hospitalName && !existingDoctor.hospitalName.includes(hospital.name)) {
                existingDoctor.hospitalName = `${existingDoctor.hospitalName}, ${hospital.name}`
              }
            }
          }
        })
      }
    })

    // Convert Map to Array
    const allDoctors = Array.from(doctorsMap.values())

    // Sort: Available doctors first, then by name
    allDoctors.sort((a, b) => {
      if (!a || !b) return 0 // Null safety check
      if (a.available !== b.available) {
        return a.available ? -1 : 1
      }
      return (a.name || '').localeCompare(b.name || '')
    })

    return allDoctors
  }, [filteredHospitals, speciality])

  // Get top doctors by experience for the selected specialty
  const topDoctorsByExperience = useMemo(() => {
    if (!speciality || allDoctorsFromHospitals.length === 0) {
      return []
    }

    // Filter doctors by specialty and sort by experience (highest first)
    const specialtyDoctors = allDoctorsFromHospitals
      .filter(doctor => {
        const doctorSpecialty = doctor.specialization || doctor.speciality
        return matchesSpecialty(doctorSpecialty, speciality)
      })
      .map(doctor => ({
        ...doctor,
        experienceNum: parseInt(doctor.experience) || 0
      }))
      .sort((a, b) => {
        // Sort by experience (highest first), then by availability, then by name
        if (b.experienceNum !== a.experienceNum) {
          return b.experienceNum - a.experienceNum
        }
        if (!a || !b) return 0 // Null safety check
        if (a.available !== b.available) {
          return a.available ? -1 : 1
        }
        return (a.name || '').localeCompare(b.name || '')
      })
      .slice(0, 8) // Top 8 doctors

    return specialtyDoctors
  }, [allDoctorsFromHospitals, speciality])

  useEffect(() => {
    setAllDoctorsFromHospitals(allDoctorsFromHospitalsMemo)
  }, [allDoctorsFromHospitalsMemo])

  // Show doctors list if hospital is selected
  if (selectedHospital) {
    // Calculate pagination for doctors
    const doctorsTotalPages = Math.ceil(filteredDoctors.length / doctorsItemsPerPage)
    const doctorsStartIndex = (doctorsCurrentPage - 1) * doctorsItemsPerPage
    const doctorsEndIndex = doctorsStartIndex + doctorsItemsPerPage
    const paginatedDoctors = filteredDoctors.slice(doctorsStartIndex, doctorsEndIndex)

    return (
      <div className='min-h-screen bg-white'>
        <div className='page-container fade-in'>
          {/* Back Arrow Button */}
          <div className='mb-4 sm:mb-8 flex flex-wrap items-center gap-2 sm:gap-4'>
            <BackArrow className="flex-shrink-0" />
            <button
              onClick={handleBackToHospitals}
              className='flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-all font-semibold text-sm sm:text-base border border-blue-100 shadow-sm flex-grow sm:flex-grow-0 justify-center sm:justify-start'
            >
              <svg className='w-4 h-4' fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span>Back to Hospitals</span>
            </button>
          </div>

          {/* Search and Filter Section for Doctors */}
          {!isLoadingDoctors && hospitalDoctors.length > 0 && (
            <div className='mb-6 flex flex-col lg:flex-row gap-4 lg:items-center'>
              {/* Search Bar for Doctors */}
              <div className='relative flex-1 w-full'>
                <div className='absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none'>
                  <svg className='h-5 w-5 text-gray-400' fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  type='text'
                  placeholder='Search doctors by name, specialization, or qualification...'
                  value={doctorSearchQuery}
                  onChange={(e) => setDoctorSearchQuery(e.target.value)}
                  className='w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl bg-white/90 backdrop-blur-md text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-md transition-all'
                />
                {doctorSearchQuery && (
                  <button
                    onClick={() => setDoctorSearchQuery('')}
                    className='absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600'
                  >
                    <svg className='h-5 w-5' fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>

              {/* Experience Filter */}
              <div className='flex items-center gap-2 shrink-0 w-full lg:w-auto'>
                <label className='text-sm font-medium text-gray-700 whitespace-nowrap'>Filter:</label>
                <div className='relative'>
                  <select
                    value={doctorFilter}
                    onChange={(e) => setDoctorFilter(e.target.value)}
                    className='px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none cursor-pointer pr-8 shadow-sm'
                  >
                    <option value="All">All Doctors</option>
                    <option value="Best">Best Doctors (10+ years)</option>
                    <option value="Experienced">Experienced (5-10 years)</option>
                    <option value="Junior">Junior (0-5 years)</option>
                  </select>
                  <div className='pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2'>
                    <svg className='h-4 w-4 text-gray-400' fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Hospital Header */}
          <div className='mb-8'>
            <div className='bg-white/70 backdrop-blur-md rounded-2xl shadow-lg border border-white/50 p-6 sm:p-8'>
              <div className='flex items-start gap-4 mb-4'>
                <div className='w-16 h-16 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-md'>
                  <svg className='w-8 h-8 text-white' fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <div className='flex-1'>
                  <div className='flex items-center gap-3 mb-2'>
                    <h1 className='text-2xl sm:text-3xl font-bold text-gray-900'>{selectedHospital.name}</h1>
                    <span className={`text-xs px-3 py-1 rounded-full font-semibold ${selectedHospital.type === 'Teaching Hospital'
                      ? 'bg-purple-100 text-purple-700 border border-purple-200'
                      : selectedHospital.type === 'Super Specialty'
                        ? 'bg-blue-100 text-blue-700 border border-blue-200'
                        : 'bg-gray-100 text-gray-700 border border-gray-200'
                      }`}>
                      {selectedHospital.type}
                    </span>
                  </div>
                  <div className='space-y-2 text-sm text-gray-600'>
                    <div className='flex items-center gap-2'>
                      <svg className='w-4 h-4 text-gray-400' fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span>{selectedHospital.address}</span>
                    </div>
                    <div className='flex items-center gap-2'>
                      <svg className='w-4 h-4 text-gray-400' fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      <span>{selectedHospital.contact}</span>
                    </div>
                    <div className='flex items-center gap-2'>
                      <svg className='w-4 h-4 text-gray-400' fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      <span className='font-medium text-blue-600'>{selectedHospital.specialization}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Doctors Grid */}
          {isLoadingDoctors ? (
            <div className='doctors-grid'>
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : filteredDoctors.length === 0 ? (
            <div className='text-center py-16 bg-transparent rounded-2xl shadow-md border border-gray-200'>
              <svg className='w-16 h-16 text-gray-400 mx-auto mb-4' fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <p className='text-gray-600 font-semibold text-lg'>No doctors available at this hospital</p>
            </div>
          ) : (
            <>
              <div className='mb-6'>
                <p className='text-base font-semibold text-gray-700'>
                  <span className='text-blue-600 font-bold text-lg'>{filteredDoctors.length}</span> {filteredDoctors.length !== 1 ? 'doctors' : 'doctor'} available
                  {doctorFilter !== 'All' && (
                    <span className='text-gray-500 text-sm ml-2'>({hospitalDoctors.length} total)</span>
                  )}
                </p>
              </div>
              <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'>
                {paginatedDoctors.map((doctor, index) => {
                  // Get doctor image with fallback
                  const doctorImage = fixDoctorImage(doctor)

                  // Extract MD from name or add it
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
                      className='relative bg-white rounded-2xl border border-gray-200 shadow-md hover:shadow-xl hover:border-blue-300 transition-all duration-300 cursor-pointer overflow-hidden group flex flex-col h-full'
                      style={{ animationDelay: `${index * 0.05}s` }}
                    >
                      {/* Availability Badge - Top Right of Card */}
                      {doctor.available !== undefined && (
                        <div className='absolute top-3 right-3 z-10'>
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold shadow-md ${doctor.available
                            ? 'bg-white text-white'
                            : 'bg-gray-400 text-white'
                            }`}>
                            <span className='w-1.5 h-1.5 rounded-full bg-white'></span>
                            {doctor.available ? 'Available' : 'Unavailable'}
                          </span>
                        </div>
                      )}
                      <div className='p-6 flex flex-col items-center text-center h-full w-full'>
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

                        <h3 className='text-xl font-bold text-gray-900 mb-2 line-clamp-2 text-center w-full'>
                          {getDoctorNameWithMD(doctor.name, index, doctor.degree || doctor.qualification)}
                        </h3>

                        {/* Specialty/Title */}
                        <p className='text-sm font-semibold text-gray-700 mb-2 text-center w-full'>
                          {getSpecialtyTitle(doctor.specialization || doctor.speciality)}
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
              {/* Pagination for Doctors */}
              <Pagination
                currentPage={doctorsCurrentPage}
                totalPages={doctorsTotalPages}
                onPageChange={(page) => {
                  setDoctorsCurrentPage(page)
                  window.scrollTo({ top: 0, behavior: 'smooth' })
                }}
                itemsPerPage={doctorsItemsPerPage}
                totalItems={filteredDoctors.length}
              />
            </>
          )}

        </div>
      </div>
    )
  }

  // Show hospitals grid
  return (
    <div className='min-h-screen bg-white'>
      <div className='page-container fade-in'>
        {/* Back Arrow Button */}
        <div className='mb-4 sm:mb-8 flex flex-wrap items-center gap-2 sm:gap-4'>
          <BackArrow className="flex-shrink-0" />
          <BackButton className="flex-grow sm:flex-grow-0" />
        </div>

        {/* Search and Filters Section */}
        {!isLoading && (
          <div className='mb-8 flex flex-col lg:flex-row gap-4 lg:items-center'>
            {/* Search Bar */}
            <div className='relative flex-1 w-full'>
              <div className='absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none'>
                <svg className='h-5 w-5 text-gray-400' fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type='text'
                placeholder='Search hospitals...'
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className='w-full pl-12 pr-10 sm:pr-4 py-2.5 sm:py-3 border border-gray-300 rounded-xl bg-white/90 backdrop-blur-md text-gray-900 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-md transition-all'
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className='absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600'
                >
                  <svg className='h-5 w-5' fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* Filters Row */}
            <div className='flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-3 sm:gap-4 shrink-0 w-full lg:w-auto'>
              {/* View Mode Toggle */}
              <div className='flex items-center gap-2 w-full sm:w-auto'>
                <label className='text-xs sm:text-sm font-medium text-gray-700 whitespace-nowrap'>View:</label>
                <div className='flex items-center gap-1 sm:gap-2 bg-gray-100 rounded-lg p-1 flex-1 sm:flex-initial'>
                  <button
                    onClick={() => setViewMode('all')}
                    className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-md text-xs sm:text-sm font-semibold transition-all flex-1 sm:flex-initial ${viewMode === 'all'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                      }`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setViewMode('nearby')}
                    disabled={isLoadingLocation}
                    className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-md text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-1 sm:gap-2 flex-1 sm:flex-initial ${viewMode === 'nearby'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                      } ${isLoadingLocation ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <>
                      <svg className='w-3.5 h-3.5 sm:w-4 sm:h-4' fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      Nearby
                    </>
                  </button>
                </div>
              </div>

              {/* Specialty Filter */}
              <div className='flex items-center gap-2 w-full sm:w-auto'>
                <label className='text-xs sm:text-sm font-medium text-gray-700 whitespace-nowrap'>Specialty:</label>
                <div className='relative flex-1 sm:flex-initial'>
                  <select
                    value={speciality || 'All'}
                    onChange={(e) => {
                      const selectedValue = e.target.value;
                      const fromParam = searchParams.get('from');
                      const queryString = fromParam ? `?from=${fromParam}` : '';
                      if (selectedValue === 'All') {
                        navigate(`/doctors${queryString}`);
                      } else {
                        navigate(`/doctors/${selectedValue}${queryString}`);
                      }
                    }}
                    className='w-full sm:w-auto px-3 sm:px-4 py-1.5 sm:py-2 border border-gray-300 rounded-lg bg-white text-gray-900 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none cursor-pointer pr-7 sm:pr-8 shadow-sm'
                  >
                    <option value="All">All Specialties</option>
                    {specialityData.map((item, index) => (
                      <option key={index} value={item.speciality}>
                        {item.speciality}
                      </option>
                    ))}
                  </select>
                  <div className='pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2'>
                    <svg className='h-3.5 w-3.5 sm:h-4 sm:w-4 text-gray-400' fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Hospital Type Filter */}
              <div className='flex items-center gap-2 w-full sm:w-auto'>
                <label className='text-xs sm:text-sm font-medium text-gray-700 whitespace-nowrap'>Type:</label>
                <div className='relative flex-1 sm:flex-initial'>
                  <select
                    value={hospitalTypeFilter}
                    onChange={(e) => setHospitalTypeFilter(e.target.value)}
                    className='w-full sm:w-auto px-3 sm:px-4 py-1.5 sm:py-2 border border-gray-300 rounded-lg bg-white text-gray-900 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none cursor-pointer pr-7 sm:pr-8 shadow-sm'
                  >
                    <option value="All">All Types</option>
                    <option value="Teaching Hospital">Teaching Hospital</option>
                    <option value="Super Specialty">Super Specialty</option>
                    <option value="General">General</option>
                  </select>
                  <div className='pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2'>
                    <svg className='h-3.5 w-3.5 sm:h-4 sm:w-4 text-gray-400' fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : isLoadingLocation ? (
          // Loading State - Finding Nearby Hospitals (Centered on Page)
          <div className="flex flex-col items-center justify-center w-full py-20">
            <div className="relative mb-8">
              <div className="w-20 h-20 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-3 text-center">Finding Nearby Hospitals</h3>
            <p className="text-gray-600 text-center max-w-md mb-6">
              Please wait while we locate hospitals near you. This may take a few seconds...
            </p>
            <div className="flex gap-2 justify-center">
              <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
              <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
              <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </div>
          </div>
        ) : (
          <div className='pb-12'>
            {/* All Hospitals Section */}
            {filteredHospitals.length > 0 && (
              <div className='space-y-6'>
                <h2 className='text-xl sm:text-2xl font-bold text-gray-900 mb-2'>
                  {viewMode === 'nearby'
                    ? (speciality ? `Nearby ${speciality} Hospitals` : 'Nearby Hospitals')
                    : (speciality ? `${speciality} Hospitals` : 'All Hospitals')
                  }
                  {viewMode === 'nearby' && hospitalsWithDistance.length > 0 && (
                    <span className='text-sm sm:text-base font-normal text-gray-500 ml-1 sm:ml-2'>
                      ({hospitalsWithDistance.length} found)
                    </span>
                  )}
                </h2>
                <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6'>
                  {paginatedHospitals.map((hospital, idx) => (
                    <div
                      key={hospital._id}
                      onClick={() => handleHospitalClick(hospital)}
                      className='bg-white rounded-lg border border-gray-200 shadow-md hover:shadow-xl hover:border-blue-300 transition-all duration-300 overflow-hidden group cursor-pointer flex flex-col'
                      style={{ animationDelay: `${idx * 0.05}s` }}
                    >
                      {/* Header Section with Icon and Badge */}
                      <div className='bg-gradient-to-br from-blue-50 to-indigo-50 px-6 pt-6 pb-4'>
                        <div className='flex items-start justify-between mb-4'>
                          <div className='w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform'>
                            <svg className='w-7 h-7 text-white' fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                            </svg>
                          </div>
                          <div className='flex flex-col items-end gap-2'>
                            <span className={`text-[10px] px-3 py-1.5 rounded-full font-bold uppercase tracking-wide ${hospital.type === 'Teaching Hospital' || hospital.type === 'Hospital'
                              ? 'bg-white text-white shadow-md'
                              : hospital.type === 'Super Specialty'
                                ? 'bg-white text-white shadow-md'
                                : hospital.type === 'Clinic'
                                  ? 'bg-white text-white shadow-md'
                                  : 'bg-white text-white shadow-md'
                              }`}>
                              {hospital.type === 'Teaching Hospital' ? 'Teaching' : hospital.type === 'Super Specialty' ? 'Specialty' : hospital.type || 'GENERAL'}
                            </span>
                            {viewMode === 'nearby' && hospital.distance && (
                              <span className='text-xs font-bold text-blue-600 flex items-center gap-1'>
                                <svg className='w-3.5 h-3.5' fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                {formatDistance(hospital.distance)}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Hospital Name */}
                        <h3 className='text-lg font-bold text-gray-900 mb-1 line-clamp-2 group-hover:text-blue-600 transition-colors leading-tight'>
                          {hospital.name}
                        </h3>
                      </div>

                      {/* Content Section */}
                      <div className='px-6 py-5 flex-1 space-y-4'>
                        {/* Address */}
                        <div className='flex items-start gap-3'>
                          <div className='w-8 h-8 rounded-lg bg-white flex items-center justify-center flex-shrink-0 mt-0.5'>
                            <svg className='w-4 h-4 text-blue-600' fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                          </div>
                          <span className='text-sm text-gray-700 line-clamp-2 leading-snug'>{hospital.address}</span>
                        </div>

                        {/* Specialties */}
                        {hospital.specialization && (
                          <div className='flex items-start gap-3'>
                            <div className='w-8 h-8 rounded-lg bg-white flex items-center justify-center flex-shrink-0 mt-0.5'>
                              <svg className='w-4 h-4 text-purple-600' fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                              </svg>
                            </div>
                            <span className='text-sm text-gray-700 line-clamp-2 leading-snug font-medium'>{hospital.specialization}</span>
                          </div>
                        )}

                        {/* Contact Number */}
                        {hospital.contact && (
                          <div className='flex items-center gap-3'>
                            <div className='w-8 h-8 rounded-lg bg-white flex items-center justify-center flex-shrink-0'>
                              <svg className='w-4 h-4 text-green-600' fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                              </svg>
                            </div>
                            <span className='text-sm text-gray-700 line-clamp-1 font-medium'>{hospital.contact}</span>
                          </div>
                        )}
                      </div>

                      {/* Footer Section */}
                      <div className='px-6 py-4 bg-white border-t border-gray-100'>
                        <div className='flex items-center justify-between text-blue-600 font-semibold text-sm group-hover:text-blue-700 transition-colors'>
                          <span>View Hospital Details</span>
                          <svg className='w-4 h-4 group-hover:translate-x-1 transition-transform' fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  ))}
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
                  totalItems={filteredHospitals.length}
                />
              </div>
            )}

            {/* Meet Our Experts Doctor Section - Only show when specialty is selected */}
            {speciality && topDoctorsByExperience.length > 0 && !selectedHospital && (
              <div className='mt-12 sm:mt-16 space-y-6'>
                {/* Section Header */}
                <div className='text-center mb-8'>
                  <h2 className='text-2xl sm:text-3xl font-bold text-gray-900 mb-2'>
                    Experts Doctor
                  </h2>
                </div>

                {/* Expert Doctors Cards - Horizontal Layout */}
                <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8 max-w-7xl mx-auto'>
                  {topDoctorsByExperience.slice(0, 3).map((doctor, index) => {
                    const doctorImage = fixDoctorImage(doctor)
                    const isFirstCard = index === 0

                    // Get expertise description based on specialty
                    const getExpertiseText = (specialty) => {
                      const expertiseMap = {
                        'Cardiology': 'With expertise in managing complex heart conditions and performing advanced cardiac procedures',
                        'Orthopedics': 'With expertise in treating bone, joint, and muscle injuries and disorders',
                        'Psychiatry': 'With expertise in treating mental health conditions and providing compassionate care',
                        'Ophthalmology': 'With expertise in diagnosing and treating eye conditions and vision problems',
                        'ENT': 'With expertise in treating ear, nose, and throat disorders',
                        'Dentistry': 'With expertise in dental care, oral health, and cosmetic dentistry',
                        'General Medicine': 'With expertise in treating acute illnesses and injuries',
                        'Pediatrics': 'With experience in managing complex medical conditions in children'
                      }
                      return expertiseMap[specialty] || 'With extensive experience in providing quality healthcare services'
                    }

                    // Get specialty title
                    const getSpecialtyTitle = (specialty) => {
                      const titleMap = {
                        'Cardiology': 'Head of Cardiologist',
                        'Orthopedics': 'Orthopedic Surgeon',
                        'Psychiatry': 'Psychiatrist',
                        'Ophthalmology': 'Ophthalmologist',
                        'ENT': 'ENT Specialist',
                        'Pediatrics': 'Board-certified Pediatrician'
                      }
                      return titleMap[specialty] || `${specialty} Specialist`
                    }

                    const getDoctorNameWithMD = (name, index, degree) => {
                      const degrees = ['MD', 'MBBS', 'MS']
                      const deg = degree || degrees[index % degrees.length]
                      if (name && name.includes(`(${deg})`)) return name.startsWith('Dr.') ? name : `Dr. ${name}`
                      if (name && name.includes('Dr.')) return `${name} (${deg})`
                      return `Dr. ${name} (${deg})`
                    }

                    return (
                      <div
                        key={doctor._id || index}
                        className={`relative rounded-2xl overflow-hidden transition-all duration-300 group flex flex-col h-full ${isFirstCard
                          ? 'bg-gray-100 shadow-lg border border-gray-200'
                          : 'bg-white shadow-md border border-gray-100'
                          } hover:shadow-xl`}
                      >
                        {/* Availability Badge - Top Right of Card */}
                        {doctor.available !== undefined && (
                          <div className='absolute top-3 right-3 z-10'>
                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold shadow-md ${doctor.available
                              ? 'bg-white text-white'
                              : 'bg-gray-400 text-white'
                              }`}>
                              <span className='w-1.5 h-1.5 rounded-full bg-white'></span>
                              {doctor.available ? 'Available' : 'Unavailable'}
                            </span>
                          </div>
                        )}
                        <div className='p-6 flex flex-col items-center text-center h-full w-full'>
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
                          <p className='text-sm font-semibold text-gray-700 mb-3 text-center w-full'>
                            {getSpecialtyTitle(doctor.speciality || doctor.specialization)}
                          </p>

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
              </div>
            )}

            {filteredHospitals.length === 0 && (
              <div className='text-center py-20 px-4'>
                <div className='max-w-md mx-auto'>
                  <div className='w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center'>
                    <svg className='w-12 h-12 text-gray-400' fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <h3 className='text-2xl font-bold text-gray-900 mb-2'>
                    {viewMode === 'nearby'
                      ? 'No Nearby Hospitals Found'
                      : speciality
                        ? `No Hospitals Found for ${speciality}`
                        : 'No Hospitals Found'
                    }
                  </h3>
                  <p className='text-gray-600 font-medium mb-4'>
                    {viewMode === 'nearby'
                      ? 'Unable to find hospitals near your location. Please try enabling location access or switch to "All Hospitals" view.'
                      : speciality
                        ? `No hospitals are currently available for this specialty. Please try a different specialty or check back later.`
                        : 'No hospitals are currently available. Please check back later.'}
                  </p>
                  {viewMode === 'nearby' ? (
                    <button
                      onClick={() => setViewMode('all')}
                      className='px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors'
                    >
                      View All Hospitals
                    </button>
                  ) : speciality && (
                    <button
                      onClick={() => navigate('/doctors')}
                      className='px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors'
                    >
                      View All Hospitals
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
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
    </div>
  )
}

export default Doctors
