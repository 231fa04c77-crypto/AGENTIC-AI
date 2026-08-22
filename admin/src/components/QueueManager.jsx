import React, { useState, useEffect, useContext, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { DoctorContext } from '../context/DoctorContext'
import { AppContext } from '../context/AppContext'
import { toast } from 'react-toastify'
import { useSocket } from '../context/SocketContext'

const QueueManager = ({ slotDate }) => {
  const { dToken, backendUrl, getDashData } = useContext(DoctorContext)
  const { slotDateFormat } = useContext(AppContext)
  const navigate = useNavigate()
  
  const [queueStatus, setQueueStatus] = useState(null)
  const [suggestions, setSuggestions] = useState([])
  const [delayedAppointments, setDelayedAppointments] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [currentDate, setCurrentDate] = useState(slotDate || getTodayDate())
  const [connectionError, setConnectionError] = useState(false)
  const connectionErrorRef = useRef(false) // Ref to track connection error in interval

  const openConsultation = (appointmentId) => {
    navigate(`/doctor-consultation/${appointmentId}`)
  }

  // Get today's date in format
  function getTodayDate() {
    const today = new Date()
    const day = today.getDate()
    const month = today.getMonth() + 1
    const year = today.getFullYear()
    return `${day}_${month}_${year}`
  }

  // Fetch queue status
  const fetchQueueStatus = async () => {
    const effectiveBackendUrl = backendUrl || import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000'
    
    if (!dToken) {
      setIsLoading(false)
      setConnectionError(false)
      return
    }
    
    try {
      const { data } = await axios.get(
        `${effectiveBackendUrl}/api/doctor/queue-status?slotDate=${currentDate}`,
        { 
          headers: { dToken },
          timeout: 10000 // 10 second timeout
        }
      )

      if (data.success) {
        setConnectionError(false)
        connectionErrorRef.current = false
        setQueueStatus(data.queueStatus || {
          status: 'in-clinic',
          currentAppointmentId: null,
          queueLength: 0,
          appointments: []
        })
        setSuggestions(data.suggestions || [])
        setDelayedAppointments(data.delayedAppointments || [])
      } else {
        // If backend returns error, set empty state
        setConnectionError(false)
        setQueueStatus({
          status: 'in-clinic',
          currentAppointmentId: null,
          queueLength: 0,
          appointments: []
        })
        setSuggestions([])
        setDelayedAppointments([])
        if (data.message) {
          toast.error(data.message)
        }
      }
    } catch (error) {
      console.error('Error fetching queue status:', error)
      
      // Check if it's a network/connection error
      if (error.code === 'ERR_NETWORK' || error.code === 'ERR_CONNECTION_REFUSED' || error.message === 'Network Error') {
        // Only show error toast when error first occurs
        const wasConnected = !connectionErrorRef.current
        setConnectionError(true)
        connectionErrorRef.current = true
        
        // Set empty state but don't spam error messages
        if (!queueStatus) {
          setQueueStatus({
            status: 'in-clinic',
            currentAppointmentId: null,
            queueLength: 0,
            appointments: []
          })
        }
        setSuggestions([])
        setDelayedAppointments([])
        
        if (wasConnected) {
          toast.error('Cannot connect to server. Please ensure the backend is running.', { toastId: 'queue-connection-error' })
        }
      } else {
        // Other errors (like 401, 403, etc.)
        setConnectionError(false)
        setQueueStatus({
          status: 'in-clinic',
          currentAppointmentId: null,
          queueLength: 0,
          appointments: []
        })
        setSuggestions([])
        setDelayedAppointments([])
        toast.error(error.response?.data?.message || 'Failed to load queue status')
      }
    } finally {
      setIsLoading(false)
    }
  }

  // Update doctor status
  const updateStatus = async (newStatus, breakDuration = 15) => {
    const effectiveBackendUrl = backendUrl || import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000'
    
    if (!dToken) {
      toast.error('Not authenticated')
      return
    }
    
    if (connectionError) {
      toast.error('Cannot connect to server. Please check your connection.')
      return
    }
    
    try {
      const { data } = await axios.post(
        `${effectiveBackendUrl}/api/doctor/update-status`,
        { status: newStatus, breakDuration },
        { headers: { dToken }, timeout: 10000 }
      )

      if (data.success) {
        toast.success(`Status updated to ${newStatus.replace('-', ' ')}`)
        fetchQueueStatus()
      } else {
        toast.error(data.message || 'Failed to update status')
      }
    } catch (error) {
      if (error.code === 'ERR_NETWORK' || error.code === 'ERR_CONNECTION_REFUSED') {
        setConnectionError(true)
        toast.error('Cannot connect to server. Please ensure the backend is running.')
      } else {
        toast.error(error.response?.data?.message || 'Failed to update status')
      }
    }
  }

  // Start consultation
  const startConsultation = async (appointmentId) => {
    const effectiveBackendUrl = backendUrl || import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000'
    
    if (!appointmentId) {
      toast.error('Invalid appointment')
      return
    }
    
    if (connectionError) {
      toast.error('Cannot connect to server. Please check your connection.')
      return
    }
    
    try {
      const { data } = await axios.post(
        `${effectiveBackendUrl}/api/doctor/start-consultation`,
        { appointmentId },
        { headers: { dToken }, timeout: 10000 }
      )

      if (data.success) {
        toast.success('Consultation started')
        fetchQueueStatus()
        if (getDashData) getDashData()
      } else {
        toast.error(data.message || 'Failed to start consultation')
      }
    } catch (error) {
      if (error.code === 'ERR_NETWORK' || error.code === 'ERR_CONNECTION_REFUSED') {
        setConnectionError(true)
        toast.error('Cannot connect to server. Please ensure the backend is running.')
      } else {
        toast.error(error.response?.data?.message || 'Failed to start consultation')
      }
    }
  }

  // Complete consultation
  const completeConsultation = async (appointmentId, markNoShow = false) => {
    const effectiveBackendUrl = backendUrl || import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000'
    
    if (!appointmentId) {
      toast.error('Invalid appointment')
      return
    }
    
    if (connectionError) {
      toast.error('Cannot connect to server. Please check your connection.')
      return
    }
    
    try {
      const { data } = await axios.post(
        `${effectiveBackendUrl}/api/doctor/complete-consultation`,
        { appointmentId, markNoShow },
        { headers: { dToken }, timeout: 10000 }
      )

      if (data.success) {
        toast.success(markNoShow ? 'Marked as no-show' : 'Consultation completed')
        setSuggestions(data.suggestions || [])
        fetchQueueStatus()
        if (getDashData) getDashData()
      } else {
        toast.error(data.message || 'Failed to complete consultation')
      }
    } catch (error) {
      if (error.code === 'ERR_NETWORK' || error.code === 'ERR_CONNECTION_REFUSED') {
        setConnectionError(true)
        toast.error('Cannot connect to server. Please ensure the backend is running.')
      } else {
        toast.error(error.response?.data?.message || 'Failed to complete consultation')
      }
    }
  }

  // Move appointment in queue
  const moveAppointment = async (appointmentId, newPosition) => {
    const effectiveBackendUrl = backendUrl || import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000'
    
    if (!appointmentId || !newPosition) {
      toast.error('Invalid parameters')
      return
    }
    
    if (connectionError) {
      toast.error('Cannot connect to server. Please check your connection.')
      return
    }
    
    try {
      const { data } = await axios.post(
        `${effectiveBackendUrl}/api/doctor/move-appointment`,
        { appointmentId, newPosition },
        { headers: { dToken }, timeout: 10000 }
      )

      if (data.success) {
        toast.success('Appointment moved successfully')
        fetchQueueStatus()
      } else {
        toast.error(data.message || 'Failed to move appointment')
      }
    } catch (error) {
      if (error.code === 'ERR_NETWORK' || error.code === 'ERR_CONNECTION_REFUSED') {
        setConnectionError(true)
        toast.error('Cannot connect to server. Please ensure the backend is running.')
      } else {
        toast.error(error.response?.data?.message || 'Failed to move appointment')
      }
    }
  }

  useEffect(() => {
    if (!dToken) {
      setIsLoading(false)
      return
    }

    fetchQueueStatus()

    const interval = setInterval(() => {
      if (dToken && !connectionErrorRef.current) {
        fetchQueueStatus()
      }
    }, 45000)

    return () => clearInterval(interval)
  }, [dToken, currentDate])

  const { socket } = useSocket() || {}
  useEffect(() => {
    if (!socket || !dToken) return undefined
    const onQueue = () => {
      if (!connectionErrorRef.current) fetchQueueStatus()
    }
    socket.on('doctor_queue_updated', onQueue)
    socket.on('queue_updated', onQueue)
    return () => {
      socket.off('doctor_queue_updated', onQueue)
      socket.off('queue_updated', onQueue)
    }
  }, [socket, dToken, currentDate])

  if (isLoading) {
    return (
      <div className="bg-white p-4 sm:p-6 rounded-lg border border-gray-200">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
          <div className="h-20 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  if (connectionError) {
    return (
      <div className="bg-white p-4 sm:p-6 rounded-lg border border-gray-200">
        <div className="text-center py-8">
          <div className="mb-4">
            <svg className="w-16 h-16 mx-auto text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Connection Error</h3>
          <p className="text-gray-600 mb-4">Unable to connect to the server.</p>
          <p className="text-sm text-gray-500 mb-4">Please ensure the backend server is running at:</p>
          <p className="text-xs font-mono text-gray-700 bg-gray-100 p-2 rounded mb-4">
            {backendUrl || import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000'}
          </p>
          <button
            onClick={() => {
              setConnectionError(false)
              connectionErrorRef.current = false
              setIsLoading(true)
              fetchQueueStatus()
            }}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            Retry Connection
          </button>
        </div>
      </div>
    )
  }

  if (!queueStatus) {
    return (
      <div className="bg-white p-4 sm:p-6 rounded-lg border border-gray-200">
        <div className="text-center py-8">
          <p className="text-gray-500">Unable to load queue status. Please refresh the page.</p>
        </div>
      </div>
    )
  }

  const getStatusColor = (status) => {
    const colors = {
      'in-clinic': 'bg-green-100 text-green-700 border-green-300',
      'in-consult': 'bg-blue-100 text-blue-700 border-blue-300',
      'on-break': 'bg-yellow-100 text-yellow-700 border-yellow-300',
      'unavailable': 'bg-red-100 text-red-700 border-red-300'
    }
    return colors[status] || colors['in-clinic']
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Doctor Status Control */}
      <div className="bg-white p-4 sm:p-5 rounded-lg border border-gray-200 shadow-sm">
        <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">Your Status</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
          <button
            onClick={() => updateStatus('in-clinic')}
            className={`relative px-4 py-2.5 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
              queueStatus.status === 'in-clinic'
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {queueStatus.status === 'in-clinic' && (
              <svg className='w-4 h-4' fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            )}
            <svg className='w-4 h-4' fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            <span>In Clinic</span>
          </button>
          <button
            onClick={() => updateStatus('in-consult')}
            className={`relative px-4 py-2.5 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
              queueStatus.status === 'in-consult'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {queueStatus.status === 'in-consult' && (
              <svg className='w-4 h-4' fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            )}
            <svg className='w-4 h-4' fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span>In Consult</span>
          </button>
          <button
            onClick={() => updateStatus('on-break', 15)}
            className={`relative px-4 py-2.5 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
              queueStatus.status === 'on-break'
                ? 'bg-yellow-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {queueStatus.status === 'on-break' && (
              <svg className='w-4 h-4' fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            )}
            <svg className='w-4 h-4' fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>On Break</span>
          </button>
          <button
            onClick={() => updateStatus('unavailable')}
            className={`relative px-4 py-2.5 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
              queueStatus.status === 'unavailable'
                ? 'bg-red-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {queueStatus.status === 'unavailable' && (
              <svg className='w-4 h-4' fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            )}
            <svg className='w-4 h-4' fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
            <span>Unavailable</span>
          </button>
        </div>
      </div>

      {/* Current Queue */}
      <div className="bg-white p-4 sm:p-5 rounded-lg border border-gray-200 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900">Today's Queue</h2>
          <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded text-xs sm:text-sm font-medium border border-gray-300">
            {queueStatus.queueLength} in queue
          </span>
        </div>

        {queueStatus.appointments && queueStatus.appointments.length > 0 ? (
          <div className="space-y-2.5">
            {queueStatus.appointments.map((apt, index) => {
              const isCurrent = queueStatus.currentAppointmentId === apt._id
              const isConsulting = apt.status === 'in-consult'
              
              return (
                <div
                  key={index}
                  className={`p-3 sm:p-4 rounded-lg border transition-colors ${
                    isCurrent || isConsulting
                      ? 'bg-blue-50 border-blue-300'
                      : 'bg-white border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                      <div className="flex-shrink-0 relative">
                        <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center text-white font-semibold text-sm sm:text-base ${
                          isCurrent || isConsulting
                            ? 'bg-blue-600'
                            : 'bg-gray-600'
                        }`}>
                          #{apt.tokenNumber || index + 1}
                        </div>
                        {(isCurrent || isConsulting) && (
                          <div className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 text-sm sm:text-base truncate">{apt.patientName}</p>
                        <p className="text-xs sm:text-sm text-gray-600 mt-0.5">{apt.slotTime}</p>
                        <span className={`inline-block mt-1.5 px-2 py-0.5 rounded text-xs ${
                          apt.status === 'in-consult' ? 'bg-blue-100 text-blue-700 border border-blue-300' :
                          apt.status === 'in-queue' ? 'bg-green-100 text-green-700 border border-green-300' :
                          apt.status === 'confirmed' ? 'bg-amber-100 text-amber-700 border border-amber-300' :
                          'bg-gray-100 text-gray-700 border border-gray-300'
                        }`}>
                          {apt.status === 'confirmed' ? 'Arrived' : (apt.status || 'Pending')}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-shrink-0 flex-wrap justify-end items-center">
                      {!isConsulting && (
                        <button
                          type="button"
                          onClick={() => openConsultation(apt._id)}
                          className="px-3 sm:px-4 py-1.5 sm:py-2 bg-green-600 hover:bg-green-700 text-white rounded-md text-xs sm:text-sm font-medium transition-colors"
                        >
                          Start
                        </button>
                      )}
                      {isConsulting && (
                        <button
                          type="button"
                          onClick={() => openConsultation(apt._id)}
                          className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-xs sm:text-sm font-medium transition-colors"
                        >
                          Continue
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 sm:py-16 px-4">
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gray-100 rounded-full flex items-center justify-center mb-3 sm:mb-4">
              <svg className='w-8 h-8 sm:w-10 sm:h-10 text-gray-400' fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
            </div>
            <p className="text-gray-700 text-sm sm:text-base font-medium mb-1">No appointments in queue</p>
            <p className="text-gray-500 text-xs sm:text-sm text-center">Your queue is empty. New appointments will appear here.</p>
          </div>
        )}
      </div>

      {/* Smart Scheduling Suggestions */}
      {suggestions.length > 0 && (
        <div className="bg-gray-50 p-4 sm:p-5 rounded-lg border border-gray-200">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Smart Suggestions</h2>
          <div className="space-y-2.5">
            {suggestions.map((suggestion, index) => (
              <div key={index} className="bg-white p-3 sm:p-4 rounded-md border border-gray-200">
                <p className="font-medium text-sm text-gray-900 mb-2">{suggestion.message}</p>
                {suggestion.nextAppointment && (
                  <div className="flex items-center justify-between mt-2">
                    <div>
                      <p className="text-xs sm:text-sm text-gray-700">
                        {suggestion.nextAppointment.patientName} - Token #{suggestion.nextAppointment.tokenNumber}
                      </p>
                      {suggestion.timeSaved && (
                        <p className="text-xs text-green-600 mt-0.5">
                          {suggestion.timeSaved} minutes saved
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        if (suggestion.type === 'pull-next') {
                          moveAppointment(suggestion.nextAppointment._id, 1)
                        } else if (suggestion.type === 'move-followup') {
                          moveAppointment(suggestion.appointment._id, suggestion.suggestedPosition)
                        }
                      }}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs sm:text-sm font-medium transition-colors"
                    >
                      Apply
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Delayed Appointments Alert */}
      {delayedAppointments.length > 0 && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3 sm:p-4 rounded">
          <div className="flex items-start gap-2.5 sm:gap-3">
            <svg className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <h4 className="font-semibold text-sm sm:text-base text-yellow-900 mb-2">Delayed Appointments</h4>
              <div className="space-y-1">
                {delayedAppointments.map((apt, index) => (
                  <p key={index} className="text-xs sm:text-sm text-yellow-800">
                    • {apt.patientName} (Token #{apt.tokenNumber}) - {apt.delayMinutes} min delay
                  </p>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default QueueManager

