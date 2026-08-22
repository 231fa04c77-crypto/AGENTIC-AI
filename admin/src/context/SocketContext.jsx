import React, { createContext, useContext, useEffect, useState } from 'react'
import { io } from 'socket.io-client'

const SocketContext = createContext()

export const useSocket = () => {
  const context = useContext(SocketContext)
  if (!context) {
    throw new Error('useSocket must be used within SocketProvider')
  }
  return context
}

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null)
  const [isConnected, setIsConnected] = useState(false)
  const [liveData, setLiveData] = useState({
    patientCount: 0,
    appointments: [],
    revenue: {
      today: 0,
      monthly: 0,
      total: 0
    },
    doctors: {
      online: 0,
      offline: 0,
      total: 0
    }
  })

  useEffect(() => {
    const hasStaffSession = () => !!(
      sessionStorage.getItem('aToken') ||
      sessionStorage.getItem('dToken') ||
      sessionStorage.getItem('recToken') ||
      sessionStorage.getItem('deanToken')
    )

    // Connect for staff panels (reception toasts, admin live data) unless explicitly disabled.
    const isSocketEnabled =
      import.meta.env.VITE_ENABLE_SOCKET === 'true' ||
      (import.meta.env.VITE_ENABLE_SOCKET !== 'false' && hasStaffSession())

    if (!isSocketEnabled) {
      return // Socket disabled - no connection attempts
    }

    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000'
    const staffToken =
      sessionStorage.getItem('aToken') ||
      sessionStorage.getItem('dToken') ||
      sessionStorage.getItem('recToken') ||
      sessionStorage.getItem('deanToken') ||
      ''
    const newSocket = io(backendUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 20,
      auth: staffToken ? { token: staffToken } : undefined,
    })

    newSocket.on('connect', () => {
      console.log('✅ Socket connected')
      setIsConnected(true)
      if (staffToken) {
        newSocket.emit('authenticate', { token: staffToken })
      }
    })

    newSocket.on('disconnect', () => {
      console.log('❌ Socket disconnected')
      setIsConnected(false)
    })

    // Listen for real-time updates
    newSocket.on('new-appointment', (data) => {
      console.log('📅 New appointment:', data)
      setLiveData(prev => ({
        ...prev,
        appointments: [data, ...prev.appointments].slice(0, 10),
        patientCount: prev.patientCount + 1
      }))
    })

    newSocket.on('appointment-updated', (data) => {
      console.log('🔄 Appointment updated:', data)
      setLiveData(prev => ({
        ...prev,
        appointments: prev.appointments.map(apt => 
          apt._id === data._id ? data : apt
        )
      }))
    })

    newSocket.on('revenue-updated', (data) => {
      console.log('💰 Revenue updated:', data)
      setLiveData(prev => ({
        ...prev,
        revenue: data
      }))
    })

    newSocket.on('doctor-status-changed', (data) => {
      console.log('👨‍⚕️ Doctor status changed:', data)
      setLiveData(prev => ({
        ...prev,
        doctors: {
          ...prev.doctors,
          online: data.online || prev.doctors.online,
          offline: data.offline || prev.doctors.offline,
          lastStatusEvent: data,
        }
      }))
    })

    newSocket.on('patient-count-updated', (count) => {
      console.log('👥 Patient count updated:', count)
      setLiveData(prev => ({
        ...prev,
        patientCount: count
      }))
    })

    setSocket(newSocket)

    return () => {
      newSocket.close()
    }
  }, [])

  const value = {
    socket,
    isConnected,
    liveData,
    setLiveData
  }

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  )
}

export default SocketProvider

