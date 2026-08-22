import React, { createContext, useState, useEffect } from "react";


export const AppContext = createContext()

const AppContextProvider = (props) => {

    const rawCurrency = import.meta.env.VITE_CURRENCY || '₹'
    const currency = String(rawCurrency).toUpperCase() === 'INR' ? '₹' : rawCurrency
    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000'

    const months = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

    // Function to format the date eg. ( 20_01_2000 => 20 Jan 2000 )
    const slotDateFormat = (slotDate) => {
        try {
            if (!slotDate) return "Date not set"
            const dateArray = slotDate.split('_')
            if (dateArray.length !== 3) return "Invalid date"
            const day = dateArray[0]
            const monthIndex = Number(dateArray[1])
            const year = dateArray[2]
            
            if (!months[monthIndex]) return "Invalid date"
            
            return day + " " + months[monthIndex] + " " + year
        } catch (error) {
            return "Invalid date"
        }
    }

    // Function to calculate the age eg. ( 20_01_2000 => 24 )
    const calculateAge = (dob) => {
        try {
            if (!dob) return null
            const today = new Date()
            const birthDate = new Date(dob)

            if (isNaN(birthDate.getTime())) return null

            let age = today.getFullYear() - birthDate.getFullYear()
            const monthDiff = today.getMonth() - birthDate.getMonth()

            if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
                age--
            }

            return age >= 0 ? age : null
        } catch (error) {
            return null
        }
    }

    const [sidebarOpen, setSidebarOpen] = useState(false)
    const [darkMode, setDarkMode] = useState(() => {
        if (typeof window === 'undefined') return false
        // Light mode by default; dark only when user explicitly chose it
        return localStorage.getItem('medclues-theme') === 'dark'
    })

    useEffect(() => {
        localStorage.setItem('medclues-theme', darkMode ? 'dark' : 'light')
    }, [darkMode])

    const toggleDarkMode = () => setDarkMode((prev) => !prev)
    
    // Auto-close sidebar on screen resize if it's large
    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth >= 1024) {
                setSidebarOpen(false)
            }
        }
        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [])

    const value = {
        backendUrl,
        currency,
        slotDateFormat,
        calculateAge,
        sidebarOpen,
        setSidebarOpen,
        darkMode,
        setDarkMode,
        toggleDarkMode,
    }

    return (
        <AppContext.Provider value={value}>
            {props.children}
        </AppContext.Provider>
    )

}

export default AppContextProvider