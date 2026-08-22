import React from 'react'
import { useNavigate } from 'react-router-dom'
import { assets } from '../assets/assets'

/**
 * BrandLogo — MedClues banner (logo1.png)
 * Wide wordmark; sized by height so the mark stays readable in the header.
 */
const BrandLogo = ({
  size = 'medium',
  clickable = true,
  className = '',
  variant = 'header',
}) => {
  const navigate = useNavigate()

  const sizeMap = {
    small: 'h-10',
    medium: 'h-12',
    large: 'h-14',
    mobile: 'h-9',
    sidebar: 'h-11',
  }

  const maxHeights = {
    header: 56,
    sidebar: 44,
  }

  const maxWidths = {
    header: 'min(420px,55vw)',
    sidebar: '200px',
  }

  const heightClass =
    typeof size === 'string' && sizeMap[size]
      ? sizeMap[size]
      : `h-[${size}px]`

  const handleClick = () => {
    if (!clickable) return
    const currentPath = window.location.pathname
    if (currentPath.includes('/doctor')) {
      navigate('/doctor-dashboard')
    } else if (currentPath.includes('/reception')) {
      navigate('/reception-dashboard')
    } else if (currentPath.includes('/dean')) {
      navigate('/dean-dashboard')
    } else {
      navigate('/admin-dashboard')
    }
  }

  return (
    <div className={`flex items-center shrink-0 ${className}`}>
      <img
        src={assets.logo}
        alt='MedClues'
        className={`
          ${heightClass}
          w-auto
          object-contain object-left
          block
          ${variant === 'header' ? 'animate-fade-in' : ''}
          ${clickable ? 'cursor-pointer' : ''}
        `}
        onClick={handleClick}
        style={{
          maxHeight: maxHeights[variant] || 56,
          maxWidth: maxWidths[variant] || maxWidths.header,
          imageRendering: 'auto',
        }}
        onError={(e) => {
          console.error('Logo failed to load:', assets.logo)
          e.target.style.display = 'none'
        }}
      />
    </div>
  )
}

export default BrandLogo
