import React from 'react'
import { specialityData } from '../assets/assets'
import { useNavigate } from 'react-router-dom'

const SpecialityMenu = () => {
    const navigate = useNavigate()

    const handleSpecialityClick = (speciality) => {
        navigate(`/hospitals?speciality=${encodeURIComponent(speciality)}`)
        window.scrollTo(0, 0)
    }

    return (
        <div id='speciality' className='flex flex-col items-center gap-3 sm:gap-4 py-8 sm:py-12 md:py-16 text-[#262626] px-4'>
            <h1 className='text-xl sm:text-2xl font-medium'>Find by Speciality</h1>
            <p className='sm:w-2/3 md:w-1/3 text-center text-xs sm:text-sm'>Simply browse through our extensive list of hospitals for specific specialties and book your appointments hassle-free.</p>
            <div className='grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4 sm:gap-6 md:gap-8 pt-3 sm:pt-5 w-full max-w-4xl justify-items-center'>
                {specialityData.map((item, index) => (
                    <div
                        onClick={() => handleSpecialityClick(item.speciality)}
                        className='flex flex-col items-center justify-center text-xs cursor-pointer transition-all duration-300 active:scale-90 group'
                        key={index}
                    >
                        <div className='mb-2 sm:mb-4 flex items-center justify-center'>
                            <img
                                className='w-16 h-16 sm:w-20 sm:h-20 transition-all duration-300 group-hover:scale-110 group-hover:drop-shadow-[0_0_15px_rgba(59,130,246,0.6)]'
                                src={item.image}
                                alt={item.speciality}
                            />
                        </div>
                        <p className='text-center text-[10px] sm:text-xs leading-tight transition-colors duration-300 group-hover:text-blue-600 font-medium'>{item.speciality}</p>
                    </div>
                ))}
            </div>
        </div>
    )
}

export default SpecialityMenu
