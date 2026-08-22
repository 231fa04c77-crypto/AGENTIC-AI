import React, { useEffect, useRef } from 'react'

const AnimatedBackground = () => {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    let animationFrameId
    let particles = []

    // Set canvas size
    const resizeCanvas = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)

    // Particle class
    class Particle {
      constructor() {
        this.x = Math.random() * canvas.width
        this.y = Math.random() * canvas.height
        this.size = Math.random() * 3 + 1
        this.speedX = Math.random() * 2 - 1
        this.speedY = Math.random() * 2 - 1
        this.opacity = Math.random() * 0.5 + 0.2
        this.hue = Math.random() * 60 + 180 // Cyan to blue range
      }

      update() {
        this.x += this.speedX
        this.y += this.speedY

        if (this.x < 0 || this.x > canvas.width) this.speedX *= -1
        if (this.y < 0 || this.y > canvas.height) this.speedY *= -1
      }

      draw() {
        ctx.beginPath()
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2)
        ctx.fillStyle = `hsla(${this.hue}, 70%, 60%, ${this.opacity})`
        ctx.fill()
      }
    }

    // Create particles
    const particleCount = Math.min(50, Math.floor((canvas.width * canvas.height) / 15000))
    for (let i = 0; i < particleCount; i++) {
      particles.push(new Particle())
    }

    // Animation loop
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // Draw connections
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x
          const dy = particles[i].y - particles[j].y
          const distance = Math.sqrt(dx * dx + dy * dy)

          if (distance < 150) {
            ctx.beginPath()
            ctx.strokeStyle = `rgba(14, 165, 233, ${0.2 * (1 - distance / 150)})`
            ctx.lineWidth = 1
            ctx.moveTo(particles[i].x, particles[i].y)
            ctx.lineTo(particles[j].x, particles[j].y)
            ctx.stroke()
          }
        }
      }

      // Update and draw particles
      particles.forEach(particle => {
        particle.update()
        particle.draw()
      })

      animationFrameId = requestAnimationFrame(animate)
    }

    animate()

    return () => {
      window.removeEventListener('resize', resizeCanvas)
      cancelAnimationFrame(animationFrameId)
    }
  }, [])

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden">
      {/* Gradient Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-cyan-50 to-purple-50"></div>
      
      {/* Animated Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-cyan-400/10 via-blue-400/10 to-purple-400/10 animate-gradient-shift"></div>
      
      {/* Particle Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 opacity-60"
        style={{ mixBlendMode: 'multiply' }}
      ></canvas>

      {/* Floating Shapes */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-cyan-300/20 rounded-full blur-3xl animate-float-1"></div>
        <div className="absolute top-40 right-20 w-96 h-96 bg-blue-300/20 rounded-full blur-3xl animate-float-2"></div>
        <div className="absolute bottom-20 left-1/4 w-80 h-80 bg-purple-300/20 rounded-full blur-3xl animate-float-3"></div>
        <div className="absolute bottom-40 right-1/3 w-64 h-64 bg-pink-300/20 rounded-full blur-3xl animate-float-4"></div>
      </div>

      {/* Animated Grid Pattern */}
      <div 
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(14, 165, 233, 0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(14, 165, 233, 0.1) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px',
          animation: 'grid-move 20s linear infinite'
        }}
      ></div>

      {/* CSS Animations */}
      <style>{`
        @keyframes gradient-shift {
          0%, 100% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
        }

        @keyframes float-1 {
          0%, 100% {
            transform: translate(0, 0) scale(1);
          }
          33% {
            transform: translate(30px, -30px) scale(1.1);
          }
          66% {
            transform: translate(-20px, 20px) scale(0.9);
          }
        }

        @keyframes float-2 {
          0%, 100% {
            transform: translate(0, 0) scale(1);
          }
          33% {
            transform: translate(-40px, 40px) scale(0.95);
          }
          66% {
            transform: translate(30px, -20px) scale(1.05);
          }
        }

        @keyframes float-3 {
          0%, 100% {
            transform: translate(0, 0) scale(1);
          }
          50% {
            transform: translate(25px, -25px) scale(1.08);
          }
        }

        @keyframes float-4 {
          0%, 100% {
            transform: translate(0, 0) scale(1);
          }
          50% {
            transform: translate(-30px, 30px) scale(0.92);
          }
        }

        @keyframes grid-move {
          0% {
            transform: translate(0, 0);
          }
          100% {
            transform: translate(50px, 50px);
          }
        }

        .animate-gradient-shift {
          animation: gradient-shift 8s ease infinite;
          background-size: 200% 200%;
        }

        .animate-float-1 {
          animation: float-1 15s ease-in-out infinite;
        }

        .animate-float-2 {
          animation: float-2 18s ease-in-out infinite;
          animation-delay: -5s;
        }

        .animate-float-3 {
          animation: float-3 20s ease-in-out infinite;
          animation-delay: -10s;
        }

        .animate-float-4 {
          animation: float-4 16s ease-in-out infinite;
          animation-delay: -7s;
        }
      `}</style>
    </div>
  )
}

export default AnimatedBackground

