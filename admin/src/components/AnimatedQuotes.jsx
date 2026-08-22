import React, { useEffect, useMemo, useRef, useState } from 'react'

const AnimatedQuotes = () => {
  const quotes = useMemo(() => [
    'Health is a journey—small steps, every day.',
    'Move your body daily; your mind will thank you.',
    'Food is fuel—color your plate for energy.',
    'Breathe deeply; calm is a superpower.',
    'Sleep well—recovery is part of training.'
  ], [])

  const [i, setI] = useState(0)
  const timer = useRef(null)

  useEffect(() => {
    timer.current = setInterval(() => setI(v => (v + 1) % quotes.length), 8000)
    return () => clearInterval(timer.current)
  }, [quotes.length])

  return (
    <div className='pointer-events-none fixed inset-0 flex items-center justify-center z-[5]'>
      <div className='hidden md:block px-6 py-4 rounded-2xl backdrop-blur-md bg-white/50 shadow-lg ring-1 ring-black/5 animate-quote-in'>
        <p className='text-xl font-semibold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 via-fuchsia-600 to-purple-600 text-center whitespace-pre-wrap max-w-3xl'>
          {quotes[i]}
        </p>
      </div>
      <style jsx>{`
        @keyframes quoteIn { 0% { opacity: 0; transform: translateY(6px) } 100% { opacity: 1; transform: translateY(0) } }
        .animate-quote-in { animation: quoteIn .6s ease both }
      `}</style>
    </div>
  )
}

export default AnimatedQuotes


