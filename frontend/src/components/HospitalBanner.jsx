import React, { useState, useEffect } from 'react'
import { assets } from '../assets/assets'

const HospitalBanner = () => {
    const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })

    useEffect(() => {
        const handleMouseMove = (e) => {
            setMousePosition({
                x: (e.clientX / window.innerWidth - 0.5) * 20,
                y: (e.clientY / window.innerHeight - 0.5) * 20
            })
        }

        window.addEventListener('mousemove', handleMouseMove)
        return () => window.removeEventListener('mousemove', handleMouseMove)
    }, [])

    return (
        <div className='relative bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 rounded-xl sm:rounded-2xl px-4 sm:px-6 md:px-10 lg:px-16 mb-4 sm:mb-6 md:mb-8 overflow-hidden group'>
            {/* Animated background elements */}
            <div className="absolute inset-0 overflow-hidden">
                {[...Array(12)].map((_, i) => (
                    <div
                        key={i}
                        className="absolute w-2 h-2 bg-white/10 rounded-full animate-float"
                        style={{
                            left: `${Math.random() * 100}%`,
                            top: `${Math.random() * 100}%`,
                            animationDelay: `${i * 0.5}s`,
                            animationDuration: `${5 + Math.random() * 10}s`
                        }}
                    />
                ))}
            </div>

            {/* Subtle gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-indigo-500/10 opacity-50 group-hover:opacity-70 transition-opacity duration-700"></div>

            {/* Grid pattern background */}
            <div className="absolute inset-0 opacity-10">
                <div className="absolute inset-0 bg-grid-pattern bg-center bg-cover"></div>
            </div>

            <div className='relative z-10 flex flex-col lg:flex-row items-center'>
                {/* ------- Left Content ------- */}
                <div className='flex-1 py-4 sm:py-6 md:py-8 lg:py-10 transform transition-transform duration-700 text-center lg:text-left'
                    style={{
                        transform: `translate(${mousePosition.x * 0.3}px, ${mousePosition.y * 0.3}px)`
                    }}
                >
                    <div className='text-xl sm:text-2xl md:text-3xl lg:text-4xl xl:text-5xl font-bold text-white mb-4 sm:mb-5 md:mb-6'>
                        <h1 className='mb-2 sm:mb-3 leading-tight'>
                            <span className='text-white'>Collaborated</span>
                            <br />
                            <span className='bg-gradient-to-r from-cyan-300 to-blue-200 bg-clip-text text-transparent drop-shadow-md'>
                                Medical
                            </span>
                            <br />
                            <span className='text-white'>Institutions</span>
                        </h1>
                    </div>

                    <p className='text-blue-100 text-sm sm:text-base md:text-lg max-w-xl leading-relaxed mb-4 sm:mb-5 md:mb-6 mx-auto lg:mx-0'>
                        Precision healthcare delivery through our premium institutional network.
                    </p>
                </div>

                {/* ------- Right Image ------- */}
                <div className='w-full lg:w-1/2 relative mt-6 sm:mt-8 lg:mt-0 lg:pl-12'
                    style={{
                        transform: `translate(${mousePosition.x * 0.2}px, ${mousePosition.y * 0.2}px)`
                    }}
                >
                    <div className="relative w-full h-full flex justify-center items-center">
                        <img
                            className='w-full max-w-[280px] sm:max-w-sm md:max-w-md lg:max-w-xl xl:max-w-2xl max-h-[250px] sm:max-h-[300px] md:max-h-[350px] lg:max-h-[400px] transform transition-transform duration-1000 group-hover:scale-105'
                            src={assets.appointment_img}
                            alt="Medical professionals"
                            style={{
                                objectFit: 'contain'
                            }}
                        />

                        {/* Floating medical badges - responsive sizing */}
                        <div className='absolute top-4 sm:top-8 lg:top-12 -left-2 sm:-left-4 lg:-left-6 w-12 h-12 sm:w-16 sm:h-16 lg:w-20 lg:h-20 rounded-xl lg:rounded-2xl bg-blue-400/20 backdrop-blur-sm border border-blue-300/30 animate-float flex items-center justify-center shadow-lg'>
                            <span className="text-blue-300 text-xl sm:text-2xl lg:text-3xl">❤️</span>
                        </div>
                        <div className='absolute bottom-16 sm:bottom-20 lg:bottom-24 -right-2 sm:-right-4 lg:-right-6 w-12 h-12 sm:w-14 sm:h-14 lg:w-18 lg:h-18 rounded-xl lg:rounded-2xl bg-green-400/20 backdrop-blur-sm border border-green-300/30 animate-float flex items-center justify-center shadow-lg' style={{ animationDelay: '1s' }}>
                            <span className="text-green-300 text-lg sm:text-xl lg:text-2xl">🩺</span>
                        </div>
                        <div className='absolute top-1/2 -left-3 sm:-left-4 lg:-left-8 w-10 h-10 sm:w-12 sm:h-12 lg:w-16 lg:h-16 rounded-xl lg:rounded-2xl bg-purple-400/20 backdrop-blur-sm border border-purple-300/30 animate-float flex items-center justify-center shadow-lg' style={{ animationDelay: '2s' }}>
                            <span className="text-purple-300 text-base sm:text-lg lg:text-xl">💊</span>
                        </div>
                        <div className='absolute bottom-6 sm:bottom-8 lg:bottom-12 right-6 sm:right-8 lg:right-12 w-10 h-10 sm:w-12 sm:h-12 lg:w-14 lg:h-14 rounded-xl lg:rounded-2xl bg-yellow-400/20 backdrop-blur-sm border border-yellow-300/30 animate-float flex items-center justify-center shadow-lg' style={{ animationDelay: '1.5s' }}>
                            <span className="text-yellow-300 text-sm sm:text-base lg:text-lg">🏥</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Decorative corner elements */}
            <div className="absolute top-4 left-4 w-8 h-8 border-t-2 border-l-2 border-white/20"></div>
            <div className="absolute top-4 right-4 w-8 h-8 border-t-2 border-r-2 border-white/20"></div>
            <div className="absolute bottom-4 left-4 w-8 h-8 border-b-2 border-l-2 border-white/20"></div>
            <div className="absolute bottom-4 right-4 w-8 h-8 border-b-2 border-r-2 border-white/20"></div>

            <style>{`
                @keyframes float {
                    0%, 100% { transform: translateY(0) rotate(0deg); }
                    50% { transform: translateY(-15px) rotate(5deg); }
                }
                
                .animate-float {
                    animation: float 6s ease-in-out infinite;
                }
                
                .bg-grid-pattern {
                    background-image: url("data:image/svg+xml,%3csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3e%3cpath d='M0 0h100v100H0z' fill='none'/%3e%3cpath d='M0 0v100M20 0v100M40 0v100M60 0v100M80 0v100M100 0v100 M0 0h100M0 20h100M0 40h100M0 60h100M0 80h100M0 100h100' stroke='%23FFFFFF' stroke-width='0.5' stroke-opacity='0.2' fill='none'/%3e%3c/svg%3e");
                }
            `}</style>
        </div>
    )
}

export default HospitalBanner
