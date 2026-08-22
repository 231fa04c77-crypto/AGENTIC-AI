import React, { useContext, useEffect, useState, useRef } from 'react'
import { AppContext } from '../context/AppContext'
import axios from 'axios'
import { useNavigate, useLocation } from 'react-router-dom'
import Pagination from '../components/Pagination'
import { getUserLocation, geocodeAddress, calculateDistance, formatDistance, findNearbyHospitals } from '../utils/locationUtils'
import { toast } from 'react-toastify'
import BackButton from '../components/BackButton'
import BackArrow from '../components/BackArrow'
import HospitalBanner from '../components/HospitalBanner'
import useScrollAnimation from '../utils/useScrollAnimation'

const CollaboratedHospitals = () => {
    const { backendUrl } = useContext(AppContext)
    const navigate = useNavigate()
    const location = useLocation()
    const scrollRef = useScrollAnimation()
    const hospitalsSectionRef = useRef(null)
    const [hospitals, setHospitals] = useState([])
    const [loading, setLoading] = useState(true)
    const [currentPage, setCurrentPage] = useState(1)
    const [viewMode, setViewMode] = useState('all') // 'all' or 'nearby'
    const [userLocation, setUserLocation] = useState(null)
    const [hospitalsWithDistance, setHospitalsWithDistance] = useState([])
    const [isLoadingLocation, setIsLoadingLocation] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [hospitalTypeFilter, setHospitalTypeFilter] = useState('All')

    // Get initial specialty from URL
    const searchParams = new URLSearchParams(location.search);
    const initialSpecialty = searchParams.get('speciality') || 'All';
    const [specialtyFilter, setSpecialtyFilter] = useState(initialSpecialty)
    const itemsPerPage = 8

    // Update filter if URL changes
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const spec = params.get('speciality');
        if (spec) {
            setSpecialtyFilter(spec);
        } else {
            setSpecialtyFilter('All');
        }
    }, [location.search]);

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

    // Get user location and find REAL nearby hospitals from OpenStreetMap
    useEffect(() => {
        // BUG FIX: isMounted guard prevents stale async callbacks from updating
        // state after the effect has been cleaned up (e.g. user switched back to 'all')
        let isMounted = true

        const fetchRealNearbyHospitals = async () => {
            if (viewMode !== 'nearby') {
                // Switching back to 'all' — just clear nearby results
                setHospitalsWithDistance([])
                setIsLoadingLocation(false)
                return
            }

            // --- ⚡ SPEED OPTIMIZATION: Check Session Cache First ---
            const cachedData = sessionStorage.getItem('nearbyHospitalsCache');
            if (cachedData) {
                try {
                    const { hospitals: cachedHospitals, timestamp, lat, lon, radius: cachedRadius } = JSON.parse(cachedData);
                    const now = new Date().getTime();

                    // If cache is less than 1 minute old AND the radius matches, use it
                    if (now - timestamp < 1 * 60 * 1000 && cachedRadius === 10) {
                        console.log('Using cached nearby hospitals for speed');
                        if (isMounted) {
                            setHospitalsWithDistance(cachedHospitals);
                            setUserLocation({ lat, lon });
                            setIsLoadingLocation(false);
                        }
                        return; // Exit early! Very fast.
                    }
                } catch (e) {
                    console.error('Cache error:', e);
                }
            }

            if (isMounted) setIsLoadingLocation(true)
            console.log('Starting to find nearby hospitals...')

            try {
                // Get user location
                const loc = await getUserLocation()
                if (!isMounted) return
                setUserLocation(loc)

                // Find REAL nearby hospitals using backend API (from OpenStreetMap)
                let discoveredHospitals = []
                try {
                    discoveredHospitals = await findNearbyHospitals(
                        loc.lat,
                        loc.lon,
                        10, // 10km range
                        backendUrl
                    )
                } catch (fetchErr) {
                    console.error('Discovery error:', fetchErr)
                    // We continue even if discovery fails, so we can at least show partnered hospitals
                }

                if (!isMounted) return

                // 1. Process partnered hospitals from our database
                const nearbyPartnered = hospitals
                    .map(h => {
                        if (h.latitude && h.longitude) {
                            const dist = calculateDistance(loc.lat, loc.lon, h.latitude, h.longitude);
                            return { ...h, distance: dist, isRealHospital: false };
                        }
                        return null;
                    })
                    .filter(h => h !== null && h.distance <= 10);

                // 2. Format external discoveries
                const nearbyDiscoveries = (discoveredHospitals || []).map(hospital => ({
                    _id: `osm_${hospital.latitude}_${hospital.longitude}`,
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
                    isRealHospital: true
                }));

                // 3. Combine and sort
                const combined = [...nearbyPartnered, ...nearbyDiscoveries]
                    .sort((a, b) => (a.distance || 0) - (b.distance || 0));

                if (combined.length === 0) {
                    // BUG FIX: Do NOT call setViewMode('all') here — it caused a recursive
                    // useEffect loop: (empty result → setViewMode('all') → effect re-runs →
                    // setHospitalsWithDistance([]) → blank screen every single time).
                    // Instead, show an empty state with a manual switch button.
                    toast.info('No hospitals found within 10km of your location.', { position: "top-center" });
                    setHospitalsWithDistance([])
                } else {
                    setHospitalsWithDistance(combined);

                    // Cache results
                    sessionStorage.setItem('nearbyHospitalsCache', JSON.stringify({
                        hospitals: combined,
                        lat: loc.lat,
                        lon: loc.lon,
                        radius: 10,
                        timestamp: new Date().getTime()
                    }));
                }
            } catch (error) {
                if (!isMounted) return
                console.error('Error getting location or nearby hospitals:', error)

                let errorMsg = 'Unable to find nearby hospitals. Please try again later.'
                let autoClose = 3000
                const errMsg = error.message || ''

                if (error.code === 'INSECURE_CONTEXT' || error.code === 'INSECURE_CONTEXT_FAIL') {
                    errorMsg = 'Location requires HTTPS. Please access the site via a secure connection (HTTPS) or from localhost.'
                    autoClose = 6000
                } else if (errMsg.includes('denied') || error.code === 1) {
                    errorMsg = 'Location access denied. Please enable location permissions in your browser settings.'
                    autoClose = 5000
                } else if (errMsg.includes('timeout') || errMsg.includes('timed out') || error.code === 3) {
                    errorMsg = 'Location request timed out. Please check your GPS signal and try again.'
                } else if (error.code === 'NOT_SUPPORTED') {
                    errorMsg = 'Your browser does not support location services.'
                } else if (errMsg) {
                    errorMsg = errMsg
                }

                toast.error(errorMsg, {
                    position: "top-center",
                    autoClose: autoClose,
                })

                // BUG FIX: Do NOT call setViewMode('all') here — it caused the useEffect
                // to re-run, clearing hospitalsWithDistance and creating a blank screen loop.
                // The user can manually click "All" to switch back.
                setHospitalsWithDistance([])
            } finally {
                if (isMounted) setIsLoadingLocation(false)
            }
        }

        fetchRealNearbyHospitals()

        // Cleanup: mark component as unmounted so stale async updates are ignored
        return () => { isMounted = false }
    }, [viewMode, backendUrl])

    // Get hospitals based on view mode
    const hospitalsToFilter = viewMode === 'nearby' ? hospitalsWithDistance : hospitals

    // Filter hospitals by search query, specialty and type
    const filteredHospitals = hospitalsToFilter.filter(hospital => {
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

        // Filter by specialty
        if (specialtyFilter !== 'All') {
            if (hospital.specialization !== specialtyFilter) return false;
        }

        // Filter by hospital type
        if (hospitalTypeFilter !== 'All') {
            if (hospitalTypeFilter === 'Teaching Hospital' && hospital.type !== 'Teaching Hospital') return false;
            if (hospitalTypeFilter === 'Super Specialty' && hospital.type !== 'Super Specialty') return false;
            if (hospitalTypeFilter === 'General' && hospital.type !== 'General') return false;
        }

        return true;
    });

    // Reset to page 1 when filters change
    useEffect(() => {
        setCurrentPage(1)
    }, [viewMode, searchQuery, hospitalTypeFilter])

    // Calculate pagination
    const totalPages = Math.ceil(filteredHospitals.length / itemsPerPage)
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    const paginatedHospitals = filteredHospitals.slice(startIndex, endIndex)

    return (
        <div className='page-container fade-in' ref={scrollRef}>
            {/* Back Navigation */}
            <div className='mb-2 flex items-center gap-4 slide-down'>
                <BackArrow />
                <BackButton to="/" label="Back to Home" />
            </div>


            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-0 relative z-10">
                {/* Header Section */}
                <div className='text-center mb-2 sm:mb-4 px-4 anim-header'>
                    <h1 className='text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-1 sm:mb-2'>
                        All <span className='text-cyan-500'>Hospitals</span>
                    </h1>
                    <p className='text-sm sm:text-base text-gray-600 max-w-2xl mx-auto'>
                        Browse our network of trusted, collaborated hospitals near you.
                    </p>
                </div>

                {/* Hospital Banner Section */}
                <HospitalBanner />

                <div ref={hospitalsSectionRef}></div>
                {/* Search and Filters Section - All in One Row */}
                {!loading && (
                    <div className='mb-5 anim-section'>
                        {/* Single Row with Search + All Filters */}
                        <div className='flex flex-wrap items-center gap-2 sm:gap-3 bg-gray-50/80 rounded-xl p-3 border border-gray-100'>
                            {/* Search Bar - Takes remaining space */}
                            <div className='relative flex-1 min-w-[280px]'>
                                <div className='absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none'>
                                    <svg className='h-5 w-5 text-gray-400' fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                </div>
                                <input
                                    type='text'
                                    placeholder='Search hospitals by name, address, specialization, or contact...'
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className='w-full pl-12 pr-12 py-2.5 border border-gray-200 rounded-lg bg-white text-gray-900 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm transition-all'
                                />
                                {searchQuery && (
                                    <button
                                        onClick={() => setSearchQuery('')}
                                        className='absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600 transition-colors'
                                    >
                                        <svg className='h-5 w-5' fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                )}
                            </div>

                            {/* View Filter Toggle */}
                            <div className='flex items-center gap-2'>
                                <label className='text-xs sm:text-sm font-semibold text-gray-700 uppercase tracking-wide whitespace-nowrap'>View:</label>
                                <div className='inline-flex bg-white p-1 rounded-lg border border-gray-200 shadow-sm'>
                                    <button
                                        onClick={() => setViewMode('all')}
                                        className={`px-3 sm:px-4 py-1.5 rounded-md text-xs sm:text-sm font-semibold transition-all ${viewMode === 'all'
                                            ? 'bg-blue-600 text-white shadow-sm'
                                            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                                            }`}
                                    >
                                        All
                                    </button>
                                    <button
                                        onClick={() => setViewMode('nearby')}
                                        className={`px-3 sm:px-4 py-1.5 rounded-md text-xs sm:text-sm font-semibold transition-all flex items-center gap-1.5 ${viewMode === 'nearby'
                                            ? 'bg-blue-600 text-white shadow-sm'
                                            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                                            }`}
                                    >
                                        <svg className='w-3.5 h-3.5 sm:w-4 sm:h-4' fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                        </svg>
                                        Nearby
                                    </button>
                                </div>
                            </div>

                            {/* Specialty Filter */}
                            <div className='flex items-center gap-2'>
                                <label className='text-xs sm:text-sm font-semibold text-gray-700 uppercase tracking-wide whitespace-nowrap'>Specialty:</label>
                                <div className="relative">
                                    <select
                                        value={specialtyFilter}
                                        onChange={(e) => {
                                            setSpecialtyFilter(e.target.value);
                                            const params = new URLSearchParams(location.search);
                                            if (e.target.value === 'All') params.delete('speciality');
                                            else params.set('speciality', e.target.value);
                                            navigate({ search: params.toString() });
                                        }}
                                        className='px-3 sm:px-4 py-2 border border-gray-200 rounded-lg bg-white text-gray-700 text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 cursor-pointer appearance-none pr-8 sm:pr-10 shadow-sm hover:border-gray-300 transition-colors'
                                    >
                                        <option value="All">All Specialties</option>
                                        {[...new Set(hospitals.map(h => h.specialization).filter(Boolean))].sort().map(spec => (
                                            <option key={spec} value={spec}>{spec}</option>
                                        ))}
                                    </select>
                                    <div className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                                        <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </div>
                                </div>
                            </div>

                            {/* Type Filter */}
                            <div className='flex items-center gap-2'>
                                <label className='text-xs sm:text-sm font-semibold text-gray-700 uppercase tracking-wide whitespace-nowrap'>Type:</label>
                                <div className="relative">
                                    <select
                                        value={hospitalTypeFilter}
                                        onChange={(e) => setHospitalTypeFilter(e.target.value)}
                                        className='px-3 sm:px-4 py-2 border border-gray-200 rounded-lg bg-white text-gray-700 text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 cursor-pointer appearance-none pr-8 sm:pr-10 shadow-sm hover:border-gray-300 transition-colors'
                                    >
                                        <option value="All">All Types</option>
                                        <option value="Teaching Hospital">Teaching Hospital</option>
                                        <option value="Super Specialty">Super Specialty</option>
                                        <option value="General">General</option>
                                    </select>
                                    <div className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                                        <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Content Area */}
                {loading ? (
                    /* Loading State - Initial Load */
                    <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5'>
                        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                            <div key={i} className="bg-white rounded-xl p-5 border border-gray-200 animate-pulse h-[320px] flex flex-col gap-4">
                                <div className="w-14 h-14 bg-gray-200 rounded-xl"></div>
                                <div className="h-6 bg-gray-200 w-3/4 rounded-lg"></div>
                                <div className="h-4 bg-gray-200 w-full rounded-md"></div>
                                <div className="h-4 bg-gray-200 w-2/3 rounded-md mt-auto"></div>
                            </div>
                        ))}
                    </div>
                ) : isLoadingLocation ? (
                    /* Loading State - Finding Nearby Hospitals (Embedded in page) */
                    <div className="flex items-center justify-center min-h-[450px] bg-white rounded-xl border border-gray-200 shadow-sm">
                        <div className="flex flex-col items-center justify-center w-full max-w-md px-4 py-12">
                            <div className="relative mb-8">
                                <div className="w-20 h-20 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                </div>
                            </div>
                            <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3 text-center">Finding Nearby Hospitals</h3>
                            <p className="text-gray-600 text-center max-w-md mb-6 text-sm sm:text-base">
                                Please wait while we locate hospitals near you. This may take a few seconds...
                            </p>
                            <div className="flex gap-2 justify-center">
                                <div className="w-2.5 h-2.5 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                                <div className="w-2.5 h-2.5 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                                <div className="w-2.5 h-2.5 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                            </div>
                        </div>
                    </div>
                ) : filteredHospitals.length === 0 ? (
                    <div className="text-center py-24 bg-white rounded-xl border border-gray-200 shadow-sm max-w-2xl mx-auto">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                            </svg>
                        </div>
                        <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">
                            {viewMode === 'nearby' ? 'No Nearby Hospitals Found' : 'No Hospitals Found'}
                        </h3>
                        <p className="text-gray-600 mb-6 text-sm sm:text-base">
                            {viewMode === 'nearby'
                                ? 'Unable to find hospitals near your location. Please enable location access or switch to "All Hospitals" view.'
                                : 'No hospitals match your search criteria. Please try different filters.'}
                        </p>
                        {viewMode === 'nearby' && (
                            <button
                                onClick={() => setViewMode('all')}
                                className='px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors shadow-sm'
                            >
                                View All Hospitals
                            </button>
                        )}
                    </div>
                ) : (
                    <>
                        {/* Hospital Grid - Added top margin for spacing */}
                        <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-4 justify-items-center anim-grid'>
                            {paginatedHospitals.map((hospital, index) => (
                                <div
                                    key={index}
                                    onClick={() => {
                                        if (!hospital.isRealHospital) {
                                            navigate(`/hospital/${hospital._id}`)
                                        }
                                    }}
                                    className='group relative bg-white rounded-xl p-4 border border-gray-200 hover:shadow-lg hover:border-blue-400 transition-all duration-300 cursor-pointer flex flex-col h-full w-full card-hover-lift'
                                >
                                    {/* Header with Icon and Badge */}
                                    <div className='flex items-start justify-between mb-3'>
                                        <div className='w-11 h-11 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform duration-300 relative'>
                                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                            </svg>
                                        </div>
                                        <div className="flex flex-col items-end gap-2">
                                            <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${hospital.type === 'Teaching Hospital'
                                                ? 'bg-purple-600 text-white'
                                                : hospital.type === 'Super Specialty'
                                                    ? 'bg-blue-600 text-white'
                                                    : 'bg-gray-600 text-white'
                                                }`}>
                                                {hospital.type || 'GENERAL'}
                                            </span>
                                            {viewMode === 'nearby' && hospital.distance && (
                                                <span className='text-xs font-semibold text-blue-600 flex items-center gap-1 bg-blue-50 px-2 py-0.5 rounded-full'>
                                                    <svg className='w-3 h-3' fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                                    </svg>
                                                    {formatDistance(hospital.distance)}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Hospital Name */}
                                    <h3 className='text-base font-bold text-gray-900 mb-2 leading-tight line-clamp-2 min-h-[2.8rem]' title={hospital.name}>
                                        {hospital.name}
                                    </h3>

                                    {/* Hospital Details */}
                                    <div className='space-y-2 flex-1'>
                                        {/* Location */}
                                        <div className='flex items-start gap-2'>
                                            <div className="w-7 h-7 rounded-md bg-blue-50 flex items-center justify-center shrink-0 mt-0.5">
                                                <svg className="w-3.5 h-3.5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                                </svg>
                                            </div>
                                            <p className='text-xs text-gray-600 leading-snug line-clamp-2 pt-0.5'>{hospital.address}</p>
                                        </div>

                                        {/* Specialization */}
                                        {hospital.specialization && (
                                            <div className='flex items-center gap-2'>
                                                <div className="w-7 h-7 rounded-md bg-purple-50 flex items-center justify-center shrink-0">
                                                    <svg className="w-3.5 h-3.5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                                    </svg>
                                                </div>
                                                <p className='text-xs text-gray-700 font-semibold pt-0.5'>{hospital.specialization}</p>
                                            </div>
                                        )}

                                        {/* Contact */}
                                        <div className='flex items-center gap-2'>
                                            <div className="w-7 h-7 rounded-md bg-green-50 flex items-center justify-center shrink-0">
                                                <svg className="w-3.5 h-3.5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                                </svg>
                                            </div>
                                            <p className="text-xs font-semibold text-gray-900 pt-0.5">{hospital.contact}</p>
                                        </div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className='mt-auto pt-4 flex flex-col gap-2'>
                                        <div className='flex gap-2'>
                                            <button
                                                disabled={!hospital.contact || hospital.contact === 'Not available'}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (hospital.contact && hospital.contact !== 'Not available') {
                                                        window.open(`tel:${hospital.contact}`, '_self');
                                                    }
                                                }}
                                                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold transition-colors ${!hospital.contact || hospital.contact === 'Not available'
                                                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                                        : 'bg-green-50 text-green-700 hover:bg-green-100'
                                                    }`}
                                            >
                                                <svg className='w-3.5 h-3.5' fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                                </svg>
                                                {(!hospital.contact || hospital.contact === 'Not available') ? 'No Phone' : 'Call Now'}
                                            </button>

                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    const phoneStr = (hospital.contact && hospital.contact !== 'Not available') ? ` - Phone: ${hospital.contact}` : '';
                                                    toast.info(`${hospital.name}${phoneStr}`, { position: "top-center", autoClose: 3000 });

                                                    const lat = hospital.latitude || hospital.coordinates?.lat;
                                                    const lon = hospital.longitude || hospital.coordinates?.lon;
                                                    const name = encodeURIComponent(hospital.name);
                                                    const mapUrl = (lat && lon)
                                                        ? `https://www.google.com/maps/place/${name}/@${lat},${lon},17z`
                                                        : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(hospital.name + ' ' + (hospital.address || ''))}`;
                                                    window.open(mapUrl, '_blank');
                                                }}
                                                className='flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-bold transition-colors'
                                            >
                                                <svg className='w-3.5 h-3.5' fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                                </svg>
                                                View
                                            </button>
                                        </div>

                                        {!hospital.isRealHospital && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    navigate(`/hospital/${hospital._id}`);
                                                }}
                                                className='w-full flex items-center justify-center gap-2 py-2.5 bg-gray-900 text-white hover:bg-black rounded-lg text-xs font-bold transition-all shadow-sm'
                                            >
                                                View Hospital
                                                <svg className='w-4 h-4' fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                </svg>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                        {/* Pagination */}
                        {filteredHospitals.length > itemsPerPage && (
                            <Pagination
                                currentPage={currentPage}
                                totalPages={totalPages}
                                onPageChange={(page) => {
                                    setCurrentPage(page)
                                    setTimeout(() => {
                                        if (hospitalsSectionRef.current) {
                                            const yOffset = -90; // Navbar offset + spacing
                                            const element = hospitalsSectionRef.current;
                                            const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;
                                            window.scrollTo({ top: y, behavior: 'smooth' });
                                        } else {
                                            window.scrollTo({ top: 0, behavior: 'smooth' });
                                        }
                                    }, 50)
                                }}
                                itemsPerPage={itemsPerPage}
                                totalItems={filteredHospitals.length}
                            />
                        )}
                    </>
                )}
            </div>
        </div>
    )
}

export default CollaboratedHospitals
