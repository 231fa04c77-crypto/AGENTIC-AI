import React from 'react'
import { useNavigate } from 'react-router-dom'


const SpecialitiesSection = () => {
  const navigate = useNavigate()

  const specialities = [
    { name: 'Gynaecology', icon: '👩‍⚕️', price: '₹299', color: 'from-pink-500 to-rose-500' },
    { name: 'Sexology', icon: '💑', price: '₹399', color: 'from-purple-500 to-indigo-500' },
    { name: 'General Physician', icon: '🩺', price: '₹199', color: 'from-blue-500 to-cyan-500' },
    { name: 'Dermatology', icon: '✨', price: '₹349', color: 'from-yellow-500 to-orange-500' },
    { name: 'Psychiatry', icon: '🧠', price: '₹499', color: 'from-indigo-500 to-purple-500' },
    { name: 'Stomach & Digestion', icon: '🫀', price: '₹299', color: 'from-green-500 to-emerald-500' },
    { name: 'Pediatrics', icon: '👶', price: '₹249', color: 'from-blue-400 to-cyan-400' },
    { name: 'Orthopedics', icon: '🦴', price: '₹399', color: 'from-gray-500 to-slate-500' },
    { name: 'Cardiology', icon: '❤️', price: '₹599', color: 'from-red-500 to-pink-500' },
    { name: 'Neurology', icon: '🧬', price: '₹549', color: 'from-violet-500 to-purple-500' },
    { name: 'ENT', icon: '👂', price: '₹299', color: 'from-teal-500 to-cyan-500' },
    { name: 'Pulmonology', icon: '🫁', price: '₹399', color: 'from-blue-600 to-blue-400' },
    { name: 'Endocrinology', icon: '⚕️', price: '₹449', color: 'from-orange-500 to-red-500' },
    { name: 'Urology', icon: '🔬', price: '₹399', color: 'from-blue-700 to-blue-500' },
    { name: 'Oncology', icon: '🎗️', price: '₹699', color: 'from-red-600 to-orange-600' },
    { name: 'Ophthalmology', icon: '👁️', price: '₹349', color: 'from-cyan-500 to-blue-500' },
    { name: 'Dentistry', icon: '🦷', price: '₹299', color: 'from-white to-gray-200' },
    { name: 'Nutrition', icon: '🥗', price: '₹249', color: 'from-green-400 to-green-600' },
    { name: 'Physiotherapy', icon: '🏃', price: '₹349', color: 'from-orange-400 to-red-400' },
    { name: 'Nephrology', icon: '🔬', price: '₹449', color: 'from-blue-500 to-indigo-500' },
    { name: 'Rheumatology', icon: '🦵', price: '₹399', color: 'from-purple-400 to-pink-400' },
    { name: 'General Surgery', icon: '⚕️', price: '₹599', color: 'from-gray-600 to-gray-800' },
    { name: 'Radiology', icon: '📷', price: '₹449', color: 'from-slate-500 to-gray-600' },
    { name: 'Emergency Care', icon: '🚑', price: '₹799', color: 'from-red-600 to-red-800' },
  ]

  const handleConsultClick = (speciality) => {
    navigate('/doctors')
  }

  return (
    <section className="py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
            25+ Specialities
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Consult with verified MedClues doctors across specialities
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-8">
          {specialities.map((speciality, index) => (
            <div
              key={index}
              onClick={() => handleConsultClick(speciality)}
              className="bg-white/90 backdrop-blur-sm border border-gray-200 rounded-xl p-4 hover:shadow-lg hover:border-cyan-500 transition-all duration-300 cursor-pointer group"
            >
              <div className={`w-12 h-12 mx-auto mb-3 rounded-full bg-gradient-to-r ${speciality.color} flex items-center justify-center text-2xl group-hover:scale-110 transition-transform`}>
                {speciality.icon}
              </div>
              <h3 className="text-sm font-semibold text-gray-900 text-center mb-1">
                {speciality.name}
              </h3>
              <p className="text-xs text-gray-500 text-center mb-3">
                Starting at {speciality.price}
              </p>
              <button className="w-full text-xs font-medium text-cyan-600 hover:text-cyan-700 group-hover:underline">
                Consult Now →
              </button>
            </div>
          ))}
        </div>

        <div className="text-center">
          <button
            onClick={() => navigate('/specialities')}
            className="px-8 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-lg font-semibold hover:from-cyan-600 hover:to-blue-600 transition-all shadow-md hover:shadow-lg"
          >
            See all Specialities
          </button>
        </div>
      </div>
    </section>
  )
}

export default SpecialitiesSection

