import React from 'react'
import { useNavigate } from 'react-router-dom'
import { assets } from '../assets/assets'

/**
 * BrandLogo Component
 * Reusable component for displaying the official MedClues logo
 * 
 * @param {Object} props
 * @param {string} props.size - Size variant: 'small' (32px), 'medium' (42px), 'large' (48px), or custom height
 * @param {boolean} props.clickable - Whether the logo should be clickable (navigate to home)
 * @param {string} props.className - Additional CSS classes
 * @param {string} props.variant - Variant: 'header' (for headers) or 'sidebar' (for sidebars)
 */
const BrandLogo = ({
  size = 'medium',
  clickable = true,
  className = '',
  variant = 'header'
}) => {
  const navigate = useNavigate()

  // Size mapping
  const sizeMap = {
    small: 'h-8',      // 32px
    medium: 'h-[42px]', // 42px (desktop header)
    large: 'h-12',     // 48px (sidebar)
    mobile: 'h-7'      // 28px (mobile)
  }

  // Get height class based on size prop
  const heightClass = typeof size === 'string' && sizeMap[size]
    ? sizeMap[size]
    : size === 'mobile'
      ? 'h-7 sm:h-[42px]' // Responsive for mobile
      : `h-[${size}px]`

  // Base classes
  const baseClasses = `
    w-auto
    object-contain
    transition-all duration-300
    ${variant === 'header' ? 'animate-fade-in' : ''}
    ${clickable ? 'cursor-pointer hover:scale-105' : ''}
    ${className}
  `

  // Handle click
  const handleClick = () => {
    if (clickable) {
      navigate('/')
    }
  }

  return (
    <img
      src={assets.logo}
      alt="MedClues Logo"
      className={`${heightClass} ${baseClasses}`}
      onClick={handleClick}
      style={{
        maxHeight: variant === 'header' ? '42px' : variant === 'sidebar' ? '48px' : 'auto',
        imageRendering: 'auto'
      }}
    />
  )
}

export default BrandLogo

