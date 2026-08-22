import React, { useState, useEffect } from 'react'

/**
 * SymptomsByAge Component - Doctor-Specific Age & Symptom Recommendations
 * 
 * Features:
 * - Horizontal scrollable bar layout with doctor-specific age groups
 * - Dynamic age-to-symptoms mapping based on selected doctor
 * - Selectable symptom pills
 * - Smooth animations
 * - Medical blue theme
 */

const SymptomsByAge = ({ 
    onSymptomsChange, 
    onAgeGroupChange, 
    selectedSymptoms: externalSelectedSymptoms = [], 
    selectedAgeGroup: externalSelectedAgeGroup = null,
    // Doctor-specific data
    supportedAgeGroups = [],
    ageSymptomsMap = {},
    doctorName = '',
    isLoading = false,
    // New prop: Hide age selection for doctor users
    isUserDoctor = false
}) => {
    const [selectedAgeGroup, setSelectedAgeGroup] = useState(externalSelectedAgeGroup)
    const [selectedSymptoms, setSelectedSymptoms] = useState(externalSelectedSymptoms || [])

    // Reset selections when doctor changes
    useEffect(() => {
        setSelectedAgeGroup(null)
        setSelectedSymptoms([])
        if (onSymptomsChange) {
            onSymptomsChange([])
        }
        if (onAgeGroupChange) {
            onAgeGroupChange(null)
        }
    }, [supportedAgeGroups.length, doctorName])

    // Sync external state changes
    useEffect(() => {
        setSelectedAgeGroup(externalSelectedAgeGroup)
    }, [externalSelectedAgeGroup])

    useEffect(() => {
        setSelectedSymptoms(externalSelectedSymptoms)
    }, [externalSelectedSymptoms])

    // Handle age group selection
    const handleAgeGroupSelect = (ageGroupId) => {
        if (selectedAgeGroup === ageGroupId) {
            // Deselect if already selected
            setSelectedAgeGroup(null)
            setSelectedSymptoms([])
            if (onSymptomsChange) {
                onSymptomsChange([])
            }
            if (onAgeGroupChange) {
                onAgeGroupChange(null)
            }
        } else {
            // Select new age group
            setSelectedAgeGroup(ageGroupId)
            setSelectedSymptoms([]) // Clear previous selections
            if (onSymptomsChange) {
                onSymptomsChange([])
            }
            if (onAgeGroupChange) {
                onAgeGroupChange(ageGroupId)
            }
        }
    }

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

    // Get symptoms for selected age group from doctor-specific map
    // For doctor users: show ALL symptoms from ALL age groups
    const availableSymptoms = isUserDoctor
        ? (() => {
            // Combine all symptoms from all age groups
            const allSymptoms = Object.values(ageSymptomsMap).flat()
            // Remove duplicates
            return [...new Set(allSymptoms)]
          })()
        : (selectedAgeGroup && ageSymptomsMap[selectedAgeGroup] 
            ? ageSymptomsMap[selectedAgeGroup] 
            : [])

    // Format age group labels (e.g., '0-12' -> '0–12', '13-25' -> '13–25')
    const formatAgeLabel = (ageId) => {
        return ageId.replace('-', '–')
    }

    // Get age group caption based on age range
    const getAgeCaption = (ageId) => {
        const ageMap = {
            '0-12': 'Child',
            '13-18': 'Teen',
            '13-25': 'Teen',
            '18-30': 'Young Adult',
            '19-30': 'Young Adult',
            '26-35': 'Young Adult',
            '31-45': 'Adult',
            '36-45': 'Adult',
            '46-60': 'Middle Age',
            '60+': 'Senior'
        }
        return ageMap[ageId] || ageId
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
                        Select Your Age Group & Symptoms
                    </h3>
                    <p className="text-xs text-gray-500">Loading doctor-specific recommendations...</p>
                </div>
                <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                </div>
            </div>
        )
    }

    // Show loading state while fetching doctor data
    if (isLoading) {
        return (
            <div className="w-full">
                <div className="mb-4">
                    <h3 className="text-sm font-semibold text-gray-700 mb-1 flex items-center gap-2">
                        <svg className="w-4 h-4 text-cyan-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Select Your Age Group & Symptoms
                    </h3>
                    <p className="text-xs text-gray-500">Loading doctor-specific recommendations...</p>
                </div>
                <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                </div>
            </div>
        )
    }

    // If no age groups available, don't render the component
    if (!supportedAgeGroups || supportedAgeGroups.length === 0) {
        return null
    }

    return (
        <div className="w-full">
            {/* Title - Hide for doctor users */}
            {!isUserDoctor && (
                <div className="mb-4">
                    <h3 className="text-sm font-semibold text-gray-700 mb-1 flex items-center gap-2">
                        <svg className="w-4 h-4 text-cyan-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Select Your Age Group & Symptoms
                    </h3>
                    <p className="text-xs text-gray-500">
                        Choose your age group to see relevant symptoms
                    </p>
                </div>
            )}

            {/* Alternative Title for Doctor Users */}
            {isUserDoctor && (
                <div className="mb-4">
                    <h3 className="text-sm font-semibold text-gray-700 mb-1 flex items-center gap-2">
                        <svg className="w-4 h-4 text-cyan-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Select Symptoms
                    </h3>
                    <p className="text-xs text-gray-500">
                        Select relevant symptoms for the patient
                    </p>
                </div>
            )}

            {/* Horizontal Bar-style Age Groups - Hidden for doctor users */}
            {!isUserDoctor && supportedAgeGroups && supportedAgeGroups.length > 0 && (
                <div className="mb-6">
                    <div className="flex gap-3 overflow-x-auto pb-3 -mx-1 px-1 no-scrollbar scroll-smooth">
                        {supportedAgeGroups.map((ageGroupId) => {
                        const isSelected = selectedAgeGroup === ageGroupId
                        const ageLabel = formatAgeLabel(ageGroupId)
                        const ageCaption = getAgeCaption(ageGroupId)
                        
                        return (
                            <button
                                key={ageGroupId}
                                onClick={() => handleAgeGroupSelect(ageGroupId)}
                                className={`flex-1 flex flex-col items-center justify-center min-w-[80px] sm:min-w-[100px] py-4 px-3 sm:px-4 rounded-2xl border-2 transition-all duration-300 transform ${
                                    isSelected
                                        ? 'bg-gradient-to-br from-blue-500 to-cyan-500 text-white border-blue-500 shadow-lg scale-105'
                                        : 'bg-white border-blue-200 text-gray-700 hover:border-blue-300 hover:bg-blue-50 hover:scale-105'
                                }`}
                            >
                                <span className="text-lg sm:text-xl font-bold mb-1">
                                    {ageLabel}
                                </span>
                                <span className={`text-[10px] sm:text-xs ${isSelected ? 'text-white/90' : 'text-gray-500'}`}>
                                    {ageCaption}
                                </span>
                                {isSelected && (
                                    <div className="mt-2 w-2 h-2 bg-white rounded-full animate-pulse"></div>
                                )}
                            </button>
                        )
                        })}
                    </div>
                </div>
            )}

            {/* Symptoms Display - For doctors: show always; For patients: show when age group is selected */}
            {((isUserDoctor && availableSymptoms.length > 0) || (selectedAgeGroup && availableSymptoms.length > 0)) && (
                <div className="mb-4 animate-fade-in">
                    <h4 className="text-xs font-semibold text-gray-600 mb-3">
                        Select your symptoms ({selectedSymptoms.length} selected):
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
                    {selectedSymptoms.length > 0 && (
                        <p className="mt-3 text-xs text-gray-600">
                            <span className="font-semibold text-blue-600">{selectedSymptoms.length}</span> symptom{selectedSymptoms.length > 1 ? 's' : ''} selected
                        </p>
                    )}
                </div>
            )}

            {/* Helper Text - Only show for non-doctor users */}
            {!isUserDoctor && !selectedAgeGroup && supportedAgeGroups.length > 0 && (
                <p className="text-xs text-gray-400 italic text-center py-2">
                    Select an age group above to view relevant symptoms
                </p>
            )}
        </div>
    )
}

export default SymptomsByAge
