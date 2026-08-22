import React, { useState, useContext, useEffect } from 'react'
import { AppContext } from '../context/AppContext'
import axios from 'axios'
import { toast } from 'react-toastify'
import { useNavigate, Link } from 'react-router-dom'
import { signInWithPopup } from 'firebase/auth'
import { auth, googleProvider, appleProvider, facebookProvider } from '../firebase'

const quotes = [
  {
    text: "Your health is your greatest wealth. Take care of it with MedClues.",
    author: "Health & Wellness"
  },
  {
    text: "Trusted healthcare at your fingertips, anytime, anywhere.",
    author: "MedClues Team"
  },
  {
    text: "Connecting you with the best healthcare professionals.",
    author: "Your Healthcare Partner"
  },
  {
    text: "Your journey to better health starts here.",
    author: "MedClues"
  },
  {
    text: "Quality care, compassionate service, reliable results.",
    author: "Healthcare Excellence"
  }
]

export function SignupForm({ className, ...props }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [dob, setDob] = useState('')
  const [gender, setGender] = useState('')
  const [bloodGroup, setBloodGroup] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [currentQuoteIndex, setCurrentQuoteIndex] = useState(0)
  const [errors, setErrors] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    dob: '',
    gender: ''
  })

  const navigate = useNavigate()
  const { backendUrl, setToken } = useContext(AppContext)

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentQuoteIndex((prevIndex) => (prevIndex + 1) % quotes.length)
    }, 5000) // Change quote every 5 seconds

    return () => clearInterval(interval)
  }, [])

  const validateForm = () => {
    const newErrors = {
      name: '',
      email: '',
      password: '',
      phone: '',
      dob: '',
      gender: ''
    }
    let isValid = true

    if (!name.trim()) {
      newErrors.name = 'This field is required'
      isValid = false
    }

    if (!phone.trim()) {
      newErrors.phone = 'This field is required'
      isValid = false
    } else if (!/^[0-9]+$/.test(phone)) {
      newErrors.phone = 'Phone number must contain only digits'
      isValid = false
    } else if (phone.length < 10) {
      newErrors.phone = 'Phone number must be at least 10 digits'
      isValid = false
    }

    if (!email.trim()) {
      newErrors.email = 'This field is required'
      isValid = false
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Please enter a valid email address'
      isValid = false
    }

    if (!password.trim()) {
      newErrors.password = 'This field is required'
      isValid = false
    } else if (password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters'
      isValid = false
    }

    if (!dob) {
      newErrors.dob = 'This field is required'
      isValid = false
    }

    if (!gender) {
      newErrors.gender = 'This field is required'
      isValid = false
    }

    setErrors(newErrors)
    return isValid
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    setIsLoading(true)

    try {
      const { data } = await axios.post(backendUrl + '/api/user/register', {
        name,
        email,
        password,
        phone: phone || undefined,
        dob: dob || undefined,
        gender: gender || undefined,
        bloodGroup: bloodGroup || undefined
      })
      if (data.success) {
        localStorage.setItem('token', data.token)
        setToken(data.token)
        toast.success('Account created successfully!')
        navigate('/')
      } else {
        toast.error(data.message)
      }
    } catch (error) {
      toast.error('Something went wrong. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogle = async () => {
    try {
      setIsLoading(true)

      // Check if auth is properly initialized
      if (!auth || !googleProvider) {
        toast.error('Firebase is not configured. Please check your .env file and Firebase setup.')
        console.error('Firebase auth or googleProvider is not initialized')
        return
      }

      const result = await signInWithPopup(auth, googleProvider)
      const user = result.user

      // Send user data to your backend
      try {
        const { data } = await axios.post(backendUrl + '/api/user/social-login', {
          email: user.email,
          name: user.displayName,
          photoURL: user.photoURL,
          provider: 'google',
          uid: user.uid
        })

        if (data.success) {
          localStorage.setItem('token', data.token)
          setToken(data.token)
          toast.success('Signed up with Google successfully!')
          navigate('/')
        }
      } catch (backendError) {
        // If backend doesn't support social login, still allow Firebase auth
        // Removed debug console.log for cleaner production output
        toast.success('Signed up with Google!')
        navigate('/')
      }
    } catch (error) {
      console.error('Google sign-in error:', error)

      // Handle specific Firebase errors
      let errorMessage = 'Failed to sign up with Google'
      if (error.code === 'auth/configuration-not-found' || error.code === 'auth/invalid-api-key') {
        errorMessage = 'Firebase configuration error. Please check your .env file and Firebase Console setup.'
        console.error('Firebase config error. Check:', {
          hasEnvFile: !!import.meta.env.VITE_FIREBASE_API_KEY,
          apiKey: import.meta.env.VITE_FIREBASE_API_KEY ? 'Set' : 'Missing',
          errorCode: error.code
        })
      } else if (error.code === 'auth/popup-closed-by-user') {
        errorMessage = 'Sign-in popup was closed. Please try again.'
      } else if (error.code === 'auth/popup-blocked') {
        errorMessage = 'Popup was blocked. Please allow popups for this site.'
      } else if (error.code === 'auth/operation-not-allowed') {
        errorMessage = 'Google Sign-In is not enabled. Please enable it in Firebase Console.'
      } else if (error.message) {
        errorMessage = error.message
      }

      toast.error(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  const handleApple = async () => {
    try {
      setIsLoading(true)

      // Check if auth is properly initialized
      if (!auth || !appleProvider) {
        toast.error('Firebase is not configured. Social login is unavailable.')
        setIsLoading(false)
        return
      }

      const result = await signInWithPopup(auth, appleProvider)
      const user = result.user

      // Send user data to your backend
      try {
        const { data } = await axios.post(backendUrl + '/api/user/social-login', {
          email: user.email,
          name: user.displayName,
          photoURL: user.photoURL,
          provider: 'apple',
          uid: user.uid
        })

        if (data.success) {
          localStorage.setItem('token', data.token)
          setToken(data.token)
          toast.success('Signed up with Apple successfully!')
          navigate('/')
        }
      } catch (backendError) {
        toast.success('Signed up with Apple!')
        navigate('/')
      }
    } catch (error) {
      console.error('Apple sign-in error:', error)
      toast.error(error.message || 'Failed to sign up with Apple')
    } finally {
      setIsLoading(false)
    }
  }

  const handleMeta = async () => {
    try {
      setIsLoading(true)

      // Check if auth is properly initialized
      if (!auth || !facebookProvider) {
        toast.error('Firebase is not configured. Social login is unavailable.')
        setIsLoading(false)
        return
      }

      const result = await signInWithPopup(auth, facebookProvider)
      const user = result.user

      // Send user data to your backend
      try {
        const { data } = await axios.post(backendUrl + '/api/user/social-login', {
          email: user.email,
          name: user.displayName,
          photoURL: user.photoURL,
          provider: 'facebook',
          uid: user.uid
        })

        if (data.success) {
          localStorage.setItem('token', data.token)
          setToken(data.token)
          toast.success('Signed up with Meta successfully!')
          navigate('/')
        }
      } catch (backendError) {
        toast.success('Signed up with Meta!')
        navigate('/')
      }
    } catch (error) {
      console.error('Meta sign-in error:', error)
      toast.error(error.message || 'Failed to sign up with Meta')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className={`flex flex-col gap-4 ${className || ''}`} {...props}>
      <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100"
        style={{ animation: 'slideUp 0.5s cubic-bezier(0.4,0,0.2,1) both' }}>
        <div className="grid p-0 md:grid-cols-2">
          {/* Form Section */}
          <form onSubmit={handleSubmit} className="p-4 md:p-6 space-y-3">
            <div className="flex flex-col items-center gap-1 text-center mb-2 anim-header">
              <h1 className="text-xl font-bold text-gray-900">Create Account</h1>
              <p className="text-gray-600 text-xs">
                Sign up for your MedClues account
              </p>
            </div>

            {/* Name and Phone Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3" style={{ animation: 'slideUp 0.45s 0.10s cubic-bezier(0.4,0,0.2,1) both' }}>
              <div>
                <label htmlFor="name" className="block text-xs font-medium text-gray-700 mb-1">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value)
                      setErrors({ ...errors, name: '' })
                    }}
                    placeholder="Full Name"
                    className={`w-full pl-10 pr-4 py-2 rounded-lg border focus:outline-none transition-all bg-white ${errors.name
                      ? 'border-red-500 focus:border-red-600 bg-red-50'
                      : 'border-gray-200 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20'
                      }`}
                    required
                  />
                </div>
                {errors.name && (
                  <p className="mt-1 text-sm text-red-600">{errors.name}</p>
                )}
              </div>

              <div>
                <label htmlFor="phone" className="block text-xs font-medium text-gray-700 mb-1">
                  Phone Number <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                  </div>
                  <input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '')
                      setPhone(value)
                      setErrors({ ...errors, phone: '' })
                    }}
                    placeholder="Phone Number"
                    maxLength={15}
                    className={`w-full pl-10 pr-4 py-2 rounded-lg border focus:outline-none transition-all bg-white ${errors.phone
                      ? 'border-red-500 focus:border-red-600 bg-red-50'
                      : 'border-gray-200 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20'
                      }`}
                    required
                  />
                </div>
                {errors.phone && (
                  <p className="mt-1 text-sm text-red-600">{errors.phone}</p>
                )}
              </div>
            </div>

            {/* Email and DOB Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3" style={{ animation: 'slideUp 0.45s 0.18s cubic-bezier(0.4,0,0.2,1) both' }}>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value)
                      setErrors({ ...errors, email: '' })
                    }}
                    placeholder="Enter your email"
                    className={`w-full pl-10 pr-4 py-2 rounded-lg border focus:outline-none transition-all bg-white ${errors.email
                      ? 'border-red-500 focus:border-red-600 bg-red-50'
                      : 'border-gray-200 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20'
                      }`}
                    required
                  />
                </div>
                {errors.email && (
                  <p className="mt-1 text-sm text-red-600">{errors.email}</p>
                )}
              </div>

              <div>
                <label htmlFor="dob" className="block text-sm font-medium text-gray-700 mb-2">
                  Date of Birth <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <input
                    id="dob"
                    type="date"
                    value={dob}
                    onChange={(e) => {
                      setDob(e.target.value)
                      setErrors({ ...errors, dob: '' })
                    }}
                    max={new Date().toISOString().split('T')[0]}
                    className={`w-full pl-10 pr-4 py-2 rounded-lg border focus:outline-none transition-all bg-white ${errors.dob
                      ? 'border-red-500 focus:border-red-600 bg-red-50'
                      : 'border-gray-200 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20'
                      }`}
                    required
                  />
                </div>
                {errors.dob && (
                  <p className="mt-1 text-sm text-red-600">{errors.dob}</p>
                )}
              </div>
            </div>

            {/* Password and Gender Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3" style={{ animation: 'slideUp 0.45s 0.26s cubic-bezier(0.4,0,0.2,1) both' }}>
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                  Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value)
                      setErrors({ ...errors, password: '' })
                    }}
                    placeholder="Password"
                    className={`w-full pl-10 pr-12 py-2 rounded-lg border focus:outline-none transition-all bg-white ${errors.password
                      ? 'border-red-500 focus:border-red-600 bg-red-50'
                      : 'border-gray-200 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20'
                      }`}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-cyan-600"
                  >
                    {showPassword ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
                {errors.password && (
                  <p className="mt-1 text-sm text-red-600">{errors.password}</p>
                )}
              </div>

              <div>
                <label htmlFor="gender" className="block text-sm font-medium text-gray-700 mb-2">
                  Gender <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                  </div>
                  <select
                    id="gender"
                    value={gender}
                    onChange={(e) => {
                      setGender(e.target.value)
                      setErrors({ ...errors, gender: '' })
                    }}
                    className={`w-full pl-10 pr-10 py-2 rounded-lg border focus:outline-none transition-all appearance-none bg-white ${errors.gender
                      ? 'border-red-500 focus:border-red-600 bg-red-50'
                      : 'border-gray-200 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20'
                      }`}
                    required
                  >
                    <option value="">Select Gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
                {errors.gender && (
                  <p className="mt-1 text-sm text-red-600">{errors.gender}</p>
                )}
              </div>
            </div>

            {/* Blood Group */}
            <div style={{ animation: 'slideUp 0.45s 0.34s cubic-bezier(0.4,0,0.2,1) both' }}>
              <label htmlFor="bloodGroup" className="block text-sm font-medium text-gray-700 mb-2">
                Blood Group (Optional)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                </div>
                <select
                  id="bloodGroup"
                  value={bloodGroup}
                  onChange={(e) => setBloodGroup(e.target.value)}
                  className="w-full pl-10 pr-10 py-2 rounded-lg border border-gray-200 bg-white focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition-all appearance-none"
                >
                  <option value="">Blood Group (Optional)</option>
                  <option value="A+">A+</option>
                  <option value="A-">A-</option>
                  <option value="B+">B+</option>
                  <option value="B-">B-</option>
                  <option value="AB+">AB+</option>
                  <option value="AB-">AB-</option>
                  <option value="O+">O+</option>
                  <option value="O-">O-</option>
                </select>
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div style={{ animation: 'slideUp 0.45s 0.42s cubic-bezier(0.4,0,0.2,1) both' }}>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white font-semibold rounded-lg shadow-md hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Creating Account...
                  </>
                ) : (
                  'Sign Up'
                )}
              </button>
            </div>

            {/* Divider */}
            <div className="relative flex py-1 items-center" style={{ animation: 'slideUp 0.45s 0.46s cubic-bezier(0.4,0,0.2,1) both' }}>
              <div className="flex-grow border-t border-gray-200"></div>
              <span className="flex-shrink mx-4 text-gray-400 text-xs uppercase tracking-wider">Or continue with</span>
              <div className="flex-grow border-t border-gray-200"></div>
            </div>

            {/* Google Signup Button */}
            <div style={{ animation: 'slideUp 0.45s 0.50s cubic-bezier(0.4,0,0.2,1) both' }}>
              <button
                type="button"
                onClick={handleGoogle}
                disabled={isLoading}
                className="flex items-center justify-center gap-3 w-full py-2 px-4 border border-gray-200 rounded-lg bg-white hover:bg-gray-50 text-gray-700 font-medium shadow-sm hover:shadow transition-all duration-200 disabled:opacity-60"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#EA4335"
                    d="M5.266 9.765A7.077 7.077 0 0 1 12 4.909c1.69 0 3.218.6 4.418 1.582L19.91 3C17.782 1.145 15.055 0 12 0 7.27 0 3.23 2.76 1.34 6.8l3.926 2.965z"
                  />
                  <path
                    fill="#4285F4"
                    d="M23.49 12.275c0-.827-.074-1.624-.21-2.4H12v4.545h6.48c-.28 1.44-.1.97-.82 1.93l3.91 3.03c2.28-2.1 3.92-5.19 3.92-9.105z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.266 14.235A7.096 7.096 0 0 1 4.91 12c0-.79.13-1.55.356-2.235L1.34 6.8A11.936 11.936 0 0 0 0 12c0 1.92.455 3.74 1.258 5.37l4.008-3.135z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.97-1.076 7.96-2.925l-3.91-3.03c-1.09.73-2.5 1.164-4.05 1.164-3.11 0-5.743-2.1-6.683-4.93L1.258 17.37C3.12 21.32 7.23 24 12 24z"
                  />
                </svg>
                Continue with Google
              </button>
            </div>

            {/* Login Link */}
            <p className="text-center text-sm text-gray-600" style={{ animation: 'fadeIn 0.5s 0.54s both' }}>
              Already have an account?{' '}
              <Link to="/login?mode=login" className="text-cyan-600 hover:text-cyan-700 font-medium underline-offset-2 hover:underline">
                Login
              </Link>
            </p>
          </form>

          {/* Quote Section */}
          <div className="bg-gradient-to-br from-cyan-500 to-blue-500 relative hidden md:flex items-center justify-center overflow-hidden">
            <div className="absolute inset-0 bg-black/10"></div>
            <div className="relative z-10 p-8 text-white text-center max-w-md">
              <div className="mb-6">
                <svg className="w-12 h-12 mx-auto mb-4 opacity-80" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.996 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.984zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
                </svg>
              </div>
              <blockquote className="text-xl font-medium mb-4 transition-opacity duration-500">
                "{quotes[currentQuoteIndex].text}"
              </blockquote>
              <p className="text-sm opacity-90 italic">
                — {quotes[currentQuoteIndex].author}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Terms and Privacy */}
      <p className="px-6 text-center text-sm text-gray-500">
        By clicking continue, you agree to our{' '}
        <Link to="/privacy-policy" className="text-cyan-600 hover:text-cyan-700 underline-offset-2 hover:underline">
          Terms of Service
        </Link>
        {' '}and{' '}
        <Link to="/privacy-policy" className="text-cyan-600 hover:text-cyan-700 underline-offset-2 hover:underline">
          Privacy Policy
        </Link>
        .
      </p>
    </div>
  )
}

