import React, { useState, useEffect } from 'react'
import { Button } from './ui/button'
import { CircleFadingArrowUp } from 'lucide-react'

const BackToTopButton = () => {
  const [showScrollTop, setShowScrollTop] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 300)
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div
      className={`fixed bottom-5 right-6 transition-all duration-500 ease-in-out hover:scale-110 ${showScrollTop
          ? 'opacity-100 translate-y-0 pointer-events-auto'
          : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
      style={{ zIndex: 999998 }}
    >
      <Button
        variant="outline"
        size="icon"
        onClick={scrollToTop}
        className="bg-white/80 backdrop-blur-md shadow-lg border-gray-200 text-primary hover:text-primary transition-all duration-300"
        title="Scroll to top"
        aria-label="Scroll to top"
      >
        <CircleFadingArrowUp className="w-6 h-6" />
      </Button>
    </div>
  )
}

export default BackToTopButton


