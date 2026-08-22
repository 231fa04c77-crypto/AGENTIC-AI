import React, { useContext, useEffect } from 'react'
import { AppContext } from '../context/AppContext'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { LoginForm } from '../components/LoginForm'
import { SignupForm } from '../components/SignupForm'

const Login = () => {
  const [searchParams] = useSearchParams()
  const mode = searchParams.get('mode')
  const navigate = useNavigate()
  const { token, userData } = useContext(AppContext)

  useEffect(() => {
    if (token && userData) {
      navigate('/')
    }
  }, [token, userData, navigate])

  const isSignup = mode === 'signup'

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center p-4 sm:p-8 overflow-hidden">

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

      {/* ── Form card ── */}
      <div className="w-full max-w-sm md:max-w-6xl relative z-10">
        {isSignup ? <SignupForm /> : <LoginForm />}
      </div>

    </div>
  )
}

export default Login
