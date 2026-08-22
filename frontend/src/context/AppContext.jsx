import { createContext, useContext, useEffect, useState } from "react";
import { toast } from "react-toastify";
import axios from 'axios'

export const AppContext = createContext()

// Convenience hook for accessing AppContext
export const useAppContext = () => useContext(AppContext)

const AppContextProvider = (props) => {

    const currencySymbol = '₹'
    // Dynamically determine backend URL based on current host
    const getBackendUrl = () => {
        // PRIORITY 1: Always check environment variable first (for production deployments)
        const envUrl = import.meta.env.VITE_BACKEND_URL
        if (envUrl) {
            console.log('🌐 Using backend URL from environment:', envUrl)
            return envUrl
        }

        // PRIORITY 2: For local development, check if accessing from network IP
        const hostname = window.location.hostname
        const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1'
        const isLocalNetworkIP = /^192\.168\.|^10\.|^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname)
        const backendPort = import.meta.env.VITE_BACKEND_PORT || '5000'

        // If accessing from local network IP (e.g., 192.168.x.x), use that IP for backend
        if (isLocalNetworkIP) {
            const backendUrl = `http://${hostname}:${backendPort}`
            console.log('🏠 Using local network backend:', backendUrl)
            return backendUrl
        }

        // PRIORITY 3: Default to localhost for local development
        const backendUrl = `http://localhost:${backendPort}`
        console.log('💻 Using default localhost backend:', backendUrl)
        return backendUrl
    }
    const backendUrl = getBackendUrl()

    const [doctors, setDoctors] = useState([])
    const [token, setToken] = useState(localStorage.getItem('token') ? localStorage.getItem('token') : '')
    const [userData, setUserData] = useState(false)

    // Loading states
    const [isLoading, setIsLoading] = useState(false)
    const [isDoctorsLoading, setIsDoctorsLoading] = useState(true)
    const [isProfileLoading, setIsProfileLoading] = useState(false)

    // Helper to generate a clean avatar image for a doctor (no real photos, initials-based)
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
        // UI-Avatars generates a simple avatar with initials; colors tuned to healthcare palette
        return `https://ui-avatars.com/api/?name=${encoded}&background=0ea5e9&color=ffffff&size=256&rounded=true&bold=true`;
    }

    // Getting Doctors using API
    const getDoctosData = async () => {
        setIsDoctorsLoading(true)
        try {
            // Fetch both standalone doctors and aggregated hospital doctors
            const [doctorRes, hospitalDoctorsRes] = await Promise.all([
                axios.get(backendUrl + '/api/doctor/list'),
                axios.get(backendUrl + '/api/hospital-tieup/public/doctors')
            ])

            let combinedDoctors = []

            // Process Standalone Doctors
            if (doctorRes.data.success) {
                console.log(`✅ Fetched ${doctorRes.data.doctors.length} doctors from /api/doctor/list`)
                combinedDoctors = doctorRes.data.doctors.map(doc => ({
                    ...doc,
                    image: fixDoctorImage(doc),
                    // Ensure available property exists (default to true if not set)
                    available: doc.available !== undefined && doc.available !== null
                        ? (doc.available === true || doc.available === 'true')
                        : true
                }))
            } else {
                console.error('❌ Error fetching doctors:', doctorRes.data.message)
                toast.error(doctorRes.data.message)
            }

            // Process Hospital Doctors
            if (hospitalDoctorsRes.data.success) {
                let hospitalDoctors = hospitalDoctorsRes.data.doctors

                // Map to match the main doctor structure
                hospitalDoctors = hospitalDoctors.map(doc => {
                    return {
                        ...doc,
                        speciality: doc.specialization, // Map specialization to speciality
                        image: fixDoctorImage(doc), // Use helper for consistency
                        fees: doc.fees || 50, // Default fee if missing
                        degree: doc.qualification,
                        about: doc.about || `Dr. ${doc.name} is a specialist in ${doc.specialization} at ${doc.hospitalName}.`,
                        // Ensure available property exists (default to true if not set)
                        available: doc.available !== undefined && doc.available !== null
                            ? (doc.available === true || doc.available === 'true')
                            : true
                    }
                })

                combinedDoctors = [...combinedDoctors, ...hospitalDoctors]
            }

            // Remove duplicate doctors by name (case-insensitive and trimmed)
            const doctorsMap = new Map()
            combinedDoctors.forEach(doc => {
                if (!doc || !doc.name) return
                
                // Normalize doctor name: lowercase, trim, remove "dr." or "dr " prefix
                let cleanName = doc.name.trim().toLowerCase()
                if (cleanName.startsWith('dr.')) {
                    cleanName = cleanName.replace(/^dr\.\s*/, '')
                } else if (cleanName.startsWith('dr ')) {
                    cleanName = cleanName.replace(/^dr\s+/, '')
                }
                
                const uniqueKey = cleanName
                
                if (!doctorsMap.has(uniqueKey)) {
                    doctorsMap.set(uniqueKey, doc)
                } else {
                    const existing = doctorsMap.get(uniqueKey)
                    const existingIsEmbedded = existing._id && existing._id.toString().startsWith('emb_')
                    const currentIsEmbedded = doc._id && doc._id.toString().startsWith('emb_')
                    
                    // If existing is embedded and current is a registered/standalone doctor, prefer the registered one
                    if (existingIsEmbedded && !currentIsEmbedded) {
                        doctorsMap.set(uniqueKey, doc)
                    } else {
                        // Otherwise prefer the one with a custom image
                        const currentHasCustomImage = doc.image &&
                            !doc.image.includes('ui-avatars.com') &&
                            !doc.image.includes('data:image/png;base64')
                        const existingHasCustomImage = existing.image &&
                            !existing.image.includes('ui-avatars.com') &&
                            !existing.image.includes('data:image/png;base64')

                        if (currentHasCustomImage && !existingHasCustomImage) {
                            doctorsMap.set(uniqueKey, doc)
                        }
                    }
                }
            })
            combinedDoctors = Array.from(doctorsMap.values())

            console.log(`📊 Total doctors after deduplication: ${combinedDoctors.length}`)
            setDoctors(combinedDoctors)

        } catch (error) {
            console.error('Error fetching doctors:', error)
            const errorMessage = error?.response?.data?.message || error?.message || 'Failed to load doctors'
            toast.error(errorMessage)
        } finally {
            setIsDoctorsLoading(false)
        }
    }


    // Getting User Profile using API
    const loadUserProfileData = async () => {
        setIsProfileLoading(true)
        try {
            const { data } = await axios.get(backendUrl + '/api/user/get-profile', { headers: { token } })

            if (data.success) {
                setUserData(data.userData)
            } else {
                toast.error(data.message)
                if (data.message === 'Invalid Session. Please login again.') {
                    localStorage.removeItem('token')
                    setToken('')
                }
            }
        } catch (error) {
            console.error('Error loading user profile:', error)
            const errorMessage = error?.response?.data?.message || error?.message || 'Failed to load profile'
            toast.error(errorMessage)
        } finally {
            setIsProfileLoading(false)
        }
    }

    useEffect(() => {
        getDoctosData()
    }, [])

    useEffect(() => {
        if (token) {
            loadUserProfileData()
        }
    }, [token])

    const value = {
        doctors, getDoctosData,
        currencySymbol,
        backendUrl,
        token, setToken,
        userData, setUserData, loadUserProfileData,
        // Loading states
        isLoading, setIsLoading,
        isDoctorsLoading,
        isProfileLoading
    }

    return (
        <AppContext.Provider value={value}>
            {props.children}
        </AppContext.Provider>
    )

}

export default AppContextProvider
