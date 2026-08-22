import React, { useState } from 'react'

const TestimonialsSection = () => {
  const [currentIndex, setCurrentIndex] = useState(0)

  const testimonials = [
    {
      name: 'Priya Sharma',
      rating: 5,
      feedback: 'Excellent experience! The consultation was smooth and the doctor was very patient. Got my prescription within minutes.',
      location: 'Mumbai',
      date: '2 days ago'
    },
    {
      name: 'Rajesh Kumar',
      rating: 5,
      feedback: 'MedClues saved me a lot of time. The doctor understood my problem quickly and provided the right treatment. Highly recommended!',
      location: 'Delhi',
      date: '5 days ago'
    },
    {
      name: 'Anita Patel',
      rating: 5,
      feedback: 'Best platform for online consultation. The follow-up consultation was free and helped me recover faster. Thank you MedClues!',
      location: 'Bangalore',
      date: '1 week ago'
    },
    {
      name: 'Vikram Singh',
      rating: 5,
      feedback: 'Very professional doctors and easy to use platform. The prescription was clear and I could download it immediately.',
      location: 'Pune',
      date: '3 days ago'
    },
    {
      name: 'Sneha Reddy',
      rating: 5,
      feedback: 'Amazing service! Got consultation at midnight when I needed it the most. The doctor was available and very helpful.',
      location: 'Hyderabad',
      date: '1 week ago'
    }
  ]

  const nextTestimonial = () => {
    setCurrentIndex((prev) => (prev + 1) % testimonials.length)
  }

  const prevTestimonial = () => {
    setCurrentIndex((prev) => (prev - 1 + testimonials.length) % testimonials.length)
  }

  return (
    <section className="py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
            What our users say
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Real feedback from patients who used our online consultation service
          </p>
        </div>

        <div className="relative max-w-4xl mx-auto">
          {/* Testimonial Card */}
          <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-8 md:p-12 shadow-lg border border-gray-200">
            <div className="flex items-center gap-1 mb-4">
              {[...Array(testimonials[currentIndex].rating)].map((_, i) => (
                <span key={i} className="text-yellow-400 text-2xl">⭐</span>
              ))}
            </div>
            <p className="text-gray-700 text-lg md:text-xl mb-6 leading-relaxed">
              "{testimonials[currentIndex].feedback}"
            </p>
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-semibold text-gray-900 text-lg">
                  {testimonials[currentIndex].name}
                </h4>
                <p className="text-gray-600 text-sm">
                  {testimonials[currentIndex].location} • {testimonials[currentIndex].date}
                </p>
              </div>
            </div>
          </div>

          {/* Navigation Arrows */}
          <button
            onClick={prevTestimonial}
            className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 md:-translate-x-12 bg-white rounded-full p-3 shadow-lg hover:shadow-xl transition-all border border-gray-200"
            aria-label="Previous testimonial"
          >
            <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={nextTestimonial}
            className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 md:translate-x-12 bg-white rounded-full p-3 shadow-lg hover:shadow-xl transition-all border border-gray-200"
            aria-label="Next testimonial"
          >
            <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {/* Dots Indicator */}
          <div className="flex justify-center gap-2 mt-6">
            {testimonials.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentIndex(index)}
                className={`w-2 h-2 rounded-full transition-all ${
                  index === currentIndex ? 'bg-cyan-500 w-8' : 'bg-gray-300'
                }`}
                aria-label={`Go to testimonial ${index + 1}`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

export default TestimonialsSection

