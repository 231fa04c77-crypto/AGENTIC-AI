import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { assets } from '../assets/assets'

const PaymentModal = ({ 
    isOpen, 
    onClose, 
    appointment, 
    onRazorpayPayment,
    onPayAtClinic,
    isProcessing 
}) => {
    const [selectedMethod, setSelectedMethod] = useState(null)
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
        return () => setMounted(false)
    }, [])

    if (!isOpen || !appointment || !mounted) return null

    const handlePayment = () => {
        if (selectedMethod === 'razorpay') {
            onRazorpayPayment(appointment._id)
        } else if (selectedMethod === 'clinic') {
            onPayAtClinic(appointment._id)
        }
    }

    const paymentMethods = [
        {
            id: 'razorpay',
            name: 'Razorpay',
            description: 'UPI, Cards, NetBanking & more',
            icon: assets.razorpay_logo,
            gradient: 'from-blue-500 to-cyan-500',
            bgHover: 'hover:bg-blue-50',
            borderColor: 'border-blue-500',
        },
        {
            id: 'clinic',
            name: 'Pay at Clinic',
            description: 'Pay in person during your visit',
            icon: null,
            gradient: 'from-emerald-500 to-teal-500',
            bgHover: 'hover:bg-emerald-50',
            borderColor: 'border-emerald-500',
        }
    ]

    const modalContent = (
        <>
            {/* Backdrop */}
            <div 
                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9998] transition-opacity"
                onClick={onClose}
            />
            
            {/* Modal */}
            <div className="fixed inset-0 flex items-center justify-center z-[9999] p-4 sm:p-6 pb-20 sm:pb-6 pointer-events-none">
                <div 
                    className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col transform transition-all animate-modal-in overflow-hidden pointer-events-auto"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header with gradient */}
                    <div className="bg-gradient-to-r from-cyan-500 to-blue-600 px-5 py-4 sm:px-6 sm:py-5 text-white relative flex-shrink-0">
                        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMzYgMzRjMC0yLjIgMS44LTQgNC00czQgMS44IDQgNC0xLjggNC00IDQtNC0xLjgtNC00eiIvPjwvZz48L2c+PC9zdmc+')] opacity-30"></div>
                        <button 
                            onClick={onClose}
                            className="absolute top-4 right-4 text-white/80 hover:text-white transition-colors p-1 rounded-full hover:bg-white/20"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                        <div className="relative">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                                    </svg>
                                </div>
                                <h2 className="text-xl font-bold">Complete Payment</h2>
                            </div>
                            <p className="text-white/80 text-sm">Choose your preferred payment method</p>
                        </div>
                    </div>

                    {/* Appointment Summary */}
                    <div className="px-5 py-4 sm:px-6 bg-gray-50 border-b border-gray-100 flex-shrink-0">
                        <div className="flex items-center gap-4">
                            <img 
                                src={appointment.docData?.image} 
                                alt={appointment.docData?.name}
                                className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl object-cover shadow-md"
                            />
                            <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-gray-900 truncate text-sm sm:text-base">{appointment.docData?.name}</h3>
                                <p className="text-xs sm:text-sm text-cyan-600 font-medium">{appointment.docData?.speciality}</p>
                            </div>
                            <div className="text-right">
                                <span className="text-xl sm:text-2xl font-bold text-gray-900">
                                    {appointment.docData?.fees ? `₹${appointment.docData.fees}` : '$50'}
                                </span>
                                <p className="text-[10px] sm:text-xs text-gray-500">Consultation Fee</p>
                            </div>
                        </div>
                    </div>

                    {/* Payment Methods (Scrollable Area) */}
                    <div className="px-5 py-4 sm:px-6 sm:py-5 overflow-y-auto flex-1 custom-scrollbar">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Select Payment Method</p>
                        <div className="space-y-3">
                            {paymentMethods.map((method) => (
                                <button
                                    key={method.id}
                                    onClick={() => setSelectedMethod(method.id)}
                                    disabled={isProcessing}
                                    className={`w-full p-4 rounded-xl border-2 transition-all duration-200 flex items-center gap-4 ${
                                        selectedMethod === method.id 
                                            ? `${method.borderColor} bg-gradient-to-r ${method.gradient} bg-opacity-5 shadow-md` 
                                            : `border-gray-200 ${method.bgHover}`
                                    } ${isProcessing ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-md'}`}
                                >
                                    {/* Radio indicator */}
                                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                                        selectedMethod === method.id 
                                            ? `${method.borderColor} bg-gradient-to-r ${method.gradient}` 
                                            : 'border-gray-300'
                                    }`}>
                                        {selectedMethod === method.id && (
                                            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                            </svg>
                                        )}
                                    </div>

                                    {/* Icon/Logo */}
                                    <div className="w-12 h-8 flex items-center justify-center">
                                        {method.icon ? (
                                            <img 
                                                src={method.icon} 
                                                alt={method.name} 
                                                className="h-6 object-contain"
                                            />
                                        ) : (
                                            <div className={`w-10 h-10 rounded-lg bg-gradient-to-r ${method.gradient} flex items-center justify-center`}>
                                                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                                </svg>
                                            </div>
                                        )}
                                    </div>

                                    {/* Text */}
                                    <div className="flex-1 text-left">
                                        <p className={`font-semibold ${selectedMethod === method.id ? 'text-gray-900' : 'text-gray-700'}`}>
                                            {method.name}
                                        </p>
                                        <p className="text-sm text-gray-500">{method.description}</p>
                                    </div>

                                    {/* Arrow */}
                                    <svg className={`w-5 h-5 transition-transform ${selectedMethod === method.id ? 'text-cyan-600 translate-x-1' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="px-5 py-4 sm:px-6 bg-gray-50 border-t border-gray-100 flex gap-3 flex-shrink-0">
                        <button
                            onClick={onClose}
                            disabled={isProcessing}
                            className="flex-1 py-2.5 sm:py-3 px-3 sm:px-4 rounded-xl border-2 border-gray-200 text-gray-700 font-semibold hover:bg-gray-100 transition-colors disabled:opacity-50 text-sm sm:text-base pointer-events-auto"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handlePayment}
                            disabled={!selectedMethod || isProcessing}
                            className={`flex-1 py-3 px-4 rounded-xl font-semibold text-white transition-all flex items-center justify-center gap-2 pointer-events-auto ${
                                selectedMethod && !isProcessing
                                    ? 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:shadow-lg hover:-translate-y-0.5'
                                    : 'bg-gray-300 cursor-not-allowed'
                            }`}
                        >
                            {isProcessing ? (
                                <>
                                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Processing...
                                </>
                            ) : (
                                <>
                                    {selectedMethod === 'clinic' ? 'Confirm Booking' : 'Proceed to Pay'}
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                    </svg>
                                </>
                            )}
                        </button>
                    </div>

                    {/* Security Note */}
                    <div className="px-5 pb-4 sm:px-6 bg-gray-50 flex items-center justify-center gap-2 text-[10px] sm:text-xs text-green-600 flex-shrink-0 font-medium">
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <span>Verified Secure & Encrypted Payment</span>
                    </div>
                </div>
            </div>

            <style jsx>{`
                @keyframes modal-in {
                    from {
                        opacity: 0;
                        transform: scale(0.95) translateY(10px);
                    }
                    to {
                        opacity: 1;
                        transform: scale(1) translateY(0);
                    }
                }
                .animate-modal-in {
                    animation: modal-in 0.3s ease-out;
                }
            `}</style>
        </>
    )

    return createPortal(modalContent, document.body)
}

export default PaymentModal

