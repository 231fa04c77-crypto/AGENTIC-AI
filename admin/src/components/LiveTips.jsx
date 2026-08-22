import React, { useEffect, useMemo, useRef, useState } from 'react'

const LiveTips = () => {
  const tips = useMemo(() => [
    'Stay hydrated: aim for 8–10 glasses of water daily.',
    'Take a 2‑minute stretch break every hour to reduce stiffness.',
    'Practice the 20‑20‑20 rule to relax eye muscles.',
    'Prioritize sleep: target 7–9 hours for better recovery.',
    'Add colorful veggies to each meal for micronutrients.',
    'Deep breathe for 60s: in 4s, hold 4s, out 6s – repeat.',
    'Walk 5–10 minutes after meals to aid glucose control.',
    'Schedule routine checkups; prevention beats cure.',
    'Wash hands for 20s; it’s the simplest infection shield.',
    'Limit added sugar – read labels, aim for whole foods.'
  ], [])

  const [idx, setIdx] = useState(0)
  const timerRef = useRef(null)

  useEffect(() => {
    // rotate every 10s
    timerRef.current = setInterval(() => {
      setIdx((i) => (i + 1) % tips.length)
    }, 10000)
    return () => clearInterval(timerRef.current)
  }, [tips.length])

  return (
    <div className='fixed bottom-5 right-5 z-30'>
      <div className='relative w-[22rem] max-w-[85vw] p-[1px] rounded-2xl bg-gradient-to-r from-indigo-400 via-fuchsia-400 to-indigo-400 shadow-xl'>
        <div className='rounded-2xl bg-white/80 backdrop-blur-md p-4 pr-12'>
          <div className='flex items-center gap-2 mb-1'>
            <span className='inline-flex items-center justify-center w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white text-xs shadow'>
              ♥
            </span>
            <p className='text-sm font-semibold text-gray-800'>Live Health Tip</p>
          </div>
          <p className='text-sm text-gray-700 animate-fade-in'>{tips[idx]}</p>
          <span className='absolute top-3 right-3 text-[10px] text-gray-500'>updates every 10s</span>
        </div>
      </div>
      <style jsx>{`
        @keyframes fadeIn { from { opacity:0; transform: translateY(4px) } to { opacity:1; transform: translateY(0) } }
        .animate-fade-in { animation: fadeIn .4s ease both }
      `}</style>
    </div>
  )
}

export default LiveTips


