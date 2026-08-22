import React from 'react'

const DoctorProfileView = ({ doctor, hospital, isOpen, onClose }) => {
    if (!doctor) return null

    return (
        <>
            {/* Official Profile View - Full Overlay matching the generic page style */}
            <div
                className={`fixed inset-0 z-50 bg-[#F0F2F5] overflow-y-auto transition-all duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
            >
                {/* Navbar Placeholder / Close Bar */}
                <div className="sticky top-0 z-40 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-2 text-gray-500 text-sm">
                        <span className="hover:text-primary cursor-pointer">Home</span> /
                        <span className="hover:text-primary cursor-pointer">Doctors</span> /
                        <span className="text-gray-800 font-medium">{doctor.name}</span>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-500 hover:text-gray-800 p-2 hover:bg-gray-100 rounded-full transition-colors"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                {/* Main Profile Card Container */}
                <div className="max-w-5xl mx-auto px-4 py-8">

                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">

                        {/* 1. Header Section (Blue Gradient) */}
                        <div className="bg-gradient-to-r from-[#5F6FFF] to-[#5F6FFF] p-8 md:p-10 flex flex-col md:flex-row items-center gap-8">
                            {/* Avatar */}
                            <div className="relative shrink-0">
                                <div className="w-32 h-32 md:w-36 md:h-36 rounded-full border-4 border-white shadow-md bg-white flex items-center justify-center overflow-hidden">
                                    {doctor.image ? (
                                        <img src={doctor.image} alt={doctor.name} className="w-full h-full object-cover" />
                                    ) : (
                                        <span className="text-[#5F6FFF] text-5xl font-bold">{doctor.name.charAt(0)}</span>
                                    )}
                                </div>
                                {/* Online Status Dot */}
                                {doctor.available && (
                                    <div className="absolute bottom-2 right-2 w-6 h-6 bg-[#22C55E] border-4 border-white rounded-full"></div>
                                )}
                            </div>

                            {/* Info */}
                            <div className="text-center md:text-left text-white flex-1">
                                <div className="flex items-center justify-center md:justify-start gap-2 mb-2">
                                    <h1 className="text-2xl md:text-3xl font-bold">{doctor.name}</h1>
                                    {/* Verified Badge */}
                                    <svg className="w-6 h-6 text-white/90 fill-current" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                    </svg>
                                </div>

                                <p className="text-white/90 text-sm md:text-base mb-4 font-light">
                                    {doctor.qualification} - {doctor.specialization}
                                </p>

                                {/* Experience Pill */}
                                <div className="inline-flex items-center gap-2 bg-white text-gray-800 px-4 py-1.5 rounded-full text-xs font-semibold shadow-sm">
                                    <span className="text-sm">🏆</span>
                                    <span>{doctor.experience} Years Experience</span>
                                </div>
                            </div>
                        </div>

                        {/* 2. White Content Area */}
                        <div className="p-8 md:p-10 space-y-8">

                            {/* About Section */}
                            <div>
                                <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                                    <span className="text-blue-600">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                    </span>
                                    About
                                </h3>
                                <p className="text-gray-600 text-sm leading-relaxed">
                                    {doctor.name} is a trusted <span className="font-medium">{doctor.specialization}</span> with over {doctor.experience} years of clinical experience.
                                    Compatible specializing in {doctor.specialization.toLowerCase()} treatments and preventive care. Currently associated with <span className="font-medium text-gray-900">{hospital?.name}</span>, ensuring high standards of medical service.
                                </p>
                            </div>

                            <hr className="border-gray-100" />

                            {/* Qualifications Section */}
                            <div>
                                <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                                    <span className="text-blue-600">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" /></svg>
                                    </span>
                                    Qualifications
                                </h3>
                                <div className="ml-7">
                                    <p className="text-gray-700 font-medium">{doctor.qualification}</p>
                                    <p className="text-gray-500 text-xs mt-1">{doctor.specialization}</p>
                                </div>
                            </div>

                            <hr className="border-gray-100" />

                            {/* Fee & Action */}
                            <div className="space-y-6">
                                {/* Consultation Fee Box */}
                                <div className="inline-block bg-cyan-50 px-4 py-3 rounded-md border border-cyan-100">
                                    <span className="text-gray-600 text-sm font-medium mr-2">Consultation Fee:</span>
                                    <span className="text-gray-900 font-bold">₹{doctor.fees || 500}</span>
                                </div>

                                {/* Close / Action Button */}
                                <button
                                    onClick={onClose}
                                    className="w-full bg-[#5F6FFF] hover:bg-[#4d5ce0] text-white font-medium py-3.5 rounded-md transition-colors shadow-sm text-sm"
                                >
                                    Close Profile
                                </button>
                            </div>

                        </div>
                    </div>

                    {/* Floating Info (Optional - Mimicking page elements) */}
                    <div className="mt-8 text-center text-gray-400 text-xs">
                        Admin View • Read Only Mode
                    </div>

                </div>
            </div>
        </>
    )
}

export default DoctorProfileView
