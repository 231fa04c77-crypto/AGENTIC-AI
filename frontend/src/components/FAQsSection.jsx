import React, { useState } from 'react'

const FAQsSection = () => {
  const [openIndex, setOpenIndex] = useState(0)

  const faqs = [
    {
      question: 'What is online doctor consultation?',
      answer: 'Online doctor consultation allows you to book appointments with verified doctors and consult from the comfort of your home. You can discuss your health concerns, get medical advice, and receive digital prescriptions without visiting a clinic.'
    },
    {
      question: 'Are MedClues doctors verified?',
      answer: 'Yes, all doctors on MedClues are verified medical professionals with valid licenses. We verify their qualifications, experience, and credentials before they can provide consultations on our platform.'
    },
    {
      question: 'Is online consultation safe?',
      answer: 'Absolutely! MedClues follows HIPAA compliance standards and uses end-to-end encryption for all consultations. Your medical information is kept confidential and secure. All video calls are conducted through secure, encrypted channels.'
    },
    {
      question: 'What if the doctor doesn\'t respond?',
      answer: 'If your selected doctor is unavailable, you can choose another doctor from the same speciality. In case of any issues, our 24/7 support team is available to help you find an alternative doctor or process a refund.'
    },
    {
      question: 'Is free consultation available?',
      answer: 'While we don\'t offer completely free consultations, we provide free follow-up consultations after your initial paid consultation. This helps you track your recovery progress without additional charges.'
    },
    {
      question: 'How are prescriptions provided?',
      answer: 'After your consultation, the doctor will provide a digital prescription that you can download as a PDF. The prescription includes all medications, dosages, and instructions. You can also access it anytime from your MedClues account.'
    },
    {
      question: 'Can I consult with doctors from other cities?',
      answer: 'Yes! Online consultation allows you to consult with doctors from anywhere in India. You can choose doctors based on their expertise, ratings, and availability, regardless of your location.'
    },
    {
      question: 'How do I book an appointment?',
      answer: 'Simply browse our list of verified doctors, select a doctor, choose your preferred date and time, and confirm your booking. You can also filter doctors by speciality, location, and availability.'
    }
  ]

  const toggleFAQ = (index) => {
    setOpenIndex(openIndex === index ? null : index)
  }

  return (
    <section className="py-16">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
            Frequently Asked Questions
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Everything you need to know about online consultation
          </p>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <div
              key={index}
              className="border border-gray-200 rounded-lg overflow-hidden transition-all"
            >
              <button
                onClick={() => toggleFAQ(index)}
                className="w-full px-6 py-4 text-left flex items-center justify-between bg-white/80 backdrop-blur-sm hover:bg-white/90 transition-colors"
              >
                <span className="font-semibold text-gray-900 pr-4">
                  {faq.question}
                </span>
                <svg
                  className={`w-5 h-5 text-gray-600 flex-shrink-0 transition-transform ${
                    openIndex === index ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {openIndex === index && (
                <div className="px-6 py-4 bg-white/90 backdrop-blur-sm">
                  <p className="text-gray-700 leading-relaxed">
                    {faq.answer}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default FAQsSection

