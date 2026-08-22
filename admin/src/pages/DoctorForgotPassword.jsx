import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { toast } from 'react-toastify'

const DoctorForgotPassword = () => {
  const [step, setStep] = useState(1) // 1: Email, 2: OTP, 3: New Password
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [countdown, setCountdown] = useState(0)

  const navigate = useNavigate()
  const backendUrl = import.meta.env.VITE_BACKEND_URL

  useEffect(() => {
    document.body.classList.add('login-route-active')
    return () => document.body.classList.remove('login-route-active')
  }, [])

  // Countdown timer for OTP expiry
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [countdown])

  // Send OTP to email
  const handleSendOTP = async (event) => {
    event.preventDefault()
    setIsLoading(true)

    try {
      const { data } = await axios.post(backendUrl + '/api/doctor/forgot-password', { email })
      
      if (data.success) {
        toast.success(data.message)
        setStep(2) // Go to OTP verification step
        setCountdown(600) // 10 minutes countdown
      } else {
        toast.error(data.message)
      }
    } catch (error) {
      toast.error('Failed to send OTP. Please try again.')
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }

  // Handle OTP input change
  const handleOtpChange = (index, value) => {
    if (value.length > 1) {
      value = value.slice(0, 1)
    }
    
    if (!/^\d*$/.test(value)) {
      return
    }

    const newOtp = [...otp]
    newOtp[index] = value
    setOtp(newOtp)

    // Auto-focus next input
    if (value && index < 5) {
      const nextInput = document.getElementById(`otp-${index + 1}`)
      if (nextInput) nextInput.focus()
    }
  }

  // Handle OTP backspace
  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      const prevInput = document.getElementById(`otp-${index - 1}`)
      if (prevInput) prevInput.focus()
    }
  }

  // Verify OTP
  const handleVerifyOTP = async (event) => {
    event.preventDefault()
    setIsLoading(true)

    try {
      const otpString = otp.join('')
      if (otpString.length !== 6) {
        toast.error('Please enter the complete 6-digit OTP')
        setIsLoading(false)
        return
      }

      // Just move to next step - actual verification happens in reset password
      setStep(3)
    } catch (error) {
      toast.error('Failed to verify OTP. Please try again.')
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }

  // Reset password
  const handleResetPassword = async (event) => {
    event.preventDefault()

    // Validate passwords match
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match!')
      return
    }

    // Validate password length
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters long')
      return
    }

    setIsLoading(true)

    try {
      const otpString = otp.join('')
      const { data } = await axios.post(backendUrl + '/api/doctor/reset-password', {
        email,
        otp: otpString,
        newPassword
      })
      
      if (data.success) {
        toast.success(data.message)
        setTimeout(() => {
          navigate('/login')
        }, 2000)
      } else {
        toast.error(data.message)
      }
    } catch (error) {
      toast.error('Failed to reset password. Please try again.')
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }

  // Resend OTP
  const handleResendOTP = async () => {
    if (countdown > 0) return
    
    setIsLoading(true)
    try {
      const { data } = await axios.post(backendUrl + '/api/doctor/forgot-password', { email })
      
      if (data.success) {
        toast.success('New OTP sent to your email')
        setCountdown(600) // 10 minutes countdown
        setOtp(['', '', '', '', '', ''])
      } else {
        toast.error(data.message)
      }
    } catch (error) {
      toast.error('Failed to resend OTP')
    } finally {
      setIsLoading(false)
    }
  }

  // Format countdown time
  const formatTime = (seconds) => {
    if (seconds < 60) {
      return `${seconds}s`
    }
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="min-h-[100dvh] flex items-center justify-center p-4 sm:p-6 overflow-y-auto safe-area-inset" style={{ background: 'linear-gradient(135deg, #E8F4FC 0%, #F0F8FF 50%, #E0F0FA 100%)' }}>
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-2xl p-5 sm:p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="mx-auto mb-4 w-16 h-16 flex items-center justify-center bg-blue-100 rounded-full">
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Reset Password</h2>
            <p className="text-sm text-gray-600 mt-2">Doctor Account Recovery</p>
          </div>

          {/* Step 1: Email */}
          {step === 1 && (
            <form onSubmit={handleSendOTP}>
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  placeholder="Enter your email"
                  required
                  disabled={isLoading}
                />
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 bg-gradient-to-r from-blue-500 to-cyan-600 text-white rounded-xl font-semibold hover:from-blue-600 hover:to-cyan-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Sending...' : 'Send OTP'}
              </button>
            </form>
          )}

          {/* Step 2: OTP Verification */}
          {step === 2 && (
            <form onSubmit={handleVerifyOTP}>
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-4 text-center">
                  Enter the 6-digit OTP sent to your email
                </label>
                <div className="flex justify-center gap-1.5 sm:gap-2 flex-wrap">
                  {otp.map((digit, index) => (
                    <input
                      key={index}
                      id={`otp-${index}`}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(index, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(index, e)}
                      className="w-10 h-10 sm:w-12 sm:h-12 text-center text-lg sm:text-xl font-bold border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      disabled={isLoading}
                    />
                  ))}
                </div>
                {countdown > 0 && (
                  <p className="text-center text-sm text-gray-500 mt-4">
                    OTP expires in: <span className="font-semibold text-blue-600">{formatTime(countdown)}</span>
                  </p>
                )}
                <button
                  type="button"
                  onClick={handleResendOTP}
                  disabled={countdown > 0 || isLoading}
                  className="w-full mt-4 text-sm text-blue-600 hover:text-blue-700 underline disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {countdown > 0 ? `Resend OTP in ${formatTime(countdown)}` : 'Resend OTP'}
                </button>
              </div>
              <button
                type="submit"
                disabled={isLoading || otp.join('').length !== 6}
                className="w-full py-3 bg-gradient-to-r from-blue-500 to-cyan-600 text-white rounded-xl font-semibold hover:from-blue-600 hover:to-cyan-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Verifying...' : 'Verify OTP'}
              </button>
            </form>
          )}

          {/* Step 3: New Password */}
          {step === 3 && (
            <form onSubmit={handleResetPassword}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">New Password</label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-4 py-3 pr-12 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                    placeholder="Minimum 8 characters"
                    required
                    minLength={8}
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    {showNewPassword ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.29 3.29m13.42 13.42l-3.29-3.29M3 3l18 18" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Confirm Password</label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-3 pr-12 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                    placeholder="Re-enter password"
                    required
                    minLength={8}
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    {showConfirmPassword ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.29 3.29m13.42 13.42l-3.29-3.29M3 3l18 18" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 bg-gradient-to-r from-blue-500 to-cyan-600 text-white rounded-xl font-semibold hover:from-blue-600 hover:to-cyan-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Resetting...' : 'Reset Password'}
              </button>
            </form>
          )}

          {/* Back to Login */}
          <div className="mt-6 text-center">
            <button
              onClick={() => navigate('/login')}
              className="text-sm text-blue-600 hover:text-blue-700 underline"
            >
              Back to Login
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DoctorForgotPassword

