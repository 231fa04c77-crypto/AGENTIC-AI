import React, { useContext, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { AppContext } from '../context/AppContext'
import {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from './ui/breadcrumb'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu'

const BackButton = ({ 
  to, 
  label = 'Back',
  className = '',
  docInfo = null
}) => {
  const navigate = useNavigate()
  const location = useLocation()
  const { doctors } = useContext(AppContext)

  // Get route segments from path
  const getRouteSegments = (path) => {
    return path.split('/').filter(Boolean)
  }

  // Check if a string looks like a MongoDB ObjectId (24 hex characters) or a numeric ID
  const isPotentiallyDocId = (str) => {
    return /^[0-9a-fA-F]{24}$/.test(str) || !isNaN(str)
  }

  // Get doctor name from ID
  const getDoctorName = (docId) => {
    // Check prop first (Handles cases where we refresh the page and location state is empty but fetch occurs)
    if (docInfo && (String(docInfo._id) === String(docId) || String(docInfo.id) === String(docId))) {
      return docInfo.name
    }

    // Check navigation state next (crucial for hospital tie-up doctors)
    if (location.state?.doctor) {
      const stateDoc = location.state.doctor
      if (String(stateDoc._id) === String(docId) || String(stateDoc.id) === String(docId)) {
        return stateDoc.name
      }
    }

    // Fallback to global doctors array
    if (doctors && Array.isArray(doctors)) {
      const doctor = doctors.find(doc => String(doc._id) === String(docId) || String(doc.id) === String(docId))
      if (doctor) return doctor.name
    }
    
    return null
  }

  // Format route name for display (capitalize first letter of each word)
  const formatRouteName = (name, segmentIndex, allSegments) => {
    // Decode URL-encoded strings (e.g., %20 -> space)
    let decodedName = name
    try {
      decodedName = decodeURIComponent(name)
    } catch (e) {
      // If decoding fails, use original name
      decodedName = name
    }
    
    // Handle special cases - capitalize first letter
    const routeMap = {
      'home': 'Home',
      'my-appointments': 'My Appointments',
      'my-profile': 'My Profile',
      'privacy-policy': 'Privacy Policy',
      'forgot-password': 'Forgot Password',
      'appointment': 'Appointments',
      'appointments': 'Appointments',
      'doctors': 'Doctors',
      'hospitals': 'Hospitals',
      'all-doctors': 'All Doctors',
      'doctor': 'Doctor',
      'labs': 'Labs & Blood Banks',
      'blood-centers': 'Blood Banks',
      'emergency': 'Emergency Center',
      'contact': 'Contact Us',
      'about': 'About Us',
      'careers': 'Careers',
      'blood-plus': 'Blood+',
      'verify': 'Verification',
      'verify-appointment': 'Appointment Verification',
      'data-security': 'Data Security'
    }
    if (routeMap[decodedName.toLowerCase()]) return routeMap[decodedName.toLowerCase()]
    
    // If this segment is an ObjectId or numeric ID and we're on a doctor/appointment route, try to get doctor name
    if (isPotentiallyDocId(decodedName)) {
      // Check if we're on a doctor or appointment route using both display and original segments
      const isDoctorRoute = allSegments.includes('doctor') || 
                           allSegments.includes('appointment') || 
                           allSegments.includes('appointments') ||
                           segments.includes('appointment') ||
                           segments.includes('appointments')
      
      if (isDoctorRoute) {
        const doctorName = getDoctorName(decodedName)
        if (doctorName) {
          return doctorName // Doctor name is already capitalized
        }
      }
    }
    
    // Capitalize first letter of each word
    // Handle both hyphenated and space-separated names
    if (decodedName.includes(' ')) {
      // Already has spaces (e.g., "General physician")
      return decodedName
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ')
    } else {
      // Hyphenated (e.g., "my-appointments")
      return decodedName
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ')
    }
  }

  const currentPath = location.pathname
  const segments = getRouteSegments(currentPath)

  // If custom 'to' prop is provided, use it for navigation
  const handleHomeClick = () => {
    navigate('/')
  }

  const handleSegmentClick = (segment, index) => {
    // Decode the segment to check its actual value
    const decodedSegment = segment ? (() => {
      try {
        return decodeURIComponent(segment).toLowerCase()
      } catch (e) {
        return segment.toLowerCase()
      }
    })() : segment
    
    // Special handling for specific paths
    if (decodedSegment === 'doctor' || decodedSegment === 'doctors') {
      navigate('/all-doctors')
      return
    }

    // Special handling for appointment middle segment (Hospital Name)
    if (segments.includes('appointment') && index === segments.indexOf('appointment')) {
      // If clicking 'hospital' part of the breadcrumb
      const hospId = location.state?.doctor?.hospital_id || location.state?.doctor?.hospitalId || docInfo?.hospital_id || docInfo?.hospitalId
      if (hospId) {
          navigate(`/hospital/${hospId}`)
      } else {
          navigate('/hospitals')
      }
      return
    }

    if (decodedSegment === 'appointments' || decodedSegment === 'appointment') {
      navigate('/my-appointments')
      return
    }
    
    // Build path up to clicked segment
    const pathSegments = segments.slice(0, index + 1)
    const targetPath = '/' + pathSegments.join('/')
    navigate(targetPath)
  }

  // Don't show breadcrumb on home page
  if (segments.length === 1 && segments[0] === 'home') {
    return null
  }

  // For nested routes like /appointment/:id, show proper breadcrumb path
  const displaySegments = useMemo(() => {
    const result = [...segments]
    
    // Replace 'doctors' with a display-friendly name (it will show as 'Hospitals' via routeMap)
    if (segments.includes('doctors')) {
      const doctorsIndex = segments.indexOf('doctors')
      // Keep 'doctors' but it will display as 'Hospitals' via formatRouteName
    }
    
    // If we're on an appointment page with a doctor ID
    if (segments.includes('appointment')) {
      const appointmentIndex = segments.indexOf('appointment')
      
      // Check if there's an ID after 'appointment'
      if (appointmentIndex + 1 < segments.length) {
        const docId = segments[appointmentIndex + 1]
        
        // If it's a valid ObjectId or numeric ID, we'll show: home/hospital/[doctor name]
        if (isPotentiallyDocId(docId)) {
          // Replace 'appointment' with the specific hospital name or fallback to 'hospital'
          let hospName = 'hospital'
          if (docInfo && (docInfo.hospital_name || docInfo.hospitalName)) {
             hospName = docInfo.hospital_name || docInfo.hospitalName || 'hospital'
          } else if (location.state?.doctor) {
             hospName = location.state.doctor.hospital_name || location.state.doctor.hospitalName || 'hospital'
          }
          result[appointmentIndex] = hospName
          // Keep the docId - it will be replaced with doctor name in formatRouteName
        }
      }
    }
    
    return result
  }, [segments, doctors, docInfo, location.state])

  // For appointment pages, always show full path without ellipsis
  const isAppointmentPage = displaySegments.includes('appointments') || displaySegments.includes('appointment')
  
  // Show ellipsis only if more than 4 segments AND not on appointment page
  const showEllipsis = !isAppointmentPage && displaySegments.length > 4
  const visibleSegments = showEllipsis 
    ? [displaySegments[0], displaySegments[displaySegments.length - 2], displaySegments[displaySegments.length - 1]]
    : displaySegments

  // Get intermediate segments for dropdown
  const intermediateSegments = showEllipsis 
    ? displaySegments.slice(1, -2)
    : []

  return (
    <Breadcrumb className={`w-auto inline-block ${className || ''}`}>
      <BreadcrumbList>
        {visibleSegments.map((segment, index) => {
          const isLast = index === visibleSegments.length - 1
          
          return (
            <React.Fragment key={index}>
              <BreadcrumbItem>
                {isLast ? (
                   <BreadcrumbPage className="text-sm sm:text-base md:text-lg font-bold text-gray-900 tracking-tight">
                     {formatRouteName(segment, index, displaySegments)}
                   </BreadcrumbPage>
                ) : (
                   <BreadcrumbLink 
                     onClick={() => handleSegmentClick(segment, index)}
                     className="cursor-pointer text-sm sm:text-base md:text-lg hover:text-blue-600 transition-colors"
                   >
                     {formatRouteName(segment, index, displaySegments)}
                   </BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {!isLast && <BreadcrumbSeparator className="mx-1 sm:mx-2" />}
            </React.Fragment>
          )
        })}
      </BreadcrumbList>
    </Breadcrumb>
  )
}

export default BackButton
