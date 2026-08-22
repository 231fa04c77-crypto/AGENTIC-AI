import React, { useContext, useEffect, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AppContext } from '../../context/AppContext'
import { DoctorContext } from '../../context/DoctorContext'
import DoctorVideoConsultRoom from '../../components/DoctorVideoConsultRoom'

const DoctorVideoConsult = () => {
  const { appointmentId } = useParams()
  const { dToken, appointments, getAppointments } = useContext(DoctorContext)
  const { slotDateFormat } = useContext(AppContext)
  const navigate = useNavigate()

  useEffect(() => {
    if (dToken && appointments.length === 0) getAppointments()
  }, [dToken])

  const appointment = useMemo(
    () => appointments.find((a) => String(a._id) === String(appointmentId)),
    [appointments, appointmentId]
  )

  const scheduledTime = appointment
    ? `${slotDateFormat(appointment.slotDate)} · ${appointment.slotTime || ''}`.trim()
    : null

  if (!dToken) {
    navigate('/login')
    return null
  }

  return (
    <div className="w-full p-3 sm:p-4 lg:p-5 animate-fade-in-up bg-slate-50 mobile-safe-area pb-6 min-h-full">
      <DoctorVideoConsultRoom
        appointmentId={appointmentId}
        authToken={dToken}
        appointment={appointment}
        scheduledTime={scheduledTime}
        publishCameraInitial={false}
        onLeave={() => navigate('/doctor-appointments')}
      />
    </div>
  )
}

export default DoctorVideoConsult
