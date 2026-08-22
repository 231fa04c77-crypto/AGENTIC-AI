import React from 'react'
import { useNavigate } from 'react-router-dom'

const FinalCTASection = () => {
  const navigate = useNavigate()

  return (
    <section className="py-20 bg-gradient-to-r from-cyan-500 to-blue-500">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-3xl md:text-5xl font-bold text-white mb-4">
          Still delaying your health concerns?
        </h2>
        <p className="text-xl md:text-2xl text-white/90 mb-8">
          Connect with India's top doctors online — only on MedClues
        </p>
        <button
          onClick={() => navigate('/hospitals')}
          className="px-10 py-4 bg-white text-cyan-600 rounded-lg font-bold text-lg hover:bg-gray-100 transition-all shadow-xl hover:shadow-2xl transform hover:scale-105"
        >
          👉 Book Appointment Now
        </button>
        <p className="text-white/80 text-sm mt-6">
          ✓ Verified Doctors  ✓ 24/7 Available  ✓ Free Follow-up
        </p>
      </div>
    </section>
  )
}

export default FinalCTASection

