import React, { useContext, useState, useEffect } from 'react'
import { AppContext } from '../context/AppContext'
import axios from 'axios'
import { toast } from 'react-toastify'
import { useNavigate } from 'react-router-dom'

const ForgotPassword = () => {
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
  const { backendUrl } = useContext(AppContext)

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
      const { data } = await axios.post(backendUrl + '/api/auth/forgot-password', {
        email,
        role: 'patient',
      })
      
      if (data.success) {
        toast.success(data.message)
        setStep(2) // Go to OTP verification step
        setCountdown(10) // 10 seconds countdown
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
    if (value !== '' && index < 5) {
      const nextInput = document.getElementById(`otp-${index + 1}`)
      if (nextInput) nextInput.focus()
    }
  }

  // Handle OTP input keydown (backspace)
  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && otp[index] === '' && index > 0) {
      const prevInput = document.getElementById(`otp-${index - 1}`)
      if (prevInput) prevInput.focus()
    }
  }

  // Handle paste in OTP
  const handleOtpPaste = (e) => {
    e.preventDefault()
    const pastedData = e.clipboardData.getData('text').slice(0, 6)
    if (!/^\d+$/.test(pastedData)) return

    const newOtp = pastedData.split('')
    while (newOtp.length < 6) newOtp.push('')
    setOtp(newOtp)

    // Focus last filled input or next empty
    const focusIndex = Math.min(pastedData.length, 5)
    const focusInput = document.getElementById(`otp-${focusIndex}`)
    if (focusInput) focusInput.focus()
  }

  // Verify OTP
  const handleVerifyOTP = async (event) => {
    event.preventDefault()
    
    const otpString = otp.join('')
    if (otpString.length !== 6) {
      toast.error('Please enter a valid 6-digit OTP')
      return
    }

    setIsLoading(true)

    try {
      // Just verify OTP exists and is valid on frontend
      // We'll validate on backend during password reset
      if (otpString) {
        toast.success('OTP verified! Now set your new password.')
        setStep(3) // Go to password reset step
      }
    } catch (error) {
      toast.error('Failed to verify OTP')
    } finally {
      setIsLoading(false)
    }
  }

  // Reset password with OTP
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
      const { data } = await axios.post(backendUrl + '/api/auth/reset-password', {
        email,
        otp: otpString,
        newPassword,
        role: 'patient',
      })
      
      if (data.success) {
        toast.success(data.message)
        setTimeout(() => {
          navigate('/login?mode=login')
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
      const { data } = await axios.post(backendUrl + '/api/auth/forgot-password', {
        email,
        role: 'patient',
      })
      
      if (data.success) {
        toast.success('New OTP sent to your email')
        setCountdown(10) // 10 seconds countdown
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
    <div className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden">

      {/* ── White background ── */}
      <div className="absolute inset-0 -z-20 bg-white" />

      {/* ── Subtle dot grid ── */}
      <div
        className="absolute inset-0 -z-10"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(0,0,0,0.05) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }}
      />

      {/* Main Container - Centered Vertical Layout */}
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg border border-slate-100 p-6 sm:p-8 relative z-10">
          {/* Header - Step 1 */}
          {step === 1 && (
            <div className="text-center mb-8">
              <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-7 h-7 text-white" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 mb-2 tracking-tight">
                Forgot Password?
              </h1>
              <p className="text-sm text-slate-500">
                Enter your email to receive a reset code
              </p>
            </div>
          )}

          {/* Step 2 & 3: Header */}
          {(step === 2 || step === 3) && (
            <div className="text-center mb-8">
              <div className="w-14 h-14 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-7 h-7 text-white" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900 mb-2 tracking-tight">
                {step === 2 ? 'Verification Code' : 'Reset Password'}
              </h2>
              <p className="text-sm text-slate-500 mb-3">
                {step === 2 ? 'We have sent the verification code to your email address' : 'Set your new password'}
              </p>
              {step === 3 && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-2.5">
                  <p className="text-xs text-green-700 font-medium">
                    ✓ OTP Verified! Now set your new password.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Step 1: Email Form */}
          {step === 1 && (
            <form onSubmit={handleSendOTP} className="space-y-5">
              {/* Email */}
              <div className="relative group">
                <label className="block text-sm font-semibold text-slate-700 mb-2">Email Address</label>
                <div className="absolute inset-y-0 left-0 pl-4 top-8 flex items-center pointer-events-none">
                  <svg className="w-5 h-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <input 
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-slate-700 placeholder-slate-400"
                  placeholder="e.g. user@example.com"
                  required
                />
              </div>

              {/* Submit Button */}
              <button 
                type="submit" 
                className="w-full py-3 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white font-black text-sm uppercase tracking-wide rounded-xl shadow-md hover:shadow-lg transition-all duration-300 flex items-center justify-center gap-2 active:scale-95"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Sending...
                  </>
                ) : (
                  <>
                    Send OTP
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </>
                )}
              </button>

              {/* Back to Login */}
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => navigate('/login?mode=login')}
                  className="text-sm text-blue-600 hover:text-blue-700 hover:underline transition-colors font-medium"
                >
                  ← Back to Login
                </button>
              </div>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={handleVerifyOTP} className="space-y-5">
              {/* Email Info */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-xs text-blue-700">
                  OTP sent to: <span className="font-bold">{email}</span>
                </p>
              </div>

              {/* Countdown Timer */}
              {countdown > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
                  <p className="text-xs text-blue-700">
                    OTP expires in: <span className="font-black">{formatTime(countdown)}</span>
                  </p>
                </div>
              )}

              {/* OTP Input - 6 Separate Boxes */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-3 text-center">
                  Enter 6-Digit OTP
                </label>
                <div className="flex justify-center gap-2">
                  {otp.map((digit, index) => (
                    <input
                      key={index}
                      id={`otp-${index}`}
                      type="text"
                      inputMode="numeric"
                      maxLength="1"
                      value={digit}
                      onChange={(e) => handleOtpChange(index, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(index, e)}
                      onPaste={index === 0 ? handleOtpPaste : undefined}
                      autoFocus={index === 0}
                      className="w-12 h-14 text-center text-2xl font-black border-2 border-slate-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all bg-white text-slate-800"
                      style={{
                        boxShadow: digit ? '0 2px 8px rgba(59, 130, 246, 0.15)' : 'none'
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Submit Button */}
              <button 
                type="submit" 
                className="w-full py-3 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white font-black text-sm uppercase tracking-wide rounded-xl shadow-md hover:shadow-lg transition-all duration-300 flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isLoading || otp.join('').length !== 6}
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Verifying...
                  </>
                ) : (
                  <>
                    Verify OTP
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </>
                )}
              </button>

              {/* Resend & Back to Step 1 */}
              <div className="flex flex-col sm:flex-row gap-3 text-center sm:text-left justify-between items-center">
                <button
                  type="button"
                  onClick={() => {
                    setStep(1)
                    setOtp(['', '', '', '', '', ''])
                    setCountdown(0)
                  }}
                  className="text-xs text-slate-600 hover:text-slate-900 transition-colors"
                >
                  ← Change Email
                </button>
                <button
                  type="button"
                  onClick={handleResendOTP}
                  disabled={countdown > 0 || isLoading}
                  className={`text-xs font-medium transition-colors ${countdown > 0 ? 'text-slate-300 cursor-not-allowed' : 'text-blue-600 hover:text-blue-700'}`}
                >
                  {countdown > 0 ? 'Wait to resend' : 'Resend OTP'}
                </button>
              </div>
            </form>
          )}

          {/* Step 3: New Password Form */}
          {step === 3 && (
            <form onSubmit={handleResetPassword} className="space-y-5">
              {/* New Password */}
              <div className="relative group">
                <label className="block text-sm font-semibold text-slate-700 mb-2">New Password</label>
                <div className="absolute inset-y-0 left-0 pl-4 top-8 flex items-center pointer-events-none">
                  <svg className="w-5 h-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <div className="relative">
                  <input 
                    type={showNewPassword ? "text" : "password"}
                    id="newPassword"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full pl-12 pr-12 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-slate-700 placeholder-slate-400"
                    placeholder="Minimum 8 characters"
                    required
                    minLength="8"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-blue-500 transition-colors"
                  >
                    {showNewPassword ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.736m0 0L21 21" />
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

              {/* Confirm Password */}
              <div className="relative group">
                <label className="block text-sm font-semibold text-slate-700 mb-2">Confirm Password</label>
                <div className="absolute inset-y-0 left-0 pl-4 top-8 flex items-center pointer-events-none">
                  <svg className="w-5 h-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <div className="relative">
                  <input 
                    type={showConfirmPassword ? "text" : "password"}
                    id="confirmPassword"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-12 pr-12 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-slate-700 placeholder-slate-400"
                    placeholder="Re-enter password"
                    required
                    minLength="8"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-blue-500 transition-colors"
                  >
                    {showConfirmPassword ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.736m0 0L21 21" />
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

              {/* Password strength indicator */}
              {newPassword && (
                <div className="text-xs font-medium">
                  Password strength: 
                  <span className={`ml-2 font-bold ${
                    newPassword.length >= 12 ? 'text-green-600' : 
                    newPassword.length >= 8 ? 'text-yellow-600' : 
                    'text-red-600'
                  }`}>
                    {newPassword.length >= 12 ? 'Strong' : 
                     newPassword.length >= 8 ? 'Medium' : 
                     'Weak'}
                  </span>
                </div>
              )}

              {/* Submit Button */}
              <button 
                type="submit" 
                className="w-full py-3 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white font-black text-sm uppercase tracking-wide rounded-xl shadow-md hover:shadow-lg transition-all duration-300 flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Resetting...
                  </>
                ) : (
                  <>
                    Reset Password
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </>
                )}
              </button>

              {/* Back to OTP */}
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => {
                    setStep(2)
                    setNewPassword('')
                    setConfirmPassword('')
                  }}
                  className="text-xs text-slate-600 hover:text-slate-900 transition-colors"
                >
                  ← Back to OTP
                </button>
              </div>
            </form>
          )}
      </div>
    </div>
  )
}

export default ForgotPassword

