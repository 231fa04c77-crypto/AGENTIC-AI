import React, { useState, useEffect, useRef } from 'react'

const TrustMetricsSection = () => {
  const [isVisible, setIsVisible] = useState(false)
  const sectionRef = useRef(null)

  const metrics = [
    { value: 200000, suffix: '+', label: 'Happy Users', icon: '👥' },
    { value: 20000, suffix: '+', label: 'Verified Doctors', icon: '👨‍⚕️' },
    { value: 25, suffix: '+', label: 'Specialities', icon: '🏥' },
    { value: 4.5, suffix: '/5', label: 'App Rating', icon: '⭐' }
  ]

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
        }
      },
      { threshold: 0.3 }
    )

    if (sectionRef.current) {
      observer.observe(sectionRef.current)
    }

    return () => {
      if (sectionRef.current) {
        observer.unobserve(sectionRef.current)
      }
    }
  }, [])

  const AnimatedCounter = ({ endValue, suffix, duration = 2000 }) => {
    const [count, setCount] = useState(0)
    const isDecimal = endValue % 1 !== 0

    useEffect(() => {
      if (!isVisible) return

      let startTime = null
      const animate = (currentTime) => {
        if (!startTime) startTime = currentTime
        const progress = Math.min((currentTime - startTime) / duration, 1)
        
        if (isDecimal) {
          setCount(Number((endValue * progress).toFixed(1)))
        } else {
          setCount(Math.floor(endValue * progress))
        }

        if (progress < 1) {
          requestAnimationFrame(animate)
        } else {
          if (isDecimal) {
            setCount(endValue)
          } else {
            setCount(endValue)
          }
        }
      }
      requestAnimationFrame(animate)
    }, [isVisible, endValue, duration, isDecimal])

    return (
      <span>
        {isDecimal ? count.toFixed(1) : count.toLocaleString('en-IN')}
        {suffix}
      </span>
    )
  }

  return (
    <section ref={sectionRef} className="py-12 bg-gradient-to-r from-gray-900 to-gray-800 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {metrics.map((metric, index) => (
            <div key={index} className="text-center">
              <div className="text-4xl mb-2">{metric.icon}</div>
              <div className="text-4xl md:text-5xl font-bold mb-2 text-cyan-400">
                {isVisible ? (
                  <AnimatedCounter endValue={metric.value} suffix={metric.suffix} />
                ) : (
                  '0'
                )}
              </div>
              <div className="text-gray-300 text-sm md:text-base font-medium">
                {metric.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default TrustMetricsSection

