import React from 'react'

const HowItWorksSection = () => {
  const steps = [
    {
      number: '1',
      title: 'Select a speciality or symptom',
      description: 'Choose from 25+ specialities or describe your health concern',
      icon: '🔍',
      color: 'from-blue-500 to-cyan-500'
    },
    {
      number: '2',
      title: 'Book Appointment',
      description: 'Schedule an appointment with a verified MedClues doctor',
      icon: '📅',
      color: 'from-cyan-500 to-teal-500'
    },
    {
      number: '3',
      title: 'Get digital prescription',
      description: 'Receive prescription, notes, and free follow-up consultation',
      icon: '📋',
      color: 'from-teal-500 to-green-500'
    }
  ]

  return (
    <section className="py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
            How It Works
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Get expert medical consultation in 3 simple steps
          </p>
        </div>

        <div className="relative">
          {/* Connecting Line */}
          <div className="hidden md:block absolute top-24 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500 via-cyan-500 to-green-500 transform translate-y-8"></div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12 relative">
            {steps.map((step, index) => (
              <div key={index} className="flex flex-col items-center text-center">
                {/* Step Number Circle */}
                <div className={`w-20 h-20 rounded-full bg-gradient-to-r ${step.color} flex items-center justify-center text-white text-3xl font-bold shadow-lg mb-6 relative z-10`}>
                  {step.number}
                </div>

                {/* Icon */}
                <div className={`w-16 h-16 rounded-full bg-gradient-to-r ${step.color} bg-opacity-10 flex items-center justify-center text-4xl mb-4`}>
                  {step.icon}
                </div>

                {/* Content */}
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  {step.title}
                </h3>
                <p className="text-gray-600 text-sm max-w-xs">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

export default HowItWorksSection

