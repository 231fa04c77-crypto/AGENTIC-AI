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

export function LoginForm({ className, ...props }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [currentQuoteIndex, setCurrentQuoteIndex] = useState(0)
  const [errors, setErrors] = useState({
    email: '',
    password: ''
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
      email: '',
      password: ''
    }
    let isValid = true

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
      // Removed debug console.log for cleaner production output
      const { data } = await axios.post(backendUrl + '/api/user/login', { email, password })
      if (data.success) {
        localStorage.setItem('token', data.token)
        setToken(data.token)
        toast.success('Logged in successfully!')
        navigate('/')
      } else {
        toast.error(data.message)
      }
    } catch (error) {
      console.error('Login error:', error)
      if (error.code === 'ERR_NETWORK' || error.message.includes('Network Error')) {
        toast.error(`Network error: Cannot connect to backend at ${backendUrl}. Please ensure the backend server is running and accessible.`)
      } else if (error.response) {
        toast.error(error.response.data?.message || 'Login failed. Please check your credentials.')
      } else {
        toast.error(error.message || 'Something went wrong. Please try again.')
      }
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
          toast.success('Logged in with Google successfully!')
          navigate('/')
        }
      } catch (backendError) {
        // If backend doesn't support social login, still allow Firebase auth
        // Removed debug console.log for cleaner production output
        toast.success('Logged in with Google!')
        navigate('/')
      }
    } catch (error) {
      console.error('Google sign-in error:', error)

      // Handle specific Firebase errors
      let errorMessage = 'Failed to sign in with Google'
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
          toast.success('Logged in with Apple successfully!')
          navigate('/')
        }
      } catch (backendError) {
        toast.success('Logged in with Apple!')
        navigate('/')
      }
    } catch (error) {
      console.error('Apple sign-in error:', error)
      toast.error(error.message || 'Failed to sign in with Apple')
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
          toast.success('Logged in with Meta successfully!')
          navigate('/')
        }
      } catch (backendError) {
        toast.success('Logged in with Meta!')
        navigate('/')
      }
    } catch (error) {
      console.error('Meta sign-in error:', error)
      toast.error(error.message || 'Failed to sign in with Meta')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className={`flex flex-col gap-6 ${className || ''}`} {...props}>
      <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100"
        style={{ animation: 'slideUp 0.5s cubic-bezier(0.4,0,0.2,1) both' }}>
        <div className="grid p-0 md:grid-cols-2">
          {/* Form Section */}
          <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-4">
            <div className="flex flex-col items-center gap-2 text-center mb-4 anim-header">
              <h1 className="text-xl font-bold text-gray-900">Welcome back</h1>
              <p className="text-gray-600 text-sm">
                Login to your MedClues account
              </p>
            </div>

            {/* Email Field */}
            <div style={{ animation: 'slideUp 0.45s 0.12s cubic-bezier(0.4,0,0.2,1) both' }}>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email
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
                  className={`w-full pl-10 pr-4 py-3 rounded-lg border focus:outline-none transition-all bg-white ${errors.email
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

            {/* Password Field */}
            <div style={{ animation: 'slideUp 0.45s 0.22s cubic-bezier(0.4,0,0.2,1) both' }}>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  Password
                </label>
                <Link
                  to="/forgot-password"
                  className="text-sm text-cyan-600 hover:text-cyan-700 underline-offset-2 hover:underline"
                >
                  Forgot your password?
                </Link>
              </div>
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
                  className={`w-full pl-10 pr-12 py-3 rounded-lg border focus:outline-none transition-all bg-white ${errors.password
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

            {/* Submit Button */}
            <div style={{ animation: 'slideUp 0.45s 0.32s cubic-bezier(0.4,0,0.2,1) both' }}>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white font-semibold rounded-lg shadow-md hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Signing In...
                  </>
                ) : (
                  'Login'
                )}
              </button>
            </div>

            {/* Divider */}
            <div className="relative flex py-1 items-center" style={{ animation: 'slideUp 0.45s 0.36s cubic-bezier(0.4,0,0.2,1) both' }}>
              <div className="flex-grow border-t border-gray-200"></div>
              <span className="flex-shrink mx-4 text-gray-400 text-xs uppercase tracking-wider">Or continue with</span>
              <div className="flex-grow border-t border-gray-200"></div>
            </div>

            {/* Google Login Button */}
            <div style={{ animation: 'slideUp 0.45s 0.40s cubic-bezier(0.4,0,0.2,1) both' }}>
              <button
                type="button"
                onClick={handleGoogle}
                disabled={isLoading}
                className="flex items-center justify-center gap-3 w-full py-2.5 px-4 border border-gray-200 rounded-lg bg-white hover:bg-gray-50 text-gray-700 font-medium shadow-sm hover:shadow transition-all duration-200 disabled:opacity-60"
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

            {/* Sign Up Link */}
            <p className="text-center text-sm text-gray-600" style={{ animation: 'fadeIn 0.5s 0.44s both' }}>
              Don&apos;t have an account?{' '}
              <Link to="/login?mode=signup" className="text-cyan-600 hover:text-cyan-700 font-medium underline-offset-2 hover:underline">
                Sign up
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

