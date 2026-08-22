import React, { useState, useEffect, useContext } from 'react'
import { toast } from 'react-toastify'
import axios from 'axios'
import { AppContext } from '../context/AppContext'

const QueueTracker = ({ appointmentId, docId, slotDate, slotTime, onTokenAlert, isExpanded = false, onToggle }) => {
  const { backendUrl, token } = useContext(AppContext)
  const [queueStatus, setQueueStatus] = useState(null)
  const [doctorStatus, setDoctorStatus] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [hasAlerted, setHasAlerted] = useState(false)
  const [hasShownDelayAlert, setHasShownDelayAlert] = useState(false)

  // Request notification permission
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  // Show browser notification
  const showNotification = (title, body) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, {
        body: body,
        icon: '/favicon.svg',
        badge: '/favicon.svg',
        tag: 'appointment-alert',
        requireInteraction: true
      })
    }
  }

  // Fetch queue status
  const fetchQueueStatus = async () => {
    try {
      const { data } = await axios.get(
        `${backendUrl}/api/user/queue-status?appointmentId=${appointmentId}`,
        { headers: { token } }
      )

      if (data.success) {
        setQueueStatus(data.queueStatus)
        
        // Check if it's patient's turn and alert (only alert once)
        if (data.queueStatus.isNextUp && !hasAlerted) {
          const tokenNumber = data.queueStatus.tokenNumber
          
          // Show browser notification
          showNotification(
            'Your Turn Next! 🎯',
            `Token #${tokenNumber} - Please proceed to the clinic`
          )
          
          // Show toast notification
          toast.success(`🎯 Token #${tokenNumber} - Your turn is next!`, {
            autoClose: 10000,
            position: "top-center"
          })
          
          // Call callback if provided
          if (onTokenAlert) {
            onTokenAlert(tokenNumber)
          }
          
          setHasAlerted(true)
          
          // Mark as alerted on backend
          try {
            await axios.post(
              `${backendUrl}/api/user/mark-alerted`,
              { appointmentId },
              { headers: { token } }
            )
          } catch (error) {
            console.error('Failed to mark as alerted:', error)
          }
        }

        // Show delay alert (only show once)
        if (data.queueStatus.isDelayed && data.queueStatus.delayMinutes > 15 && !hasShownDelayAlert) {
          toast.warning(`⏰ Your appointment is delayed by ${data.queueStatus.delayMinutes} minutes`, {
            autoClose: 5000
          })
          
          // Show browser notification for delay
          showNotification(
            'Appointment Delayed',
            `Your appointment is running ${data.queueStatus.delayMinutes} minutes behind schedule`
          )
          
          setHasShownDelayAlert(true)
        }
      }
    } catch (error) {
      console.error('Error fetching queue status:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Fetch doctor status
  const fetchDoctorStatus = async () => {
    try {
      const { data } = await axios.get(`${backendUrl}/api/user/doctor-status?docId=${docId}`)
      if (data.success) {
        setDoctorStatus(data)
      }
    } catch (error) {
      console.error('Error fetching doctor status:', error)
    }
  }

  // Get status badge
  const getStatusBadge = (status) => {
    const badges = {
      'in-clinic': { text: 'In Clinic', color: 'bg-green-100 text-green-700', icon: '✅' },
      'in-consult': { text: 'In Consult', color: 'bg-blue-100 text-blue-700', icon: '👨‍⚕️' },
      'on-break': { text: 'On Break', color: 'bg-yellow-100 text-yellow-700', icon: '☕' },
      'unavailable': { text: 'Unavailable', color: 'bg-red-100 text-red-700', icon: '🚫' }
    }
    return badges[status] || badges['in-clinic']
  }

  // Update queue status every 10 seconds
  useEffect(() => {
    fetchQueueStatus()
    fetchDoctorStatus()
    
    const interval = setInterval(() => {
      fetchQueueStatus()
      fetchDoctorStatus()
    }, 10000) // Poll every 10 seconds

    return () => clearInterval(interval)
  }, [appointmentId, docId])

  if (isLoading) {
    return (
      <div className="p-4 bg-gray-50 rounded-lg animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
        <div className="h-4 bg-gray-200 rounded w-1/2"></div>
      </div>
    )
  }

  if (!queueStatus) return null

  const statusBadge = getStatusBadge(doctorStatus?.status || 'in-clinic')

  return (
    <div className="bg-gradient-to-br from-cyan-50 to-blue-50 rounded-xl border-2 border-cyan-200 overflow-hidden">
      {/* Header with Status and Toggle Button */}
      <div className="flex items-center justify-between p-4 sm:p-5 pb-3">
        <div className="flex items-center gap-3">
          <div>
            <h3 className="font-bold text-gray-900 text-base sm:text-lg mb-1">Queue Status</h3>
            <div className="flex items-center gap-2">
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusBadge.color}`}>
                {statusBadge.icon} {statusBadge.text}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {queueStatus.tokenNumber && (
            <div className="text-right">
              <p className="text-xs text-gray-500">Token Number</p>
              <p className="text-xl sm:text-2xl font-bold text-cyan-600">#{queueStatus.tokenNumber}</p>
            </div>
          )}
          {onToggle && (
            <button
              onClick={onToggle}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-white/50 rounded-lg transition-colors"
            >
              <span>{isExpanded ? 'Hide' : 'Show'} Details</span>
              <svg 
                className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Collapsible Queue Details */}
      {isExpanded && (
        <div className="px-4 sm:p-5 pt-0 pb-4 sm:pb-5 border-t border-cyan-200/50">
          <div className="space-y-3">
            {/* Queue Position */}
            <div className="flex items-center justify-between p-3 bg-white rounded-lg">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <span className="text-sm font-medium text-gray-700">Your Position</span>
          </div>
              <span className="text-lg font-bold text-gray-900">
                {queueStatus.queuePosition || 'Calculating...'} / {queueStatus.totalInQueue || 0}
              </span>
            </div>

            {/* Estimated Wait Time */}
            <div className="flex items-center justify-between p-3 bg-white rounded-lg">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm font-medium text-gray-700">Estimated Wait</span>
          </div>
              <span className="text-lg font-bold text-orange-600">
                {queueStatus.estimatedWaitTime > 0 ? `${queueStatus.estimatedWaitTime} min` : 'Soon'}
              </span>
            </div>

            {/* Delay Alert */}
            {queueStatus.isDelayed && (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <p className="text-sm font-semibold text-yellow-800">Appointment Delayed</p>
                <p className="text-xs text-yellow-600">
                  Running {queueStatus.delayMinutes} minutes behind schedule
                </p>
                </div>
              </div>
            </div>
            )}

            {/* Next Up Alert */}
            {queueStatus.isNextUp && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg animate-pulse">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <div>
                <p className="text-sm font-bold text-green-800">Your Turn Next!</p>
                <p className="text-xs text-green-600">Please proceed to the clinic</p>
                </div>
              </div>
            </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default QueueTracker

