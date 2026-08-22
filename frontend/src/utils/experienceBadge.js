// Utility function to get experience badge based on years of experience
export const getExperienceBadge = (experience) => {
    let years = 0
    
    // Extract number from experience (handles string like "9 Years" or number)
    if (typeof experience === 'string') {
        const match = experience.match(/\d+/)
        years = match ? parseInt(match[0]) : 0
    } else if (typeof experience === 'number') {
        years = experience
    } else {
        years = parseInt(experience) || 0
    }
    
    // Different badge styles based on experience ranges
    if (years >= 15) {
        // Master/Platinum - 15+ years
        return {
            emoji: '💎',
            label: 'Master',
            color: 'text-purple-700',
            bg: 'bg-gradient-to-r from-purple-100 via-indigo-50 to-purple-100',
            border: 'border-purple-400',
            iconBg: 'bg-purple-500',
            shadow: 'shadow-purple-200'
        }
    } else if (years >= 10) {
        // Expert/Gold - 10-14 years
        return {
            emoji: '🥇',
            label: 'Expert',
            color: 'text-yellow-700',
            bg: 'bg-gradient-to-r from-yellow-100 via-amber-50 to-yellow-100',
            border: 'border-yellow-400',
            iconBg: 'bg-yellow-500',
            shadow: 'shadow-yellow-200'
        }
    } else if (years >= 6) {
        // Senior - 6-9 years
        return {
            emoji: '🥈',
            label: 'Senior',
            color: 'text-orange-700',
            bg: 'bg-gradient-to-r from-orange-100 via-amber-50 to-orange-100',
            border: 'border-orange-400',
            iconBg: 'bg-orange-500',
            shadow: 'shadow-orange-200'
        }
    } else if (years >= 3) {
        // Professional - 3-5 years
        return {
            emoji: '⭐',
            label: 'Professional',
            color: 'text-green-700',
            bg: 'bg-gradient-to-r from-green-100 via-emerald-50 to-green-100',
            border: 'border-green-400',
            iconBg: 'bg-green-500',
            shadow: 'shadow-green-200'
        }
    } else {
        // Junior/Beginner - 0-2 years
        return {
            emoji: '🌱',
            label: 'Junior',
            color: 'text-blue-700',
            bg: 'bg-gradient-to-r from-blue-100 via-cyan-50 to-blue-100',
            border: 'border-blue-400',
            iconBg: 'bg-blue-500',
            shadow: 'shadow-blue-200'
        }
    }
}

