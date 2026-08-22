import React from 'react'
import { Link } from 'react-router-dom'
import BackArrow from '../components/BackArrow'
import BackButton from '../components/BackButton'

/**
 * Legacy unauthenticated /api/appointments book form retired.
 * Patients book via Doctors → Appointment (authenticated).
 */
const BookService = () => {
  return (
    <div className='min-h-screen bg-gradient-to-br from-cyan-50 via-white to-blue-50 py-8 px-4'>
      <div className='max-w-xl mx-auto'>
        <div className='mb-4 flex items-center gap-3'>
          <BackArrow />
          <BackButton />
        </div>
        <div className='bg-white rounded-2xl shadow-lg p-8 border border-slate-100'>
          <h1 className='text-2xl font-bold text-slate-900 mb-2'>Book an appointment</h1>
          <p className='text-slate-600 text-sm mb-6'>
            Direct service booking without sign-in is disabled. Please choose a doctor and complete
            booking through the appointment flow.
          </p>
          <Link
            to='/doctors'
            className='inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-cyan-600 text-white text-sm font-semibold hover:bg-cyan-700'
          >
            Browse doctors
          </Link>
        </div>
      </div>
    </div>
  )
}

export default BookService
