import React from 'react'

const LoadingSpinner = ({ 
  size = 'default', 
  text = 'Loading...', 
  fullScreen = false,
  showText = true 
}) => {
  const sizeClasses = {
    small: 'spinner-sm',
    default: '',
    large: 'spinner-lg'
  }

  if (fullScreen) {
    return (
      <div className="loading-overlay">
        <div className="flex flex-col items-center gap-4">
          {/* Animated Medical Cross */}
          <div className="relative">
            <div className={`spinner ${sizeClasses[size]}`}></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <svg 
                className="w-5 h-5 text-cyan-500" 
                fill="currentColor" 
                viewBox="0 0 24 24"
              >
                <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"/>
              </svg>
            </div>
          </div>
          {showText && (
            <p className="loading-text">{text}</p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="loading-container">
      <div className="relative">
        <div className={`spinner ${sizeClasses[size]}`}></div>
        <div className="absolute inset-0 flex items-center justify-center">
          <svg 
            className="w-4 h-4 text-cyan-500" 
            fill="currentColor" 
            viewBox="0 0 24 24"
          >
            <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"/>
          </svg>
        </div>
      </div>
      {showText && (
        <p className="loading-text">{text}</p>
      )}
    </div>
  )
}

// Inline loading spinner for buttons
export const ButtonSpinner = () => (
  <svg 
    className="animate-spin h-5 w-5 text-current" 
    xmlns="http://www.w3.org/2000/svg" 
    fill="none" 
    viewBox="0 0 24 24"
  >
    <circle 
      className="opacity-25" 
      cx="12" 
      cy="12" 
      r="10" 
      stroke="currentColor" 
      strokeWidth="4"
    />
    <path 
      className="opacity-75" 
      fill="currentColor" 
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
    />
  </svg>
)

// Skeleton loader for cards
export const SkeletonCard = () => (
  <div className="card animate-pulse">
    <div className="skeleton h-48 rounded-t-xl"></div>
    <div className="card-body space-y-3">
      <div className="skeleton skeleton-title"></div>
      <div className="skeleton skeleton-text w-3/4"></div>
      <div className="skeleton skeleton-text w-1/2"></div>
    </div>
  </div>
)

// Skeleton loader for appointment cards
export const SkeletonAppointment = () => (
  <div className="appointment-card animate-pulse">
    <div className="skeleton w-full sm:w-36 h-40"></div>
    <div className="appointment-card-content">
      <div className="skeleton skeleton-title"></div>
      <div className="skeleton skeleton-text"></div>
      <div className="skeleton skeleton-text w-3/4"></div>
      <div className="skeleton skeleton-text w-1/2"></div>
    </div>
  </div>
)

// Pulse dots loading animation
export const LoadingDots = () => (
  <div className="loading-pulse">
    <span></span>
    <span></span>
    <span></span>
  </div>
)

export default LoadingSpinner

