import React from 'react'
import { useNavigate } from 'react-router-dom'
import { assets } from '../assets/assets'

const Header = () => {
    const navigate = useNavigate()

    return (
        <div className='flex flex-col md:flex-row flex-wrap bg-primary rounded-2xl px-6 md:px-10 lg:px-16 mx-2 sm:mx-4 relative z-[1] overflow-visible mt-8'>

            {/* --------- Header Left --------- */}
            <div className='md:w-1/2 flex flex-col items-start justify-center gap-4 py-10 md:py-14 lg:py-20'>
                <p className='text-2xl md:text-3xl lg:text-4xl text-white font-semibold leading-tight md:leading-tight lg:leading-tight'>
                    Book Appointment <br />  With Trusted Doctors
                </p>
                <div className='flex flex-col md:flex-row items-center gap-3 text-white text-sm font-light'>
                    <img className='w-24' src={assets.group_profiles} alt="" />
                    <p className='text-sm'>
                        Simply browse through our extensive list of trusted doctors, <br className='hidden sm:block' /> schedule your in-clinic appointment hassle-free.
                    </p>
                </div>

                {/* CTA Buttons Section */}
                <div className='flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mt-2 w-full sm:w-auto'>
                    {/* Primary CTA: Book Appointment (Doctors) */}
                    <button
                        onClick={() => navigate('/hospitals')}
                        className='flex items-center justify-center gap-2 bg-white px-6 py-2.5 rounded-full text-[#595959] text-sm font-medium hover:scale-105 transition-all duration-300 cursor-pointer shadow-md'
                    >
                        Book Appointment <img className='w-3' src={assets.arrow_icon} alt="" />
                    </button>
                </div>
            </div>

            {/* --------- Header Right --------- */}
            <div className='md:w-1/2 relative flex items-end justify-center md:justify-end'>
                <img
                    className='w-full max-w-sm md:max-w-md lg:max-w-lg h-auto object-contain'
                    src={assets.header_img}
                    alt="Doctors"
                    style={{ marginBottom: '-1px' }}
                />
            </div>
        </div>
    )
}

export default Header
