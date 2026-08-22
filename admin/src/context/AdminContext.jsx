import axios from "axios";
import { createContext, useEffect, useState } from "react";
import { toast } from "react-toastify";


export const AdminContext = createContext()

const AdminContextProvider = (props) => {

    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000'

    const [aToken, setAToken] = useState(sessionStorage.getItem('aToken') ? sessionStorage.getItem('aToken') : '')

    useEffect(() => {
        const onRefresh = (e) => {
            if (e.detail?.role === 'admin' && e.detail.token) setAToken(e.detail.token)
        }
        const onLogout = (e) => {
            if (e.detail?.role === 'admin') setAToken('')
        }
        window.addEventListener('auth:tokenRefreshed', onRefresh)
        window.addEventListener('auth:logout', onLogout)
        return () => {
            window.removeEventListener('auth:tokenRefreshed', onRefresh)
            window.removeEventListener('auth:logout', onLogout)
        }
    }, [])

    const [appointments, setAppointments] = useState([])
    const [doctors, setDoctors] = useState([])
    const [dashData, setDashData] = useState(null)
    const [hospitals, setHospitals] = useState([])
    const [labs, setLabs] = useState([])
    const [bloodBanks, setBloodBanks] = useState([])
    const [revenueData, setRevenueData] = useState(null)

    // Getting all Doctors data from Database using API
    const getAllDoctors = async () => {

        try {

            const { data } = await axios.get(backendUrl + '/api/admin/all-doctors', { headers: { aToken } })
            if (data.success) {
                setDoctors(data.doctors)
            } else {
                toast.error(data.message)
                if (data.message === 'Invalid Session. Please login again.' || data.message === 'Not Authorized Login Again') {
                    sessionStorage.removeItem('aToken')
                    setAToken('')
                }
            }

        } catch (error) {
            toast.error(error.message)
        }

    }

    // Function to change doctor availablity using API
    const changeAvailability = async (docId) => {
        try {

            const { data } = await axios.post(backendUrl + '/api/admin/change-availability', { docId }, { headers: { aToken } })
            if (data.success) {
                toast.success(data.message)
                getAllDoctors()
                getDashData()
            } else {
                toast.error(data.message)
            }

        } catch (error) {
            console.log(error)
            toast.error(error.message)
        }
    }


    // Getting all appointment data from Database using API
    const getAllAppointments = async () => {

        try {

            const { data } = await axios.get(backendUrl + '/api/admin/appointments', { headers: { aToken } })
            if (data.success) {
                setAppointments(data.appointments.reverse())
            } else {
                toast.error(data.message)
                if (data.message === 'Invalid Session. Please login again.' || data.message === 'Not Authorized Login Again') {
                    sessionStorage.removeItem('aToken')
                    setAToken('')
                }
            }
        } catch (error) {
            toast.error(error.message)
            console.log(error)
        }

    }

    // Function to cancel appointment using API
    const cancelAppointment = async (appointmentId) => {

        try {

            const { data } = await axios.post(backendUrl + '/api/admin/cancel-appointment', { appointmentId }, { headers: { aToken } })

            if (data.success) {
                toast.success(data.message)
                getAllAppointments()
                getDashData()
            } else {
                toast.error(data.message)
            }

        } catch (error) {
            toast.error(error.message)
            console.log(error)
        }

    }

    // Getting Admin Dashboard data from Database using API
    const getDashData = async () => {
        try {

            const { data } = await axios.get(backendUrl + '/api/admin/dashboard', { headers: { aToken } })

            if (data.success) {
                setDashData(data.dashData)
            } else {
                toast.error(data.message)
                if (data.message === 'Invalid Session. Please login again.' || data.message === 'Not Authorized Login Again') {
                    sessionStorage.removeItem('aToken')
                    setAToken('')
                }
            }

        } catch (error) {
            console.log(error)
            toast.error(error.message)
            setDashData({
                doctors: 0,
                activeDoctors: 0,
                appointments: 0,
                appointmentsToday: 0,
                patients: 0,
                patientsToday: 0,
                revenueToday: 0,
                revenueTotal: 0,
                hospitals: 0,
                chartData: {
                    patientGrowth: { labels: [], values: [] },
                    revenue: { labels: [], values: [] },
                    appointments: { labels: [], values: [] },
                },
                latestAppointments: [],
            })
        }

    }

    // Function to delete all appointments
    const deleteAllAppointments = async () => {
        try {
            const { data } = await axios.delete(backendUrl + '/api/admin/delete-all-appointments', { headers: { aToken } })

            if (data.success) {
                toast.success(`✅ ${data.message}`)
                // Refresh all data
                await Promise.all([
                    getDashData(),
                    getAllAppointments(),
                    getAllDoctors()
                ])
            } else {
                toast.error(data.message)
            }

        } catch (error) {
            console.log(error)
            toast.error(error.message || 'Failed to delete appointments')
        }
    }


    // Function to get all hospitals
    const getAllHospitals = async () => {
        try {
            const { data } = await axios.get(backendUrl + '/api/hospital-tieup/all', { headers: { aToken } })
            if (data.success) {
                setHospitals(data.hospitals)
            } else {
                toast.error(data.message)
            }
        } catch (error) {
            toast.error(error.message)
        }
    }

    // Function to add hospital
    const addHospital = async (hospitalData) => {
        try {
            const { data } = await axios.post(backendUrl + '/api/hospital-tieup/add', hospitalData, { headers: { aToken } })
            if (data.success) {
                toast.success(data.message)
                await getAllHospitals()
                await getDashData()
                return true
            } else {
                toast.error(data.message)
                return false
            }
        } catch (error) {
            toast.error(error.message)
            return false
        }
    }

    // Function to update hospital
    const updateHospital = async (hospitalData) => {
        try {
            const { data } = await axios.put(backendUrl + '/api/hospital-tieup/update', hospitalData, { headers: { aToken } })
            if (data.success) {
                toast.success(data.message)
                await getAllHospitals()
                await getDashData()
                return true
            } else {
                toast.error(data.message)
                return false
            }
        } catch (error) {
            toast.error(error.message)
            return false
        }
    }

    // Function to delete hospital
    const deleteHospital = async (id) => {
        try {
            const { data } = await axios.post(backendUrl + '/api/hospital-tieup/delete', { id }, { headers: { aToken } })
            if (data.success) {
                toast.success(data.message)
                await getAllHospitals()
                await getDashData()
            } else {
                toast.error(data.message)
            }
        } catch (error) {
            toast.error(error.message)
        }
    }

    // Function to add doctor to hospital
    const addDoctorToHospital = async (hospitalId, doctorData) => {
        try {
            const { data } = await axios.post(backendUrl + '/api/hospital-tieup/doctor/add', { hospitalId, doctorData }, { headers: { aToken } })
            if (data.success) {
                toast.success(data.message)
                await getAllHospitals()
                await getAllDoctors()
                await getDashData()
                return true
            } else {
                toast.error(data.message)
                return false
            }
        } catch (error) {
            toast.error(error.message)
            return false
        }
    }

    // Function to update doctor in hospital
    const updateDoctorInHospital = async (hospitalId, doctorId, doctorData) => {
        try {
            const { data } = await axios.put(backendUrl + '/api/hospital-tieup/doctor/update', { hospitalId, doctorId, doctorData }, { headers: { aToken } })
            if (data.success) {
                toast.success(data.message)
                await getAllHospitals()
                await getAllDoctors()
                await getDashData()
                return true
            } else {
                toast.error(data.message)
                return false
            }
        } catch (error) {
            toast.error(error.message)
            return false
        }
    }

    // Function to delete doctor from hospital
    const deleteDoctorFromHospital = async (hospitalId, doctorId) => {
        try {
            const { data } = await axios.post(backendUrl + '/api/hospital-tieup/doctor/delete', { hospitalId, doctorId }, { headers: { aToken } })
            if (data.success) {
                toast.success(data.message)
                await getAllHospitals()
                await getAllDoctors()
                await getDashData()
                return true
            } else {
                toast.error(data.message)
                return false
            }
        } catch (error) {
            toast.error(error.message)
            return false
        }
    }

    // Function to bulk upload hospital doctors preview
    const bulkAddHospitalDoctorsPreview = async (hospitalId, file) => {
        try {
            const formData = new FormData()
            formData.append('file', file)
            formData.append('hospitalId', hospitalId)

            const { data } = await axios.post(backendUrl + '/api/hospital-tieup/doctor/bulk-preview', formData, {
                headers: { 
                    aToken
                }
            })
            // Return data regardless of success/failure so frontend can handle the error message
            return data
        } catch (error) {
            // Handle axios errors
            const errorMessage = error.response?.data?.message || error.message || 'Failed to process file'
            toast.error(errorMessage)
            return { success: false, message: errorMessage }
        }
    }

    // Function to bulk upload hospital doctors confirm
    const bulkAddHospitalDoctors = async (hospitalId, previewData) => {
        try {
            const { data } = await axios.post(backendUrl + '/api/hospital-tieup/doctor/bulk-add', {
                hospitalId,
                previewData
            }, { headers: { aToken } })
            if (data.success) {
                toast.success(data.message)
                await getAllHospitals()
                await getAllDoctors()
                await getDashData()
                return data
            } else {
                toast.error(data.message)
                return null
            }
        } catch (error) {
            toast.error(error.message)
            return null
        }
    }

    // --- LAB MANAGEMENT ---
    const getAllLabs = async () => {
        try {
            const { data } = await axios.get(backendUrl + '/api/lab/list', { headers: { aToken } })
            if (data.success) {
                setLabs(data.labs)
            } else {
                toast.error(data.message)
            }
        } catch (error) {
            toast.error(error.message)
        }
    }

    const addLab = async (labData) => {
        try {
            const { data } = await axios.post(backendUrl + '/api/lab/add-lab', labData, { headers: { aToken } })
            if (data.success) {
                toast.success(data.message)
                await getAllLabs()
                return true
            } else {
                toast.error(data.message)
                return false
            }
        } catch (error) {
            toast.error(error.message)
            return false
        }
    }

    const updateLab = async (id, labData) => {
        try {
            const { data } = await axios.put(`${backendUrl}/api/lab/update-lab/${id}`, labData, { headers: { aToken } })
            if (data.success) {
                toast.success(data.message)
                await getAllLabs()
                return true
            } else {
                toast.error(data.message)
                return false
            }
        } catch (error) {
            toast.error(error.message)
            return false
        }
    }

    const deleteLab = async (id) => {
        try {
            const { data } = await axios.delete(`${backendUrl}/api/lab/delete-lab/${id}`, { headers: { aToken } })
            if (data.success) {
                toast.success(data.message)
                await getAllLabs()
            } else {
                toast.error(data.message)
            }
        } catch (error) {
            toast.error(error.message)
        }
    }

    // --- BLOOD BANK MANAGEMENT ---
    const getAllBloodBanks = async () => {
        try {
            const { data } = await axios.get(backendUrl + '/api/blood-bank/list', { headers: { aToken } })
            if (data.success) {
                setBloodBanks(data.bloodBanks)
            } else {
                toast.error(data.message)
            }
        } catch (error) {
            toast.error(error.message)
        }
    }

    const addBloodBank = async (bbData) => {
        try {
            const { data } = await axios.post(backendUrl + '/api/blood-bank/add-blood-bank', bbData, { headers: { aToken } })
            if (data.success) {
                toast.success(data.message)
                await getAllBloodBanks()
                return true
            } else {
                toast.error(data.message)
                return false
            }
        } catch (error) {
            toast.error(error.message)
            return false
        }
    }

    const updateBloodBank = async (id, bbData) => {
        try {
            const { data } = await axios.put(`${backendUrl}/api/blood-bank/update-blood-bank/${id}`, bbData, { headers: { aToken } })
            if (data.success) {
                toast.success(data.message)
                await getAllBloodBanks()
                return true
            } else {
                toast.error(data.message)
                return false
            }
        } catch (error) {
            toast.error(error.message)
            return false
        }
    }

    const deleteBloodBank = async (id) => {
        try {
            const { data } = await axios.delete(`${backendUrl}/api/blood-bank/delete-blood-bank/${id}`, { headers: { aToken } })
            if (data.success) {
                toast.success(data.message)
                await getAllBloodBanks()
            } else {
                toast.error(data.message)
            }
        } catch (error) {
            toast.error(error.message)
        }
    }

    const getRevenueAnalytics = async () => {
        try {
            const { data } = await axios.get(backendUrl + '/api/admin/revenue-analytics', { headers: { aToken } })
            if (data.success) {
                setRevenueData(data.analytics)
                return data.analytics
            } else {
                toast.error(data.message)
            }
        } catch (error) {
            toast.error(error.message)
        }
    }

    // ── Receptionists (global) ──────────────────────────────────────────────
    const [receptionists, setReceptionists] = useState([])

    const getReceptionists = async () => {
        try {
            const { data } = await axios.get(backendUrl + '/api/reception/manage/admin', { headers: { aToken } })
            if (data.success) setReceptionists(data.receptionists || [])
            else toast.error(data.message)
        } catch (error) { toast.error(error.message) }
    }

    const addReceptionist = async (payload) => {
        try {
            const { data } = await axios.post(backendUrl + '/api/reception/manage/admin', payload, { headers: { aToken } })
            if (data.success) { toast.success(data.message || 'Receptionist created'); await getReceptionists(); return true }
            toast.error(data.message); return false
        } catch (error) { toast.error(error.response?.data?.message || error.message); return false }
    }

    const toggleReceptionist = async (recId, isActive) => {
        try {
            const { data } = await axios.post(backendUrl + `/api/reception/manage/admin/${recId}/toggle`, { isActive }, { headers: { aToken } })
            if (data.success) await getReceptionists(); else toast.error(data.message)
        } catch (error) { toast.error(error.message) }
    }

    const resetReceptionistPassword = async (recId, newPassword) => {
        try {
            const { data } = await axios.post(backendUrl + `/api/reception/manage/admin/${recId}/reset-password`, { newPassword }, { headers: { aToken } })
            if (data.success) { toast.success(data.message || 'Password reset'); return true }
            toast.error(data.message); return false
        } catch (error) { toast.error(error.message); return false }
    }

    const deleteReceptionist = async (recId) => {
        try {
            const { data } = await axios.delete(backendUrl + `/api/reception/manage/admin/${recId}`, { headers: { aToken } })
            if (data.success) { toast.success(data.message || 'Removed'); await getReceptionists(); return true }
            toast.error(data.message); return false
        } catch (error) { toast.error(error.message); return false }
    }

    const value = {
        aToken, setAToken, backendUrl,
        receptionists, getReceptionists, addReceptionist, toggleReceptionist, resetReceptionistPassword, deleteReceptionist,
        doctors,
        getAllDoctors,
        changeAvailability,
        appointments,
        getAllAppointments,
        getDashData,
        cancelAppointment,
        dashData,
        deleteAllAppointments,
        hospitals,
        getAllHospitals,
        addHospital,
        updateHospital,
        deleteHospital,
        addDoctorToHospital,
        updateDoctorInHospital,
        deleteDoctorFromHospital,
        bulkAddHospitalDoctorsPreview,
        bulkAddHospitalDoctors,
        labs, getAllLabs, addLab, updateLab, deleteLab,
        bloodBanks, getAllBloodBanks, addBloodBank, updateBloodBank, deleteBloodBank,
        revenueData, getRevenueAnalytics,
        migrateEmbeddedDoctors: async () => {
            try {
                const { data } = await axios.post(backendUrl + '/api/hospital-tieup/doctor/migrate', {}, { headers: { aToken } })
                if (data.success) {
                    toast.success(data.message)
                    await getAllHospitals()
                    await getAllDoctors()
                    await getDashData()
                    return data
                } else {
                    toast.error(data.message)
                    return null
                }
            } catch (error) {
                toast.error(error.response?.data?.message || error.message)
                return null
            }
        }
    }

    return (
        <AdminContext.Provider value={value}>
            {props.children}
        </AdminContext.Provider>
    )

}

export default AdminContextProvider