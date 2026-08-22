import React from 'react'

const StatusIndicator = ({ status, size = 'md', showLabel = true }) => {
  const statusConfig = {
    online: {
      color: 'bg-green-500',
      ring: 'ring-green-500/30',
      label: 'Online',
      pulse: true
    },
    offline: {
      color: 'bg-gray-400',
      ring: 'ring-gray-400/30',
      label: 'Offline',
      pulse: false
    },
    busy: {
      color: 'bg-red-500',
      ring: 'ring-red-500/30',
      label: 'Busy',
      pulse: true
    },
    available: {
      color: 'bg-blue-500',
      ring: 'ring-blue-500/30',
      label: 'Available',
      pulse: true
    }
  }

  const config = statusConfig[status] || statusConfig.offline
  const sizeClasses = {
    sm: 'w-2 h-2',
    md: 'w-3 h-3',
    lg: 'w-4 h-4'
  }

  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <div
          className={`
            ${sizeClasses[size]} 
            ${config.color} 
            rounded-full 
            ${config.pulse ? 'animate-pulse' : ''}
          `}
        />
        {config.pulse && (
          <div
            className={`
              absolute inset-0 
              ${sizeClasses[size]} 
              ${config.color} 
              rounded-full 
              ${config.ring}
              animate-ping
            `}
          />
        )}
      </div>
      {showLabel && (
        <span className="text-xs font-medium text-gray-600">{config.label}</span>
      )}
    </div>
  )
}

export default StatusIndicator

