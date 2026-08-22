import React, { useContext } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AppContext } from '../context/AppContext'
import BackArrow from '../components/BackArrow'
import VideoConsultRoom from '../components/VideoConsultRoom'

const VideoConsult = () => {
  const { appointmentId } = useParams()
  const { token } = useContext(AppContext)
  const navigate = useNavigate()

  if (!token) {
    navigate('/login')
    return null
  }

  return (
    <div className="page-container py-6 max-w-5xl mx-auto">
      <div className="mb-6 flex items-center gap-3">
        <BackArrow />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Video consultation</h1>
          <p className="text-sm text-gray-600">Secure call with your doctor</p>
        </div>
      </div>
      <VideoConsultRoom
        appointmentId={appointmentId}
        role="patient"
        authToken={token}
        authHeader="token"
        peerLabel="doctor"
        onLeave={() => navigate('/my-appointments')}
      />
    </div>
  )
}

export default VideoConsult
