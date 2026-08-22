import React, { useState, useEffect } from 'react'
import { getSymptomsForSpecialization } from '../data/specializationSymptoms'

/**
 * SymptomsBySpecialization Component
 * Displays symptoms based ONLY on doctor's specialization
 * NO age selection required
 */

const SymptomsBySpecialization = ({ 
    doctorSpecialization,
    doctorName = '',
    onSymptomsChange,
    selectedSymptoms: externalSelectedSymptoms = [],
    isLoading = false
}) => {
    const [selectedSymptoms, setSelectedSymptoms] = useState(externalSelectedSymptoms || [])
    const [availableSymptoms, setAvailableSymptoms] = useState([])

    // Load symptoms when doctor specialization changes
    useEffect(() => {
        if (doctorSpecialization) {
            const symptoms = getSymptomsForSpecialization(doctorSpecialization)
            setAvailableSymptoms(symptoms)
        } else {
            setAvailableSymptoms([])
        }
        
        // Reset selections when doctor changes
        setSelectedSymptoms([])
        if (onSymptomsChange) {
            onSymptomsChange([])
        }
    }, [doctorSpecialization, doctorName])

    // Sync external state changes
    useEffect(() => {
        setSelectedSymptoms(externalSelectedSymptoms)
    }, [externalSelectedSymptoms])

    // Handle symptom selection
    const handleSymptomToggle = (symptom) => {
        let updatedSymptoms
        if (selectedSymptoms.includes(symptom)) {
            // Deselect symptom
            updatedSymptoms = selectedSymptoms.filter(s => s !== symptom)
        } else {
            // Select symptom
            updatedSymptoms = [...selectedSymptoms, symptom]
        }
        setSelectedSymptoms(updatedSymptoms)
        if (onSymptomsChange) {
            onSymptomsChange(updatedSymptoms)
        }
    }

    // Show loading state
    if (isLoading) {
        return (
            <div className="w-full">
                <div className="mb-4">
                    <h3 className="text-sm font-semibold text-gray-700 mb-1 flex items-center gap-2">
                        <svg className="w-4 h-4 text-cyan-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Select Your Symptoms
                    </h3>
                    <p className="text-xs text-gray-500">Loading symptoms...</p>
                </div>
                <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                </div>
            </div>
        )
    }

    // If no symptoms available
    if (!availableSymptoms || availableSymptoms.length === 0) {
        return null
    }

    return (
        <div className="w-full">
            {/* Title */}
            <div className="mb-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-1 flex items-center gap-2">
                    <svg className="w-4 h-4 text-cyan-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Select Your Symptoms
                </h3>
                <p className="text-xs text-gray-500">
                    Choose symptoms relevant to {doctorSpecialization || 'your condition'}
                </p>
            </div>

            {/* Symptoms Display */}
            <div className="mb-4">
                <h4 className="text-xs font-semibold text-gray-600 mb-3">
                    {selectedSymptoms.length > 0 
                        ? `${selectedSymptoms.length} symptom${selectedSymptoms.length > 1 ? 's' : ''} selected`
                        : 'Select your symptoms:'}
                </h4>
                <div className="flex flex-wrap gap-2">
                    {availableSymptoms.map((symptom, index) => {
                        const isSelected = selectedSymptoms.includes(symptom)
                        return (
                            <button
                                key={index}
                                onClick={() => handleSymptomToggle(symptom)}
                                className={`px-4 py-2 rounded-full text-xs sm:text-sm font-medium transition-all duration-300 transform ${
                                    isSelected
                                        ? 'bg-blue-600 text-white shadow-md scale-105 border-2 border-blue-700'
                                        : 'bg-blue-50 text-blue-700 border-2 border-blue-200 hover:bg-blue-100 hover:border-blue-300 hover:scale-105'
                                }`}
                            >
                                {isSelected && (
                                    <span className="mr-1.5">✓</span>
                                )}
                                {symptom}
                            </button>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}

export default SymptomsBySpecialization

