import React, { useContext, useEffect, useState } from 'react'
import { AppContext } from '../context/AppContext'
import axios from 'axios'
import { toast } from 'react-toastify'
import BackButton from '../components/BackButton'
import BackArrow from '../components/BackArrow'
import LoadingSpinner from '../components/LoadingSpinner'

const MyLabs = () => {
    const { token, backendUrl } = useContext(AppContext)
    const [bookings, setBookings] = useState([])
    const [reports, setReports] = useState([])
    const [loading, setLoading] = useState(true)

    const fetchMyLabsData = async () => {
        if (!token) return
        setLoading(true)
        try {
            // Fetch Lab Bookings
            const bookingsRes = await axios.get(backendUrl + '/api/lab/my-bookings', { headers: { token } })
            if (bookingsRes.data.success) {
                setBookings(bookingsRes.data.bookings)
            }

            // Fetch Lab Reports from Health Records
            const reportsRes = await axios.get(backendUrl + '/api/user/health-records', { headers: { token } })
            if (reportsRes.data.success) {
                const labReports = reportsRes.data.records.filter(r => 
                    r.record_type === 'Lab Report' || r.record_type === 'Blood Report'
                )
                setReports(labReports)
            }
        } catch (error) {
            console.error('Error fetching lab data:', error)
            toast.error('Failed to load your lab data')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchMyLabsData()
    }, [token])

    const cancelBooking = async (bookingId) => {
        if (!window.confirm('Are you sure you want to cancel this booking?')) return
        try {
            const { data } = await axios.post(backendUrl + '/api/lab/cancel', { bookingId }, { headers: { token } })
            if (data.success) {
                toast.success(data.message)
                fetchMyLabsData()
            } else {
                toast.error(data.message)
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Error cancelling booking')
        }
    }

    if (loading) return <LoadingSpinner fullScreen text="Retrieving Lab Records..." />

    return (
        <div className='page-container fade-in'>
            <div className='mb-6 flex items-center gap-4'>
                <BackArrow />
                <BackButton to="/labs" label="Back to Labs" />
            </div>

            <div className='max-w-6xl mx-auto px-4'>
                <div className='text-center mb-10'>
                    <h1 className='text-4xl font-black text-gray-900 mb-2'>
                        My <span className='text-cyan-500'>Lab Hub</span>
                    </h1>
                    <p className='text-gray-500 font-medium'>Manage your bookings and view your hospital-synchronized reports.</p>
                </div>

                <div className='grid grid-cols-1 lg:grid-cols-2 gap-10'>
                    {/* Lab Bookings Section */}
                    <div className='space-y-6'>
                        <div className='flex items-center gap-3 border-b border-gray-100 pb-4'>
                            <div className='p-2.5 bg-cyan-50 rounded-xl text-cyan-600'>
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                            </div>
                            <h2 className='text-2xl font-bold text-gray-800'>Recent Bookings</h2>
                        </div>

                        {bookings.length === 0 ? (
                            <div className='bg-white rounded-3xl p-10 border border-dashed border-gray-200 text-center'>
                                <p className='text-gray-400 font-medium'>No active lab bookings found.</p>
                            </div>
                        ) : (
                            <div className='space-y-4'>
                                {bookings.map((booking) => (
                                    <div key={booking.id} className='bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-all group'>
                                        <div className='flex justify-between items-start mb-4'>
                                            <div>
                                                <h3 className='font-bold text-lg text-gray-900'>{booking.lab_name}</h3>
                                                <p className='text-cyan-600 font-bold text-sm'>{booking.test_name}</p>
                                            </div>
                                            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                                booking.status === 'completed' ? 'bg-emerald-50 text-emerald-600' :
                                                booking.status === 'cancelled' ? 'bg-red-50 text-red-600' :
                                                'bg-blue-50 text-blue-600'
                                            }`}>
                                                {booking.status}
                                            </span>
                                        </div>
                                        <div className='flex items-center gap-4 text-sm text-gray-500 mb-6'>
                                            <div className='flex items-center gap-1.5'>
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                </svg>
                                                {new Date(booking.preferred_date).toLocaleDateString()}
                                            </div>
                                            <div className='flex items-center gap-1.5'>
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                                </svg>
                                                {booking.phone}
                                            </div>
                                        </div>
                                        {booking.status === 'pending' && (
                                            <button 
                                                onClick={() => cancelBooking(booking.id)}
                                                className='w-full py-2.5 bg-red-50 text-red-600 rounded-xl font-bold text-sm hover:bg-red-100 transition-colors'
                                            >
                                                Cancel Booking
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Lab Reports Section */}
                    <div className='space-y-6'>
                        <div className='flex items-center gap-3 border-b border-gray-100 pb-4'>
                            <div className='p-2.5 bg-emerald-50 rounded-xl text-emerald-600'>
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                            </div>
                            <h2 className='text-2xl font-bold text-gray-800'>Digital Reports</h2>
                        </div>

                        {reports.length === 0 ? (
                            <div className='bg-white rounded-3xl p-10 border border-dashed border-gray-200 text-center'>
                                <p className='text-gray-400 font-medium'>No synchronized reports found.</p>
                            </div>
                        ) : (
                            <div className='space-y-4'>
                                {reports.map((report) => (
                                    <div key={report.id} className={`bg-white rounded-2xl p-6 border transition-all hover:shadow-lg flex flex-col justify-between ${report.is_important ? 'border-amber-200 bg-amber-50/10' : 'border-gray-100'}`}>
                                        <div className='flex justify-between items-start mb-4'>
                                            <div>
                                                <h3 className='font-bold text-lg text-gray-900'>{report.title}</h3>
                                                <p className='text-gray-500 text-sm font-medium'>Ref: {report.notes}</p>
                                            </div>
                                            {report.is_important && (
                                                <span className='bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-[9px] font-black uppercase'>Priority</span>
                                            )}
                                        </div>
                                        <div className='flex items-center gap-4 text-xs text-gray-400 mb-6'>
                                            <span>{new Date(report.record_date).toLocaleDateString()}</span>
                                            <span>•</span>
                                            <span>{report.doctor_name}</span>
                                        </div>
                                        <div className='space-y-2'>
                                            {(typeof report.attachments === 'string' ? JSON.parse(report.attachments) : report.attachments).map((att, i) => (
                                                <a 
                                                    key={i} 
                                                    href={att.url} 
                                                    target="_blank" 
                                                    rel="noopener noreferrer"
                                                    className='flex items-center justify-between px-4 py-3 bg-gray-50 rounded-xl hover:bg-emerald-50 text-gray-700 hover:text-emerald-700 transition-all border border-transparent hover:border-emerald-100'
                                                >
                                                    <span className='font-bold text-xs uppercase tracking-wider'>Download Report</span>
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4-4m0 0L8 8m4-4v12" />
                                                    </svg>
                                                </a>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Info Box */}
                <div className='mt-16 bg-blue-50 rounded-3xl p-8 flex flex-col sm:flex-row items-center gap-6 border border-blue-100'>
                    <div className='p-4 bg-white rounded-2xl shadow-sm text-blue-600'>
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <div>
                        <h4 className='text-lg font-bold text-blue-900 mb-1'>How it works?</h4>
                        <p className='text-blue-700 text-sm leading-relaxed'>
                            Reports are automatically synchronized from collaborated hospitals within 24 hours of your visit. 
                            If you don't see a report, please contact the respective hospital center.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default MyLabs
