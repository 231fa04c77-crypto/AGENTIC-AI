import React from 'react'

const BackgroundFX = () => {
  return (
    <div aria-hidden className='fixed inset-0 -z-20 overflow-hidden'>
      {/* gradient mesh */}
      <div className='absolute inset-0 opacity-90' style={{
        backgroundImage:
          'radial-gradient(60% 60% at 15% 10%, rgba(56,189,248,0.25) 0%, rgba(56,189,248,0) 60%),\
           radial-gradient(50% 50% at 85% 15%, rgba(168,85,247,0.25) 0%, rgba(168,85,247,0) 60%),\
           radial-gradient(40% 40% at 50% 85%, rgba(99,102,241,0.25) 0%, rgba(99,102,241,0) 60%)'
      }} />

      {/* animated aurora */}
      <div className='absolute inset-0 opacity-50 bg-[length:220%_220%] animate-bg-pan'
        style={{ backgroundImage: 'linear-gradient(120deg, rgba(56,189,248,.12), rgba(168,85,247,.12), rgba(99,102,241,.12))' }} />

      {/* grid + noise overlay */}
      <div className='absolute inset-0 mix-blend-overlay opacity-[0.12]' style={{
        backgroundImage:
          'linear-gradient(rgba(255,255,255,.12) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.12) 1px, transparent 1px)',
        backgroundSize: '44px 44px'
      }} />

      {/* floating orbs (auto scales on screens) */}
      <div className='pointer-events-none absolute inset-0'>
        {[...Array(14)].map((_, i) => (
          <span key={i}
            className='absolute w-64 h-64 md:w-80 md:h-80 rounded-full blur-3xl opacity-35 animate-orb'
            style={{
              background: i % 2 === 0 ? 'radial-gradient(circle at 30% 30%, rgba(56,189,248,.45), transparent 60%)' : 'radial-gradient(circle at 70% 70%, rgba(168,85,247,.45), transparent 60%)',
              left: `${(i * 63) % 100}%`,
              top: `${(i * 37) % 100}%`,
              animationDelay: `${i * 0.8}s`,
              animationDuration: `${18 + (i % 6)}s`
            }} />
        ))}
      </div>

      <style jsx>{`
        @keyframes bgPan { 0% { background-position: 0% 0% } 50% { background-position: 100% 100% } 100% { background-position: 0% 0% } }
        .animate-bg-pan { animation: bgPan 28s ease-in-out infinite }
        @keyframes orb { 0%,100% { transform: translate3d(0,0,0) } 50% { transform: translate3d(8px,-12px,0) } }
        .animate-orb { animation: orb 22s ease-in-out infinite }
      `}</style>
    </div>
  )
}

export default BackgroundFX


