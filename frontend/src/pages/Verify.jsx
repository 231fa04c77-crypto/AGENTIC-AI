import axios from 'axios';
import React, { useContext, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AppContext } from '../context/AppContext';
import { toast } from 'react-toastify';
import BackButton from '../components/BackButton';
import BackArrow from '../components/BackArrow';
import LoadingSpinner from '../components/LoadingSpinner';
import BrandLogo from '../components/BrandLogo';
import QRCode from 'react-qr-code';

const Verify = () => {

    const [searchParams] = useSearchParams()
    const [verificationStatus, setVerificationStatus] = useState('loading') // loading, success, failed
    const [paymentDetails, setPaymentDetails] = useState(null)

    const success = searchParams.get("success")
    const appointmentId = searchParams.get("appointmentId")

    const { backendUrl, token, currencySymbol } = useContext(AppContext)
    const navigate = useNavigate()

    // Generate transaction ID
    const generateTransactionId = () => {
        const timestamp = Date.now()
        const random = Math.floor(Math.random() * 10000)
        return `TXN${timestamp}${random}`
    }

    // Legacy Stripe verify URL — redirect to My Appointments (Razorpay only)
    const handleLegacyStripeReturn = async () => {
        setVerificationStatus('failed')
        toast.error('Stripe payments are no longer supported. Please pay with Razorpay from My Appointments.')
        setTimeout(() => navigate('/my-appointments'), 1500)
    }

    // Format date from "25_11_2025" to "November 25, 2025"
    const formatDate = (dateStr) => {
        if (!dateStr) return ''
        const parts = dateStr.split('_')
        if (parts.length !== 3) return dateStr
        const date = new Date(parts[2], parts[1] - 1, parts[0])
        return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    }

    // Print receipt
    const handlePrint = () => {
        window.print()
    }

    // Download receipt as text (simplified)
    const handleDownload = () => {
        if (!paymentDetails) return
        
        const receiptText = `
MedClues Healthcare
Payment Receipt
=====================================

Transaction ID: ${paymentDetails.transactionId}
Date: ${paymentDetails.paidAt}

APPOINTMENT DETAILS
-------------------
Patient Name: ${paymentDetails.patientName}
Doctor: ${paymentDetails.doctorName}
Specialty: ${paymentDetails.specialty}
Appointment Date: ${paymentDetails.appointmentDate}
Appointment Time: ${paymentDetails.appointmentTime}

PAYMENT DETAILS
---------------
Amount: ${currencySymbol}${paymentDetails.amount}
Payment Method: ${paymentDetails.paymentMethod}
Status: ${paymentDetails.paymentStatus}

=====================================
Thank you for choosing MedClues Healthcare!
        `.trim()

        const blob = new Blob([receiptText], { type: 'text/plain' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `receipt_${paymentDetails.transactionId}.txt`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
    }

    useEffect(() => {
        if (token && appointmentId && success) {
            handleLegacyStripeReturn()
        }
    }, [token])

    // Loading state
    if (verificationStatus === 'loading') {
        return (
            <div className='min-h-[60vh] flex flex-col items-center justify-center gap-4'>
                <LoadingSpinner size="large" text="Verifying payment..." />
            </div>
        )
    }

    // Failed state
    if (verificationStatus === 'failed') {
        return (
            <div className='page-container fade-in'>
                <div className='mb-6 flex items-center gap-4'>
                    <BackArrow />
                    <BackButton to="/my-appointments" label="Back to Appointments" />
                </div>
                <div className='max-w-md mx-auto'>
                    <div className='card p-8 text-center'>
                        <div className='w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center'>
                            <svg className='w-8 h-8 text-red-500' fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </div>
                        <h2 className='text-xl font-bold text-gray-900 mb-2'>Payment Failed</h2>
                        <p className='text-gray-600 mb-6'>Your payment could not be processed. Please try again.</p>
                        <button 
                            onClick={() => navigate('/my-appointments')}
                            className='btn btn-primary btn-full'
                        >
                            Back to Appointments
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    // Success state - Responsive Receipt Card
    return (
        <div className='page-container fade-in'>
            {/* Back Arrow Button */}
            <div className='mb-6 no-print flex items-center gap-4'>
                <BackArrow />
                <BackButton to="/my-appointments" label="Back to Appointments" />
            </div>

            {/* Responsive Receipt Card */}
            <div className='max-w-[320px] md:max-w-[700px] mx-auto'>
                <div className='receipt-card bg-white rounded-xl md:rounded-2xl shadow-xl overflow-hidden border border-gray-200'>
                    
                    {/* Top Header */}
                    <div className='flex'>
                        <div className='bg-cyan-500 px-4 md:px-6 py-2 md:py-3 flex-1 flex items-center gap-3'>
                            <div className='hidden sm:block'>
                                <BrandLogo size="small" variant="header" clickable={false} className="brightness-0 invert" />
                            </div>
                            <div>
                                <p className='text-white text-sm md:text-base font-bold tracking-wide'>MedClues</p>
                                <p className='text-white/70 text-[10px] md:text-xs'>Payment Receipt</p>
                            </div>
                        </div>
                        <div className='bg-green-500 px-3 md:px-6 py-2 md:py-3 flex items-center gap-1 md:gap-2'>
                            <svg className="w-4 h-4 md:w-5 md:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                            </svg>
                            <span className='text-white font-bold text-xs md:text-sm'>PAID</span>
                        </div>
                    </div>

                    {/* Body - Vertical on mobile, Horizontal on desktop */}
                    <div className='flex flex-col md:flex-row'>
                        
                        {/* Details */}
                        <div className='flex-1 p-4 md:p-6 order-1'>
                            {/* Patient & TXN */}
                            <div className='border-b border-dashed border-gray-200 pb-2 md:pb-3 mb-3 md:mb-4'>
                                <p className='text-gray-800 font-bold text-lg md:text-xl'>{paymentDetails?.patientName}</p>
                                <p className='font-mono text-gray-400 text-[10px] md:text-xs mt-1'>TXN: {paymentDetails?.transactionId}</p>
                            </div>

                            {/* Details Grid - 2 columns */}
                            <div className='grid grid-cols-2 gap-x-4 md:gap-x-6 gap-y-3 md:gap-y-4'>
                                <div>
                                    <p className='text-[9px] md:text-[10px] text-gray-400 uppercase font-medium'>Doctor</p>
                                    <p className='font-semibold text-gray-800 text-xs md:text-sm mt-0.5 md:mt-1'>{paymentDetails?.doctorName}</p>
                                </div>
                                <div>
                                    <p className='text-[9px] md:text-[10px] text-gray-400 uppercase font-medium'>Specialty</p>
                                    <p className='font-semibold text-cyan-600 text-xs md:text-sm mt-0.5 md:mt-1'>{paymentDetails?.specialty}</p>
                                </div>
                                <div>
                                    <p className='text-[9px] md:text-[10px] text-gray-400 uppercase font-medium'>Date</p>
                                    <p className='font-semibold text-gray-800 text-xs md:text-sm mt-0.5 md:mt-1'>{paymentDetails?.appointmentDate}</p>
                                </div>
                                <div>
                                    <p className='text-[9px] md:text-[10px] text-gray-400 uppercase font-medium'>Time</p>
                                    <p className='font-semibold text-gray-800 text-xs md:text-sm mt-0.5 md:mt-1'>{paymentDetails?.appointmentTime}</p>
                                </div>
                            </div>
                        </div>

                        {/* Fee & QR - Side by side on mobile, separate sections on desktop */}
                        <div className='flex md:contents order-2 border-t md:border-t-0 border-dashed border-gray-200'>
                            {/* Fee - Shows in middle on desktop */}
                            <div className='bg-gradient-to-b from-green-50 to-emerald-50 p-4 md:p-6 flex flex-col items-center justify-center flex-1 md:flex-initial md:min-w-[120px] md:border-x border-r md:border-r-0 border-dashed border-gray-200 md:order-1'>
                                <p className='text-[10px] md:text-[10px] text-gray-500 uppercase font-semibold'>Amount Paid</p>
                                <p className='font-bold text-green-600 text-xl md:text-lg mt-1'>{currencySymbol}{paymentDetails?.amount}</p>
                                <p className='text-[9px] md:text-[9px] text-gray-400 mt-1'>{paymentDetails?.paymentMethod}</p>
                                <div className='flex items-center gap-1 mt-1 text-green-600'>
                                    <svg className='w-3 h-3' fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                    </svg>
                                    <span className='text-[8px] font-semibold'>Complete</span>
                                </div>
                            </div>

                            {/* QR Code - Shows at end on desktop */}
                            <div className='p-4 md:p-6 flex items-center justify-center bg-gray-50 flex-1 md:flex-initial md:order-2'>
                                <div className='p-2 md:p-3 bg-white border-2 border-gray-200 rounded-lg md:rounded-xl shadow-sm'>
                                    {/* Mobile QR */}
                                    <div className='block md:hidden'>
                                        <QRCode value={paymentDetails?.qrData || 'receipt'} size={80} level="H" />
                                    </div>
                                    {/* Desktop QR */}
                                    <div className='hidden md:block'>
                                        <QRCode value={paymentDetails?.qrData || 'receipt'} size={140} level="H" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Bottom Buttons */}
                    <div className='flex gap-2 md:gap-3 p-3 md:p-4 bg-gray-50 border-t border-gray-200 no-print'>
                        <button 
                            onClick={handleDownload}
                            className="flex-1 py-2 md:py-3 bg-white border border-gray-200 hover:bg-gray-100 text-gray-600 font-semibold rounded-lg md:rounded-xl text-xs md:text-sm flex items-center justify-center gap-1"
                        >
                            <svg className='w-3.5 h-3.5 md:w-4 md:h-4' fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            <span className='hidden md:inline'>Download</span>
                        </button>
                        <button 
                            onClick={handlePrint}
                            className="flex-1 py-2 md:py-3 bg-white border border-gray-200 hover:bg-gray-100 text-gray-600 font-semibold rounded-lg md:rounded-xl text-xs md:text-sm flex items-center justify-center gap-1"
                        >
                            <svg className='w-3.5 h-3.5 md:w-4 md:h-4' fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                            </svg>
                            <span className='hidden md:inline'>Print</span>
                        </button>
                        <button 
                            onClick={() => navigate('/my-appointments')}
                            className="flex-1 py-2 md:py-3 bg-cyan-500 hover:bg-cyan-600 text-white font-semibold rounded-lg md:rounded-xl text-xs md:text-sm"
                        >
                            View Appointments
                        </button>
                    </div>
                </div>
            </div>

            {/* Print Styles */}
            <style>{`
                @media print {
                    .no-print { display: none !important; }
                    body { background: white !important; }
                    .receipt-card { box-shadow: none !important; }
                }
            `}</style>
        </div>
    )
}

export default Verify
