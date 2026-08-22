import React from 'react'
import { useNavigate } from 'react-router-dom'

const HealthConcernsSection = () => {
  const navigate = useNavigate()

  const healthConcerns = [
    { 
      title: 'Cough & Cold', 
      image: '🤧', 
      price: '₹199',
      color: 'from-blue-400 to-cyan-400',
      description: 'Get relief from persistent cough and cold'
    },
    { 
      title: 'Period Problems', 
      image: '🩸', 
      price: '₹299',
      color: 'from-pink-500 to-rose-500',
      description: 'Expert consultation for menstrual health'
    },
    { 
      title: 'Performance Issues', 
      image: '💪', 
      price: '₹399',
      color: 'from-purple-500 to-indigo-500',
      description: 'Confidential consultation available'
    },
    { 
      title: 'Skin Problems', 
      image: '✨', 
      price: '₹349',
      color: 'from-yellow-400 to-orange-400',
      description: 'Treat acne, rashes, and skin conditions'
    },
    { 
      title: 'Breathing Issues', 
      image: '🫁', 
      price: '₹399',
      color: 'from-blue-500 to-blue-700',
      description: 'Expert care for respiratory problems'
    },
    { 
      title: 'Pregnancy Queries', 
      image: '🤰', 
      price: '₹299',
      color: 'from-pink-400 to-rose-400',
      description: 'Prenatal and postnatal care guidance'
    },
    { 
      title: 'Digestive Issues', 
      image: '🫀', 
      price: '₹299',
      color: 'from-green-500 to-emerald-500',
      description: 'Stomach pain, acidity, and digestion'
    },
    { 
      title: 'Mental Health', 
      image: '🧠', 
      price: '₹499',
      color: 'from-indigo-500 to-purple-500',
      description: 'Anxiety, depression, and mental wellness'
    },
    { 
      title: 'Back Pain', 
      image: '🦴', 
      price: '₹399',
      color: 'from-gray-500 to-slate-500',
      description: 'Expert treatment for back and joint pain'
    },
  ]

  const handleConsultClick = (concern) => {
    navigate('/doctors')
  }

  return (
    <section className="py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
            Common Health Concerns
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Get expert medical advice for your health concerns
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-6 mb-8">
          {healthConcerns.map((concern, index) => (
            <div
              key={index}
              onClick={() => handleConsultClick(concern)}
              className="bg-white/90 backdrop-blur-sm rounded-xl p-6 hover:shadow-xl transition-all duration-300 cursor-pointer border border-gray-200 group"
            >
              <div className={`w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-r ${concern.color} flex items-center justify-center text-4xl group-hover:scale-110 transition-transform`}>
                {concern.image}
              </div>
              <h3 className="text-lg font-semibold text-gray-900 text-center mb-2">
                {concern.title}
              </h3>
              <p className="text-sm text-gray-600 text-center mb-3 min-h-[40px]">
                {concern.description}
              </p>
              <div className="flex items-center justify-between">
                <span className="text-lg font-bold text-gray-900">
                  Starting at {concern.price}
                </span>
                <button className="text-cyan-600 hover:text-cyan-700 font-semibold group-hover:underline">
                  Consult Now →
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center">
          <button
            onClick={() => navigate('/symptoms')}
            className="px-8 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-lg font-semibold hover:from-cyan-600 hover:to-blue-600 transition-all shadow-md hover:shadow-lg"
          >
            See all Symptoms
          </button>
        </div>
      </div>
    </section>
  )
}

export default HealthConcernsSection

