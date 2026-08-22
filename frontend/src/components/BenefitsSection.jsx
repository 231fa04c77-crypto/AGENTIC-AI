import React from 'react'

const BenefitsSection = () => {
  const benefits = [
    {
      icon: '👨‍⚕️',
      title: 'Consult Top Doctors 24×7',
      description: 'Access India\'s best doctors anytime, anywhere. No need to wait for clinic hours.'
    },
    {
      icon: '📱',
      title: 'Convenient & Easy',
      description: 'Book appointments in seconds. Consult from the comfort of your home.'
    },
    {
      icon: '🔒',
      title: '100% Safe & Secure',
      description: 'HIPAA compliant platform with end-to-end encryption for your privacy.'
    },
    {
      icon: '🏥',
      title: 'Clinic-like Experience',
      description: 'Professional consultation with prescription and follow-up support.'
    },
    {
      icon: '🔄',
      title: 'Free Follow-up',
      description: 'Get free follow-up consultations to track your recovery progress.'
    }
  ]

  return (
    <section className="py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
            Benefits of Online Consultation
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Why choose MedClues for your healthcare needs
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {benefits.map((benefit, index) => (
            <div
              key={index}
              className="bg-white/90 backdrop-blur-sm rounded-xl p-6 hover:shadow-lg transition-all duration-300 border border-gray-200"
            >
              <div className="flex items-start gap-4">
                <div className="text-4xl flex-shrink-0">{benefit.icon}</div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2 flex items-center gap-2">
                    <span className="text-green-500">✔</span>
                    {benefit.title}
                  </h3>
                  <p className="text-gray-600 text-sm leading-relaxed">
                    {benefit.description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default BenefitsSection

