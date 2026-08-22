import React, { useState, useEffect, useContext } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import axios from 'axios'
import BackButton from '../components/BackButton'
import BackArrow from '../components/BackArrow'
import { AppContext } from '../context/AppContext'

const Emergency = () => {
  const navigate = useNavigate()
  const { backendUrl, userData, token } = useContext(AppContext)
  const [countdown, setCountdown] = useState(null)
  const [location, setLocation] = useState(null)
  const [isActivated, setIsActivated] = useState(false)
  const [locationError, setLocationError] = useState(false)
  const [friends, setFriends] = useState([])
  const [family, setFamily] = useState([])
  const [showAddForm, setShowAddForm] = useState({ type: null, editing: null })
  const [formData, setFormData] = useState({ name: '', phone: '', relation: '' })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [policeStations, setPoliceStations] = useState([])
  const [hospitals, setHospitals] = useState([])
  const [lastFetchTime, setLastFetchTime] = useState(null)
  const [lastFetchLocation, setLastFetchLocation] = useState(null)
  const [partnerHospitals, setPartnerHospitals] = useState([])
  const [loadingPartnerHospitals, setLoadingPartnerHospitals] = useState(false)
  const [loadingPlaces, setLoadingPlaces] = useState(false)

  // Emergency contact numbers
  const emergencyNumbers = {
    ambulance: '108',
    police: '100'
  }

  // Calculate distance between two coordinates (Haversine formula)
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371 // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLon = (lon2 - lon1) * Math.PI / 180
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
  }

  // Fetch nearby places using Overpass API with rate limiting and caching
  const fetchNearbyPlaces = async (userLat, userLon, radius = 10, retryCount = 0) => {
    // Check if we have cached results for this location (within 100m)
    if (lastFetchLocation && lastFetchTime) {
      const distance = calculateDistance(
        lastFetchLocation.lat,
        lastFetchLocation.lon,
        userLat,
        userLon
      )
      const timeSinceLastFetch = Date.now() - lastFetchTime

      // Use cache if location is within 100m and fetch was less than 5 minutes ago
      if (distance < 0.1 && timeSinceLastFetch < 5 * 60 * 1000) {
        console.log('Using cached nearby places')
        return
      }
    }

    // Rate limiting: Don't fetch if last request was less than 10 seconds ago
    if (lastFetchTime && Date.now() - lastFetchTime < 10000) {
      console.log('Rate limit: Waiting before next request')
      toast.info('Please wait a moment before refreshing')
      return
    }

    setLoadingPlaces(true)
    setLastFetchTime(Date.now())
    setLastFetchLocation({ lat: userLat, lon: userLon })

    try {
      // Overpass API query for police stations and hospitals
      const overpassQuery = `
        [out:json][timeout:25];
        (
          node["amenity"="police"](around:${radius * 1000},${userLat},${userLon});
          way["amenity"="police"](around:${radius * 1000},${userLat},${userLon});
          node["amenity"~"^(hospital|clinic)"](around:${radius * 1000},${userLat},${userLon});
          way["amenity"~"^(hospital|clinic)"](around:${radius * 1000},${userLat},${userLon});
        );
        out center;
      `

      // Try multiple Overpass API endpoints for better reliability
      const endpoints = [
        'https://overpass-api.de/api/interpreter',
        'https://overpass.kumi.systems/api/interpreter',
        'https://lz4.overpass-api.de/api/interpreter'
      ]

      let response = null

      // Try each endpoint
      for (const endpoint of endpoints) {
        try {
          response = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: `data=${encodeURIComponent(overpassQuery)}`
          })

          // If we get 429, try next endpoint or wait
          if (response.status === 429) {
            console.log(`Rate limited on ${endpoint}, trying next...`)
            if (retryCount < 2) {
              // Wait before retry (exponential backoff)
              await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 2000))
              return fetchNearbyPlaces(userLat, userLon, radius, retryCount + 1)
            }
            continue
          }

          if (response.ok) {
            break // Success, exit loop
          }
        } catch (error) {
          console.log(`Error with ${endpoint}:`, error)
          continue
        }
      }

      if (!response || !response.ok) {
        if (response?.status === 429) {
          throw new Error('Too many requests. Please wait a moment and try again.')
        }
        throw new Error(`Overpass API request failed: ${response?.status || 'Network error'}`)
      }

      const data = await response.json()

      const policeList = []
      const hospitalList = []

      // Process results
      data.elements?.forEach(element => {
        const tags = element.tags || {}
        const amenity = tags.amenity

        // Get coordinates
        let lat, lon
        if (element.type === 'node') {
          lat = element.lat
          lon = element.lon
        } else if (element.center) {
          lat = element.center.lat
          lon = element.center.lon
        } else if (element.lat && element.lon) {
          lat = element.lat
          lon = element.lon
        }

        if (!lat || !lon) return

        const distance = calculateDistance(userLat, userLon, lat, lon)
        const place = {
          name: tags.name || tags['name:en'] || tags['name:hi'] || 'Unnamed',
          address: tags['addr:full'] ||
            `${tags['addr:street'] || ''} ${tags['addr:city'] || ''} ${tags['addr:state'] || ''}`.trim() ||
            'Address not available',
          phone: tags.phone || tags['contact:phone'] || (amenity === 'police' ? '100' : '108'),
          latitude: lat,
          longitude: lon,
          distance: distance.toFixed(1)
        }

        if (amenity === 'police') {
          policeList.push(place)
        } else if (amenity === 'hospital' || amenity === 'clinic') {
          hospitalList.push(place)
        }
      })

      // Sort by distance and take nearest 3
      policeList.sort((a, b) => parseFloat(a.distance) - parseFloat(b.distance))
      hospitalList.sort((a, b) => parseFloat(a.distance) - parseFloat(b.distance))

      setPoliceStations(policeList.slice(0, 3))
      setHospitals(hospitalList.slice(0, 3))
    } catch (error) {
      console.error('Error fetching nearby places:', error)

      // Handle rate limiting specifically
      if (error.message.includes('Too many requests') || error.message.includes('429')) {
        toast.warning('Too many requests. Please wait 30 seconds before refreshing.', {
          autoClose: 5000
        })
        // Reset last fetch time to allow retry after delay
        setLastFetchTime(Date.now() - 20000) // Allow retry after 30 seconds
      } else {
        toast.error('Could not fetch nearby places. Using emergency numbers.')
      }

      // Fallback to emergency numbers if API fails
      if (policeStations.length === 0) {
        setPoliceStations([{
          name: 'Emergency Police',
          phone: '100',
          address: 'Dial 100 for police emergency',
          distance: 'N/A',
          latitude: userLat,
          longitude: userLon
        }])
      }
      if (hospitals.length === 0) {
        setHospitals([{
          name: 'Emergency Ambulance',
          phone: '108',
          address: 'Dial 108 for medical emergency',
          distance: 'N/A',
          latitude: userLat,
          longitude: userLon
        }])
      }
    } finally {
      setLoadingPlaces(false)
    }
  }

  // Fetch nearby verified MedClues Partner hospitals
  const getPartnerHospitals = async (lat, lon) => {
    try {
      setLoadingPartnerHospitals(true)
      const { data } = await axios.get(`${backendUrl}/api/hospital-tieup/nearby`, {
        params: { lat, lon, radius: 50.0 }
      })
      if (data.success) {
        setPartnerHospitals(data.hospitals)
      }
    } catch (error) {
      console.error('Error fetching partner hospitals:', error)
    } finally {
      setLoadingPartnerHospitals(false)
    }
  }

  // Load contacts from backend API
  const loadContacts = async () => {
    if (!token) {
      // Not logged in - show empty state
      setFriends([])
      setFamily([])
      return
    }

    try {
      const { data } = await axios.get(backendUrl + '/api/user/emergency-contacts', {
        headers: { token }
      })

      if (data.success) {
        setFriends(data.contacts.friends || [])
        setFamily(data.contacts.family || [])
      } else {
        toast.error(data.message || 'Failed to load contacts')
      }
    } catch (error) {
      console.error('Error loading contacts:', error)
      if (error.response?.status === 401) {
        // Not authenticated - redirect to login
        toast.error('Please login to access emergency contacts')
        navigate('/login')
      } else {
        toast.error('Failed to load contacts')
      }
    }
  }

  useEffect(() => {
    // Check if user is logged in
    if (!token) {
      // Still allow viewing the page but contacts will be empty
      // Don't show toast - user can see the login prompt in the UI
    } else {
      loadContacts()
    }

    // Request location immediately when page loads
    getCurrentLocation().catch(error => {
      // Error handling is done inside getCurrentLocation function
      // This catch is just to prevent unhandled promise rejection
      // Only log final errors (not retryable ones)
      if (error && error.code !== undefined) {
        const errorCodes = {
          1: 'PERMISSION_DENIED',
          2: 'POSITION_UNAVAILABLE',
          3: 'TIMEOUT'
        }
        // Only log if it's a final error (not being retried)
        if (error.code === 1 || (error.code === 3 && error.message && error.message.includes('final'))) {
          console.log('Location error (final):', errorCodes[error.code] || 'UNKNOWN', error)
        }
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  // Fetch nearby places when location is available (with debounce)
  useEffect(() => {
    if (location && location.latitude && location.longitude) {
      // Debounce: Wait 1 second after location is set before fetching
      const timer = setTimeout(() => {
        fetchNearbyPlaces(location.latitude, location.longitude)
        getPartnerHospitals(location.latitude, location.longitude)
      }, 1000)

      return () => clearTimeout(timer)
    }
  }, [location])

  // Get user's current location
  const getCurrentLocation = (retryCount = 0) => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        const error = new Error('Geolocation is not supported by your browser')
        setLocationError(true)
        toast.error('Location services are not available on this device')
        reject(error)
        return
      }

      // Increase timeout on retry (10s, 15s, 20s)
      const timeout = 10000 + (retryCount * 5000)
      const maxRetries = 2

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords
          const loc = { latitude, longitude }
          setLocation(loc)
          setLocationError(false)
          if (retryCount > 0) {
            toast.success('Location retrieved successfully', { autoClose: 2000 })
          }
          resolve(loc)
        },
        (error) => {
          let errorMessage = 'Unable to get your location'
          let shouldRetry = false

          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = 'Location permission denied. Please enable location access in your browser settings.'
              setLocationError(true)
              toast.error(errorMessage, { autoClose: 5000 })
              break
            case error.POSITION_UNAVAILABLE:
              errorMessage = 'Location information is unavailable. Please check your device settings.'
              setLocationError(true)
              if (retryCount < maxRetries) {
                shouldRetry = true
                toast.warning(`Retrying to get location... (${retryCount + 1}/${maxRetries})`, { autoClose: 3000 })
              } else {
                toast.error(errorMessage, { autoClose: 5000 })
              }
              break
            case error.TIMEOUT:
              errorMessage = 'Location request timed out. This may be due to poor GPS signal or network issues.'
              setLocationError(true)
              if (retryCount < maxRetries) {
                shouldRetry = true
                toast.warning(`Retrying location request (${retryCount + 1}/${maxRetries})...`, { autoClose: 3000 })
              } else {
                toast.error(errorMessage + ' You can try again manually.', { autoClose: 6000 })
              }
              break
            default:
              errorMessage = 'An unknown error occurred while getting your location.'
              setLocationError(true)
              if (retryCount < maxRetries) {
                shouldRetry = true
              } else {
                toast.error(errorMessage, { autoClose: 5000 })
              }
              break
          }

          // Retry logic for timeout and position unavailable errors
          if (shouldRetry && retryCount < maxRetries) {
            setTimeout(() => {
              getCurrentLocation(retryCount + 1)
                .then(resolve)
                .catch(reject)
            }, 2000) // Wait 2 seconds before retry
          } else {
            // Only log to console if we're not retrying
            if (!shouldRetry) {
              console.log('Location error (final):', error)
            }
            reject(error)
          }
        },
        {
          timeout: timeout,
          enableHighAccuracy: retryCount === 0, // Only use high accuracy on first attempt
          maximumAge: 60000 // Accept cached position up to 1 minute old
        }
      )
    })
  }

  // Start emergency countdown
  const startEmergencyCountdown = async () => {
    try {
      // Get fresh location for emergency
      const currentLoc = await getCurrentLocation()
      // Ensure nearby places are loaded
      if (currentLoc && (policeStations.length === 0 || hospitals.length === 0)) {
        await fetchNearbyPlaces(currentLoc.latitude, currentLoc.longitude)
      }
    } catch (error) {
      console.error('Location error:', error)
      toast.error('Could not get location. Emergency will still activate.')
    }
    setCountdown(10)
    setIsActivated(false)
  }

  // Cancel emergency
  const cancelEmergency = () => {
    setCountdown(null)
    setIsActivated(false)
    toast.info('Emergency cancelled')
  }

  // Send SMS via backend API (no authentication required for emergency)
  const sendEmergencySMS = async (phone, patientName, locationText) => {
    try {
      const cleanPhone = phone.replace(/\D/g, '')
      await axios.post(backendUrl + '/api/emergency/send-alert', {
        phone: cleanPhone,
        patientName: patientName || 'Emergency Contact',
        location: locationText
      })
    } catch (error) {
      console.error('Error sending emergency SMS:', error)
      // Fallback to native SMS on mobile devices
      if (window.navigator.userAgent.match(/Mobile|Android|iPhone|iPad/i)) {
        const smsUrl = `sms:${phone.replace(/\D/g, '')}?body=${encodeURIComponent(locationText)}`
        window.location.href = smsUrl
      }
    }
  }

  // Execute all emergency actions
  const activateEmergency = async () => {
    setIsActivated(true)
    setCountdown(null)
    toast.success('Emergency activated! Notifying all contacts...', { autoClose: 2000 })

    let currentLocation = location
    if (!currentLocation) {
      try {
        currentLocation = await getCurrentLocation()
      } catch (error) {
        console.error('Failed to get location:', error)
      }
    }

    const locationText = currentLocation
      ? `🚨 EMERGENCY ALERT 🚨\n\nI need immediate help!\n\nMy Location:\nhttps://www.google.com/maps?q=${currentLocation.latitude},${currentLocation.longitude}\n\nCoordinates:\nLat: ${currentLocation.latitude.toFixed(6)}\nLng: ${currentLocation.longitude.toFixed(6)}\n\nPlease help or contact emergency services.`
      : '🚨 EMERGENCY ALERT 🚨\n\nI need immediate help!\n\nPlease contact emergency services immediately.'

    const nameToUse = (userData && userData.name) ? userData.name : 'Emergency Contact'

    // 1. Immediately "Ask" to call Ambulance (108)
    // This triggers the browser's native call prompt
    setTimeout(() => {
      window.location.href = `tel:${emergencyNumbers.ambulance}`
      toast.info("Opening phone dialer for Ambulance (108)...", { position: "top-center" })
    }, 500)

    // 2. Send SMS alerts to all contacts IN THE BACKGROUND
    // We do this via the backend so it doesn't depend on the user's phone dialer
    friends.forEach((friend) => {
      sendEmergencySMS(friend.phone, nameToUse, locationText)
    })

    family.forEach((member) => {
      sendEmergencySMS(member.phone, nameToUse, locationText)
    })

    // 3. Notify Nearest Police Station in background if available
    if (policeStations.length > 0) {
      const nearestPolice = policeStations[0]
      const policeMessage = `EMERGENCY: Need immediate police assistance. ${locationText}`
      sendEmergencySMS(nearestPolice.phone, nameToUse, policeMessage)
    }

    // 5. Call and message nearest police station
    if (policeStations.length > 0) {
      const nearestPolice = policeStations[0]
      setTimeout(() => {
        window.location.href = `tel:${nearestPolice.phone.replace(/\D/g, '')}`
      }, 5500 + ((friends.length + family.length) * 2000))

      setTimeout(() => {
        const policeMessage = `EMERGENCY: Need immediate police assistance. ${locationText}`
        sendEmergencySMS(nearestPolice.phone, nameToUse, policeMessage)
      }, 6000 + ((friends.length + family.length) * 2000))
    }

    // 6. Call and message nearest hospital
    if (hospitals.length > 0) {
      const nearestHospital = hospitals[0]
      setTimeout(() => {
        window.location.href = `tel:${nearestHospital.phone.replace(/\D/g, '')}`
      }, 6500 + ((friends.length + family.length) * 2000))

      setTimeout(() => {
        const hospitalMessage = `EMERGENCY: Patient needs immediate medical attention. ${locationText}`
        sendEmergencySMS(nearestHospital.phone, nameToUse, hospitalMessage)
      }, 7000 + ((friends.length + family.length) * 2000))

      // 7. Open Nearest Hospital in Maps
      setTimeout(() => {
        if (currentLocation) {
          const hospitalUrl = `https://www.google.com/maps/dir/${currentLocation.latitude},${currentLocation.longitude}/${nearestHospital.latitude},${nearestHospital.longitude}`
          window.open(hospitalUrl, '_blank')
        }
      }, 7500 + ((friends.length + family.length) * 2000))
    }
  }

  // Handle add/edit contact form (via API)
  const handleSubmitContact = async (e) => {
    e.preventDefault()
    e.stopPropagation()

    if (!token) {
      toast.error('Please login to add contacts')
      navigate('/login')
      return
    }

    if (isSubmitting) {
      return // Prevent double submission
    }

    if (!formData.name || !formData.phone) {
      toast.error('Please fill in name and phone number')
      return
    }

    if (showAddForm.type === 'family' && !formData.relation) {
      toast.error('Please specify relation for family member')
      return
    }

    if (!showAddForm.type) {
      toast.error('Invalid contact type')
      return
    }

    setIsSubmitting(true)

    try {
      if (showAddForm.editing) {
        // Update existing contact via API
        const contactId = showAddForm.editing._id || showAddForm.editing.id
        const { data } = await axios.post(backendUrl + '/api/user/emergency-contacts/update', {
          contactId,
          name: formData.name.trim(),
          phone: formData.phone.trim(),
          relation: formData.relation?.trim() || (showAddForm.type === 'friend' ? 'Friend' : ''),
          type: showAddForm.type
        }, { headers: { token } })

        if (data.success) {
          toast.success('Contact updated successfully')
          await loadContacts() // Reload contacts from API
        } else {
          toast.error(data.message || 'Failed to update contact')
        }
      } else {
        // Add new contact via API
        const { data } = await axios.post(backendUrl + '/api/user/emergency-contacts/add', {
          name: formData.name.trim(),
          phone: formData.phone.trim(),
          relation: formData.relation?.trim() || (showAddForm.type === 'friend' ? 'Friend' : ''),
          type: showAddForm.type
        }, { headers: { token } })

        if (data.success) {
          toast.success('Contact added successfully')
          await loadContacts() // Reload contacts from API
        } else {
          toast.error(data.message || 'Failed to add contact')
        }
      }

      setShowAddForm({ type: null, editing: null })
      setFormData({ name: '', phone: '', relation: '' })
    } catch (error) {
      console.error('Error saving contact:', error)
      if (error.response?.status === 401) {
        toast.error('Please login again')
        navigate('/login')
      } else {
        toast.error(error.response?.data?.message || 'Failed to save contact')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle delete contact (via API)
  const handleDeleteContact = async (contact, type) => {
    if (!token) {
      toast.error('Please login to delete contacts')
      navigate('/login')
      return
    }

    if (!window.confirm('Are you sure you want to delete this contact?')) {
      return
    }

    try {
      const contactId = contact._id || contact.id
      const { data } = await axios.post(backendUrl + '/api/user/emergency-contacts/delete', {
        contactId,
        type
      }, { headers: { token } })

      if (data.success) {
        toast.success('Contact deleted successfully')
        await loadContacts() // Reload contacts from API
      } else {
        toast.error(data.message || 'Failed to delete contact')
      }
    } catch (error) {
      console.error('Error deleting contact:', error)
      if (error.response?.status === 401) {
        toast.error('Please login again')
        navigate('/login')
      } else {
        toast.error(error.response?.data?.message || 'Failed to delete contact')
      }
    }
  }

  // Open edit form
  const handleEditContact = (contact, type) => {
    setFormData({
      name: contact.name,
      phone: contact.phone,
      relation: contact.relation || ''
    })
    setShowAddForm({ type, editing: contact })
  }

  // Countdown effect
  useEffect(() => {
    if (countdown !== null && countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1)
      }, 1000)
      return () => clearTimeout(timer)
    } else if (countdown === 0 && !isActivated) {
      activateEmergency()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countdown, isActivated])

  return (
    <div className="page-container fade-in">
      {/* Back Arrow Button */}
      <div className="mb-6 flex items-center gap-4">
        <BackArrow />
        <BackButton to="/" label="Back to Home" />
      </div>

      {/* Page Header */}
      <div className="text-center mb-5">
        <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-red-600 to-orange-500 bg-clip-text text-transparent mb-1">
          Emergency Center
        </h1>
        <p className="text-gray-600 text-xs sm:text-sm">Quick access to emergency services and contacts</p>
      </div>

      {/* MedClues Official Support - NEW */}
      <div className="mb-4 bg-gradient-to-r from-cyan-600 to-blue-700 rounded-xl p-0.5 shadow-lg overflow-hidden group">
        <div className="bg-white rounded-[10px] p-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-cyan-100 rounded-full flex items-center justify-center text-cyan-600 shadow-inner group-hover:scale-110 transition-transform">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-black text-cyan-900 uppercase tracking-tighter">Official MedClues Support</p>
              <p className="text-[10px] font-bold text-cyan-600 uppercase">24/7 Platform Assistance</p>
            </div>
          </div>
          <a
            href="tel:18001234567"
            className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-700 text-white text-xs font-black rounded-lg shadow-md hover:shadow-cyan-200 transition-all active:scale-95"
          >
            CALL SUPPORT
          </a>
        </div>
      </div>

      {/* Location Status Indicator */}
      <div className="mb-4">
        {locationError && !location ? (
          <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-3 sm:p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-yellow-500 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm sm:text-base font-semibold text-yellow-900">Location unavailable</p>
                <p className="text-xs sm:text-sm text-yellow-700 truncate">Unable to get your location. Emergency services will still work.</p>
              </div>
            </div>
            <button
              onClick={() => {
                setLocationError(false)
                getCurrentLocation().catch(() => { })
              }}
              className="px-3 sm:px-4 py-2 text-xs sm:text-sm bg-yellow-600 hover:bg-yellow-700 text-white font-semibold rounded-lg transition-colors flex-shrink-0 flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Retry
            </button>
          </div>
        ) : location ? (
          <div className="bg-green-50 border-2 border-green-200 rounded-lg overflow-hidden shadow-sm">
            <div className="p-3 sm:p-4 flex items-center gap-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0 animate-pulse">
                <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm sm:text-base font-bold text-green-900">Live Location Active</p>
                <p className="text-xs sm:text-sm text-green-700 truncate font-medium">
                  {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
                </p>
              </div>
              <button
                onClick={() => {
                  setLocation(null)
                  getCurrentLocation().catch(() => { })
                }}
                className="px-3 sm:px-4 py-2 text-xs sm:text-sm bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg transition-all active:scale-95 flex-shrink-0 flex items-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh
              </button>
            </div>

            {/* Map Preview */}
            <div className="h-48 w-full border-t border-green-200">
              <iframe
                src={`https://www.google.com/maps/embed?pb=!1m14!1m12!1m3!1d15000!2d${location.longitude}!3d${location.latitude}!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!5e0!3m2!1sen!2sin!4v1700000000000!5m2!1sen!2sin`}
                width="100%"
                height="100%"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="Your Current Location"
              />
            </div>
          </div>
        ) : null}
      </div>

      {/* Emergency Button Section */}
      <div className="mb-6">
        {countdown === null && !isActivated && (
          <button
            onClick={startEmergencyCountdown}
            className="w-full py-4 sm:py-5 bg-gradient-to-br from-red-600 via-red-700 to-red-800 hover:from-red-700 hover:via-red-800 hover:to-red-900 text-white rounded-xl shadow-xl transition-all duration-300 hover:scale-[1.01] hover:shadow-red-500/40 active:scale-[0.99] relative overflow-hidden group"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-red-400 to-orange-400 opacity-0 group-hover:opacity-25 transition-opacity duration-300"></div>
            <div className="relative z-10 flex flex-col items-center justify-center gap-2">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white/20 rounded-full flex items-center justify-center animate-pulse">
                <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <span className="text-lg sm:text-xl font-extrabold tracking-tight">Activate Emergency</span>
              <span className="text-xs text-white/90">Press to start emergency protocol</span>
            </div>
          </button>
        )}

        {countdown !== null && countdown > 0 && (
          <div className="w-full py-4 sm:py-5 bg-gradient-to-br from-orange-500 via-orange-600 to-red-600 text-white rounded-xl shadow-xl relative overflow-hidden animate-pulse">
            <div className="absolute inset-0 bg-gradient-to-r from-yellow-400 to-red-400 opacity-20"></div>
            <div className="relative z-10 flex flex-col items-center justify-center gap-2">
              <div className="text-4xl sm:text-5xl font-extrabold animate-bounce drop-shadow-2xl">
                {countdown}
              </div>
              <p className="text-base sm:text-lg font-bold">Emergency Activating...</p>
              <div className="flex items-center gap-2 text-xs opacity-90">
                <div className="w-1.5 h-1.5 bg-white rounded-full animate-ping"></div>
                <span>Connecting to emergency services</span>
              </div>
              <button
                onClick={cancelEmergency}
                className="mt-2 px-5 py-1.5 bg-white hover:bg-gray-100 text-red-600 rounded-full font-bold transition-all duration-200 hover:scale-105 shadow-lg text-xs"
              >
                ✕ Cancel Emergency
              </button>
            </div>
          </div>
        )}

        {isActivated && (
          <div className="w-full bg-white rounded-2xl shadow-2xl border-2 border-red-500 overflow-hidden animate-pulse-slow">
            {/* Header */}
            <div className="bg-red-600 p-4 text-white text-center">
              <h2 className="text-xl font-black uppercase tracking-widest">🚨 Emergency Protocol Active</h2>
              <p className="text-xs opacity-90 mt-1">Alerts have been sent to your contacts and local services.</p>
            </div>

            {/* Main Action Buttons */}
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                onClick={() => window.location.href = `tel:108`}
                className="flex items-center justify-center gap-3 py-6 bg-red-100 border-2 border-red-600 text-red-700 rounded-xl hover:bg-red-200 transition-all active:scale-95 shadow-lg group"
              >
                <div className="p-3 bg-red-600 text-white rounded-full group-hover:scale-110 transition-transform">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                </div>
                <div className="text-left">
                  <span className="block text-2xl font-black">Call 108</span>
                  <span className="text-xs font-bold uppercase opacity-70">Ambulance Services</span>
                </div>
              </button>

              <button
                onClick={() => window.location.href = `tel:100`}
                className="flex items-center justify-center gap-3 py-6 bg-blue-100 border-2 border-blue-600 text-blue-700 rounded-xl hover:bg-blue-200 transition-all active:scale-95 shadow-lg group"
              >
                <div className="p-3 bg-blue-600 text-white rounded-full group-hover:scale-110 transition-transform">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div className="text-left">
                  <span className="block text-2xl font-black">Call 100</span>
                  <span className="text-xs font-bold uppercase opacity-70">Police Assistance</span>
                </div>
              </button>
            </div>

            {/* Secondary Actions */}
            <div className="px-4 pb-4 flex justify-between gap-4">
              <button
                onClick={() => setCountdown(null) || setIsActivated(false)}
                className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-lg text-sm font-bold border border-gray-200 hover:bg-gray-200"
              >
                Safe Now (Deactivate)
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Police Station & Hospital - MOVED TO TOP FOR VISIBILITY */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Nearby Police Stations */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-100/50 rounded-xl p-4 shadow-md border border-blue-200/50">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3 min-h-[40px]">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-gray-900 leading-none m-0 p-0 flex items-center">Police Stations</h2>
            </div>
            {location && (
              <button
                onClick={() => fetchNearbyPlaces(location.latitude, location.longitude)}
                disabled={loadingPlaces}
                className="p-1.5 text-sm bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-blue-400 disabled:to-indigo-400 disabled:cursor-not-allowed text-white rounded-lg transition-all duration-200 hover:scale-105 shadow-sm"
                title="Refresh nearby places"
              >
                <svg className={`w-3.5 h-3.5 ${loadingPlaces ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            )}
          </div>
          <p className="text-xs text-blue-600 font-medium mb-3 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></span>
            Auto-notified on emergency
          </p>
          {loadingPlaces ? (
            <div className="text-center py-8 bg-white rounded-lg shadow-sm">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-3 border-blue-600 border-t-transparent mb-3"></div>
              <p className="text-gray-600 font-medium text-sm">Loading...</p>
            </div>
          ) : policeStations.length === 0 ? (
            <div className="text-center py-8 bg-white rounded-lg shadow-sm">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-gray-700 font-semibold text-sm mb-1">No police stations nearby</p>
              <p className="text-xs text-gray-500">Emergency: <span className="font-bold text-blue-600">100</span></p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-3">
              {policeStations.map((station, index) => (
                <div key={index} className="p-3 bg-white rounded-lg shadow-sm hover:shadow-md transition-all duration-200 border border-blue-200 flex flex-col h-full">
                  <div className="flex items-start gap-2 mb-2">
                    <div className="w-7 h-7 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0 shadow-sm">
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-sm text-gray-900 mb-0.5 truncate">{station.name}</h3>
                      <p className="text-xs text-gray-600 line-clamp-2">{station.address}</p>
                    </div>
                  </div>
                  <div className="mt-auto pt-2 border-t border-gray-100 flex flex-wrap items-center gap-2 text-xs">
                    <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 font-semibold rounded whitespace-nowrap">
                      📍 {station.distance} km
                    </span>
                    <span className="px-1.5 py-0.5 bg-green-100 text-green-700 font-semibold rounded whitespace-nowrap">
                      ☎️ {station.phone}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Nearby Hospitals */}
        <div className="bg-gradient-to-br from-red-50 to-rose-100/50 rounded-xl p-4 shadow-md border border-red-200/50">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3 min-h-[40px]">
              <div className="w-10 h-10 bg-gradient-to-br from-red-600 to-rose-600 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-gray-900 leading-none m-0 p-0 flex items-center">Hospitals</h2>
            </div>
            {location && (
              <button
                onClick={() => {
                  if (lastFetchTime && Date.now() - lastFetchTime < 10000) {
                    toast.info('Please wait 10 seconds between refreshes')
                    return
                  }
                  fetchNearbyPlaces(location.latitude, location.longitude)
                }}
                disabled={loadingPlaces || (lastFetchTime && Date.now() - lastFetchTime < 10000)}
                className="p-1.5 text-sm bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 disabled:from-red-400 disabled:to-rose-400 disabled:cursor-not-allowed text-white rounded-lg transition-all duration-200 hover:scale-105 shadow-sm"
              >
                <svg className={`w-3.5 h-3.5 ${loadingPlaces ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            )}
          </div>
          <p className="text-xs text-red-600 font-medium mb-3 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></span>
            Auto-notified on emergency
          </p>
          {!location ? (
            <div className="text-center py-8 bg-white rounded-lg shadow-sm">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-red-600 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <p className="text-gray-700 font-semibold text-sm mb-1">Requesting location...</p>
              <p className="text-xs text-gray-500">Please allow location access</p>
            </div>
          ) : loadingPlaces || loadingPartnerHospitals ? (
            <div className="text-center py-8 bg-white rounded-lg shadow-sm">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-3 border-red-600 border-t-transparent mb-3"></div>
              <p className="text-gray-600 font-medium text-sm">Locating nearest facilities...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-3">
              {/* Partner Hospitals First */}
              {partnerHospitals.map((hospital, index) => (
                <div key={`partner-${index}`} className="p-3 bg-gradient-to-br from-red-50 to-white rounded-lg shadow-sm hover:shadow-md transition-all duration-200 border-2 border-red-500/30 flex flex-col h-full relative overflow-hidden">
                  <div className="absolute top-0 right-0 px-2 py-0.5 bg-red-600 text-white text-[9px] font-black uppercase tracking-widest rounded-bl-lg animate-pulse">
                    MedClues Partner
                  </div>
                  <div className="flex items-start gap-2 mb-2">
                    <div className="w-7 h-7 bg-red-600 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0 shadow-md">
                      ★
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-2 mb-0.5">
                        <h3 className="font-bold text-sm text-red-900 flex-1 truncate">{hospital.name}</h3>
                      </div>
                      <p className="text-[10px] text-gray-600 font-medium line-clamp-1">{hospital.address}</p>
                    </div>
                  </div>
                  <div className="mt-auto pt-2 border-t border-red-100 flex flex-wrap items-center justify-between text-[11px]">
                    <span className="font-black text-red-700">📍 {hospital.distance} KM</span>
                    <a href={`tel:${hospital.contact}`} className="px-2 py-1 bg-red-600 text-white font-black rounded-md hover:bg-red-700 transition-colors">CALL NOW</a>
                  </div>
                </div>
              ))}

              {/* Overpass Results */}
              {hospitals.map((hospital, index) => (
                <div key={`osm-${index}`} className="p-3 bg-white rounded-lg shadow-sm hover:shadow-md transition-all duration-200 border border-red-100 flex flex-col h-full opacity-80 hover:opacity-100">
                  <div className="flex items-start gap-2 mb-2">
                    <div className="w-7 h-7 bg-gray-200 rounded-lg flex items-center justify-center text-gray-500 text-xs font-bold flex-shrink-0">
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-2 mb-0.5">
                        <h3 className="font-bold text-sm text-gray-700 flex-1 truncate">{hospital.name}</h3>
                      </div>
                      <p className="text-[10px] text-gray-500 font-medium line-clamp-1">{hospital.address}</p>
                    </div>
                  </div>
                  <div className="mt-auto pt-2 border-t border-gray-50 flex items-center justify-between text-[11px]">
                    <span className="font-bold text-gray-600">DISTANCE: {hospital.distance} KM</span>
                    <a href={`tel:${hospital.phone}`} className="text-red-600 font-black">DIAL {hospital.phone}</a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Contacts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Friends */}
        <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-xl p-4 shadow-md border border-blue-200/50">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3 min-h-[40px]">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-gray-900 leading-none m-0 p-0 flex items-center">Friends</h2>
            </div>
            <button
              onClick={() => {
                if (!token) {
                  toast.error('Please login to add contacts')
                  navigate('/login')
                  return
                }
                setShowAddForm({ type: 'friend', editing: null })
              }}
              className="px-3 py-1.5 text-xs bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-lg transition-all duration-200 hover:scale-105 shadow-sm flex items-center gap-1.5 font-semibold"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              Add
            </button>
          </div>

          {showAddForm.type === 'friend' && (
            <form onSubmit={handleSubmitContact} className="mb-4 p-4 bg-white rounded-lg shadow-sm border border-blue-200">
              <input
                type="text"
                placeholder="Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full mb-2 px-3 py-2 text-sm border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200 transition-all"
                required
              />
              <input
                type="tel"
                placeholder="Phone Number"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full mb-2 px-3 py-2 text-sm border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200 transition-all"
                required
              />
              <input
                type="text"
                placeholder="Relation (optional)"
                value={formData.relation}
                onChange={(e) => setFormData({ ...formData, relation: e.target.value })}
                className="w-full mb-2 px-3 py-2 text-sm border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200 transition-all"
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2 text-sm bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-blue-400 disabled:to-blue-500 disabled:cursor-not-allowed text-white rounded-lg transition-all duration-200 hover:scale-105 shadow-sm font-semibold"
                >
                  {isSubmitting ? 'Adding...' : (showAddForm.editing ? '✓ Update' : '+ Add')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm({ type: null, editing: null })
                    setFormData({ name: '', phone: '', relation: '' })
                  }}
                  className="px-4 py-2 text-sm bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg transition-all duration-200 hover:scale-105 font-semibold"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {!token ? (
            <div className="text-center py-8 bg-white rounded-lg shadow-sm">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <p className="text-gray-700 font-semibold text-sm mb-1">Login Required</p>
              <p className="text-xs text-gray-500 mb-3">Please login to manage emergency contacts</p>
              <button
                onClick={() => navigate('/login')}
                className="px-5 py-2 text-sm bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-lg transition-all duration-200 hover:scale-105 shadow-sm font-semibold"
              >
                Login Now
              </button>
            </div>
          ) : friends.length === 0 ? (
            <div className="text-center py-8 bg-white rounded-lg shadow-sm">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <p className="text-gray-700 font-semibold text-sm mb-1">No friends added yet</p>
              <p className="text-xs text-gray-500">Click "Add" to add emergency contacts</p>
            </div>
          ) : (
            <div className="space-y-2">
              {friends.map((friend) => (
                <div key={friend._id || friend.id} className="p-3 bg-white rounded-lg shadow-sm hover:shadow-md transition-all duration-200 border border-blue-100 flex items-start justify-between group">
                  <div className="flex items-start gap-2 flex-1">
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-sm flex-shrink-0">
                      {friend.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm text-gray-900 truncate">{friend.name}</p>
                      <p className="text-xs text-blue-600 font-medium">{friend.relation || 'Friend'}</p>
                      <p className="text-xs text-gray-500">{friend.phone}</p>
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleEditContact(friend, 'friend')}
                      className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-all hover:scale-110"
                      title="Edit"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDeleteContact(friend, 'friend')}
                      className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-all hover:scale-110"
                      title="Delete"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Family */}
        <div className="bg-gradient-to-br from-purple-50 to-purple-100/50 rounded-xl p-4 shadow-md border border-purple-200/50">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3 min-h-[40px]">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-gray-900 leading-none m-0 p-0 flex items-center">Family</h2>
            </div>
            <button
              onClick={() => {
                if (!token) {
                  toast.error('Please login to add contacts')
                  navigate('/login')
                  return
                }
                setShowAddForm({ type: 'family', editing: null })
              }}
              className="px-3 py-1.5 text-xs bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white rounded-lg transition-all duration-200 hover:scale-105 shadow-sm flex items-center gap-1.5 font-semibold"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              Add
            </button>
          </div>

          {showAddForm.type === 'family' && (
            <form onSubmit={handleSubmitContact} className="mb-4 p-4 bg-white rounded-lg shadow-sm border border-purple-200">
              <input
                type="text"
                placeholder="Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full mb-2 px-3 py-2 text-sm border-2 border-gray-200 rounded-lg focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-200 transition-all"
                required
              />
              <input
                type="tel"
                placeholder="Phone Number"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full mb-2 px-3 py-2 text-sm border-2 border-gray-200 rounded-lg focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-200 transition-all"
                required
              />
              <input
                type="text"
                placeholder="Relation (Father, Mother, Brother, etc.)"
                value={formData.relation}
                onChange={(e) => setFormData({ ...formData, relation: e.target.value })}
                className="w-full mb-2 px-3 py-2 text-sm border-2 border-gray-200 rounded-lg focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-200 transition-all"
                required
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2 text-sm bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 disabled:from-purple-400 disabled:to-purple-500 disabled:cursor-not-allowed text-white rounded-lg transition-all duration-200 hover:scale-105 shadow-sm font-semibold"
                >
                  {isSubmitting ? 'Adding...' : (showAddForm.editing ? '✓ Update' : '+ Add')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm({ type: null, editing: null })
                    setFormData({ name: '', phone: '', relation: '' })
                  }}
                  className="px-4 py-2 text-sm bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg transition-all duration-200 hover:scale-105 font-semibold"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {!token ? (
            <div className="text-center py-8 bg-white rounded-lg shadow-sm">
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <p className="text-gray-700 font-semibold text-sm mb-1">Login Required</p>
              <p className="text-xs text-gray-500 mb-3">Please login to manage emergency contacts</p>
              <button
                onClick={() => navigate('/login')}
                className="px-5 py-2 text-sm bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white rounded-lg transition-all duration-200 hover:scale-105 shadow-sm font-semibold"
              >
                Login Now
              </button>
            </div>
          ) : family.length === 0 ? (
            <div className="text-center py-8 bg-white rounded-lg shadow-sm">
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <p className="text-gray-700 font-semibold text-sm mb-1">No family members added yet</p>
              <p className="text-xs text-gray-500">Click "Add" to add emergency contacts</p>
            </div>
          ) : (
            <div className="space-y-2">
              {family.map((member) => (
                <div key={member._id || member.id} className="p-3 bg-white rounded-lg shadow-sm hover:shadow-md transition-all duration-200 border border-purple-100 flex items-start justify-between group">
                  <div className="flex items-start gap-2 flex-1">
                    <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-purple-600 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-sm flex-shrink-0">
                      {member.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm text-gray-900 truncate">{member.name}</p>
                      <p className="text-xs text-purple-600 font-medium">{member.relation}</p>
                      <p className="text-xs text-gray-500">{member.phone}</p>
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleEditContact(member, 'family')}
                      className="p-1.5 text-purple-600 hover:bg-purple-50 rounded-lg transition-all hover:scale-110"
                      title="Edit"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDeleteContact(member, 'family')}
                      className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-all hover:scale-110"
                      title="Delete"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Emergency
