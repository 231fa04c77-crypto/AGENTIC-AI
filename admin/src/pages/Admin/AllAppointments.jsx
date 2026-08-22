import React, { useEffect, useState, useContext } from 'react'
import { assets } from '../../assets/assets'
import { AdminContext } from '../../context/AdminContext'
import { AppContext } from '../../context/AppContext'
import { useSocket } from '../../context/SocketContext'
import { toast } from 'react-toastify'
import GlassCard from '../../components/ui/GlassCard'
import jsPDF from 'jspdf'
import 'jspdf-autotable'
import * as XLSX from 'xlsx'
import axios from 'axios'
import PatientDetailsModal from '../../components/PatientDetailsModal'
import EmailModal from '../../components/EmailModal'
import { AdminPageLayout, PageHero, KpiCard, FilterToolbar } from '../../components/mc'
import { getApiBaseUrl } from '../../utils/apiBaseUrl'
import { labelForAppointment, paymentLabelForAppointment } from '../../utils/lifecycleLabels'

const AllAppointments = () => {
  const { aToken, appointments, cancelAppointment, getAllAppointments, doctors: contextDoctors, getAllDoctors } = useContext(AdminContext)
  const { slotDateFormat, calculateAge, currency } = useContext(AppContext)
  const { socket, isConnected } = useSocket()
  const [currentTime, setCurrentTime] = useState(new Date())
  const [filteredAppointments, setFilteredAppointments] = useState([])
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [activeTab, setActiveTab] = useState('today') // today | all | cancelled
  const [search, setSearch] = useState('')

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  const [filters, setFilters] = useState({
    date: '',
    doctor: '',
    status: ''
  })
  const [doctorsList, setDoctorsList] = useState([])
  const [helplineMap, setHelplineMap] = useState({}) // Map of docId -> helpline number
  const [selectedPatient, setSelectedPatient] = useState(null)
  const [showPatientModal, setShowPatientModal] = useState(false)
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [selectedAppointmentForEmail, setSelectedAppointmentForEmail] = useState(null)
  const [isDocDropdownOpen, setIsDocDropdownOpen] = useState(false)
  const [docSearch, setDocSearch] = useState('')
  const docDropdownRef = React.useRef(null)
  const backendUrl = getApiBaseUrl()

  useEffect(() => {
    if (aToken) {
      getAllAppointments()
      getAllDoctors()
    }
  }, [aToken])

  // Fetch helpline numbers for appointments
  useEffect(() => {
    const fetchHelplines = async () => {
      if (appointments.length === 0) return

      const helplinePromises = appointments.map(async (apt) => {
        try {
          const response = await axios.get(`${backendUrl}/api/specialty/helpline/${apt.docData._id}`)
          if (response.data.success && response.data.data) {
            return { docId: apt.docData._id, helpline: response.data.data }
          }
        } catch (error) {
          // Silently fail if helpline not found
        }
        return null
      })

      const results = await Promise.all(helplinePromises)
      const map = {}
      results.forEach(result => {
        if (result) {
          map[result.docId] = result.helpline
        }
      })
      setHelplineMap(map)
    }

    fetchHelplines()
  }, [appointments])

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // Handle click outside doctor dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (docDropdownRef.current && !docDropdownRef.current.contains(event.target)) {
        setIsDocDropdownOpen(false)
        setDocSearch('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

    // Populate doctor list for filter dropdown
    useEffect(() => {
        // Merge context doctors with doctors found in appointments (safety)
        const doctorMap = new Map()
        
        // 1. Full list from context
        if (contextDoctors && contextDoctors.length > 0) {
            contextDoctors.forEach(d => {
                const id = d._id || d.id
                if (id) doctorMap.set(String(id), {...d, _id: String(id)})
            })
        }
        
        // 2. Extra safety: anyone in appointments we missed
        appointments.forEach(apt => {
            if (apt.docData) {
                const id = apt.docData._id || apt.docData.id
                if (id && !doctorMap.has(String(id))) {
                    doctorMap.set(String(id), {...apt.docData, _id: String(id)})
                }
            }
        })
        
        setDoctorsList(Array.from(doctorMap.values()).sort((a,b) => a.name.localeCompare(b.name)))
    }, [appointments, contextDoctors])

    // Apply main filtering intelligence
    useEffect(() => {
        let filtered = [...appointments]

        // --- GLOBAL FILTERS (Text Search, Date, Doctor, Status) ---
        const isFiltering = debouncedSearch || filters.date || filters.doctor || filters.status

        // Filter by Text Search (Patient or Doctor Name)
        if (debouncedSearch) {
            const lowSearch = debouncedSearch.toLowerCase()
            filtered = filtered.filter(apt => {
                const patientName = (apt.actualPatient && !apt.actualPatient.isSelf ? apt.actualPatient.name : apt.userData?.name) || ''
                const docName = apt.docData?.name || ''
                const publicId = (apt.publicId || apt.public_id || '').toLowerCase()
                const bookingId = (apt.bookingId || apt.booking_id || '').toLowerCase()
                return patientName.toLowerCase().includes(lowSearch)
                    || docName.toLowerCase().includes(lowSearch)
                    || publicId.includes(lowSearch)
                    || bookingId.includes(lowSearch)
            })
        }

        // Filter by Date
        if (filters.date) {
            const [y, m, d] = filters.date.split('-')
            const fStd = `${d.padStart(2, '0')}_${m.padStart(2, '0')}_${y}`
            const fLeg = `${parseInt(d)}_${parseInt(m)}_${y}`
            filtered = filtered.filter(apt => apt.slotDate === fStd || apt.slotDate === fLeg)
        }

        // Filter by Doctor
        if (filters.doctor) {
            filtered = filtered.filter(apt => {
                const docId = apt.docData?._id || apt.docData?.id
                return String(docId) === String(filters.doctor)
            })
        }

        // Filter by Status
        if (filters.status) {
            if (filters.status === 'cancelled') {
                filtered = filtered.filter(apt => apt.cancelled)
            } else if (filters.status === 'completed') {
                filtered = filtered.filter(apt => apt.isCompleted)
            } else if (filters.status === 'active') {
                filtered = filtered.filter(apt => !apt.cancelled && !apt.isCompleted)
            }
        }

        // --- TAB LOGIC ---
        if (!isFiltering) {
            if (activeTab === 'today') {
                const today = new Date()
                const td = today.getDate()
                const tm = today.getMonth() + 1
                const ty = today.getFullYear()
                const tStd = `${td.toString().padStart(2, "0")}_${tm.toString().padStart(2, "0")}_${ty}`
                const tLeg = `${td}_${tm}_${ty}`
                
                filtered = filtered.filter(apt => (apt.slotDate === tStd || apt.slotDate === tLeg))
            } else if (activeTab === 'cancelled') {
                filtered = filtered.filter(apt => apt.cancelled)
            }
        }

        setFilteredAppointments(filtered)
    }, [appointments, filters, activeTab, debouncedSearch])

  // Listen for real-time updates
  useEffect(() => {
    if (socket && isConnected) {
      socket.on('appointment-updated', () => {
        getAllAppointments()
      })

      return () => {
        socket.off('appointment-updated')
      }
    }
  }, [socket, isConnected])

  const formatTime = (date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    })
  }

  const exportToExcel = () => {
    const headers = ['#', 'Patient', 'Age', 'Date', 'Time', 'Doctor', 'Speciality', 'Fees', 'Status']
    const rows = filteredAppointments.map((item, index) => [
      index + 1,
      item.actualPatient && !item.actualPatient.isSelf
        ? `${item.actualPatient.name} (${item.actualPatient.relationship})`
        : item.userData.name,
      item.actualPatient && !item.actualPatient.isSelf
        ? item.actualPatient.age
        : calculateAge(item.userData.dob),
      slotDateFormat(item.slotDate),
      item.slotTime,
      item.docData.name,
      item.docData.speciality,
      `${currency}${item.amount}`,
      item.cancelled ? 'Cancelled' : labelForAppointment(item)
    ])

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])

    // Set column widths
    ws['!cols'] = [
      { wch: 5 },   // #
      { wch: 25 },  // Patient
      { wch: 8 },   // Age
      { wch: 15 },  // Date
      { wch: 12 },  // Time
      { wch: 20 },  // Doctor
      { wch: 18 },  // Speciality
      { wch: 12 },  // Fees
      { wch: 12 }   // Status
    ]

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Appointments')

    // Generate Excel file and download
    const fileName = `appointments_${new Date().toISOString().split('T')[0]}.xlsx`
    XLSX.writeFile(wb, fileName)
    toast.success('Excel file exported successfully!')
  }

  const exportToPDF = () => {
    const doc = new jsPDF()

    doc.setFontSize(18)
    doc.text('All Appointments Report', 14, 22)
    doc.setFontSize(11)
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 30)

    const tableData = filteredAppointments.map((item, index) => [
      index + 1,
      item.actualPatient && !item.actualPatient.isSelf
        ? `${item.actualPatient.name} (${item.actualPatient.relationship})`
        : item.userData.name,
      item.actualPatient && !item.actualPatient.isSelf
        ? item.actualPatient.age
        : calculateAge(item.userData.dob),
      `${slotDateFormat(item.slotDate)} ${item.slotTime}`,
      item.docData.name,
      item.docData.speciality,
      `${currency}${item.amount}`,
      item.cancelled ? 'Cancelled' : labelForAppointment(item)
    ])

    doc.autoTable({
      head: [['#', 'Patient', 'Age', 'Date & Time', 'Doctor', 'Speciality', 'Fees', 'Status']],
      body: tableData,
      startY: 35,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [102, 126, 234] }
    })

    doc.save(`appointments_${new Date().toISOString().split('T')[0]}.pdf`)
    toast.success('PDF exported successfully!')
  }

  return (
    <AdminPageLayout>
        <PageHero
          title="Appointments"
          subtitle="Manage and monitor appointments across all hospitals, departments and doctors."
          features={['Real-time Scheduling', 'Centralized Control', 'Multi-Hospital View', 'Better Patient Flow']}
        />

        <div className="mc-kpi-grid mc-kpi-grid--5">
          <KpiCard label="Total Appointments" value={appointments.length} iconBg="bg-sky-100 text-sky-600"
            icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
          />
          <KpiCard label="Filtered Results" value={filteredAppointments.length} iconBg="bg-violet-100 text-violet-600"
            icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>}
          />
        </div>

        {/* Tabs: Today | All | Cancelled */}
        <div className='flex justify-center sm:justify-start'>
          <div className='inline-flex items-center gap-1 bg-white rounded-full shadow-md px-2 py-1 border border-gray-100'>
            {[
              { id: 'today', label: 'Today' },
              { id: 'all', label: 'All' },
              { id: 'cancelled', label: 'Cancelled' }
            ].map(tab => (
              <button
                key={tab.id}
                type='button'
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex items-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-semibold rounded-full transition-colors ${activeTab === tab.id ? 'text-indigo-600' : 'text-gray-500 hover:text-gray-700'
                  }`}
              >
                {tab.id === 'today' && (
                  <svg className='w-4 h-4' fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                )}
                {tab.id === 'all' && (
                  <svg className='w-4 h-4' fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                )}
                {tab.id === 'cancelled' && (
                  <svg className='w-4 h-4' fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a1 1 0 00.86 1.5h18.64a1 1 0 00.86-1.5L13.71 3.86a1 1 0 00-1.72 0z" />
                  </svg>
                )}
                <span>{tab.label}</span>
                {activeTab === tab.id && (
                  <span className='absolute left-3 right-3 -bottom-1 h-0.5 rounded-full bg-gradient-to-r from-indigo-500 to-blue-500' />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Main Search & Filters Section */}
        <GlassCard className="p-2.5 sm:p-3">
            <div className='flex flex-col gap-2.5'>
                {/* Text Search - High Emphasis */}
                <div className='relative w-full overflow-hidden'>
                    <svg className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-teal-500' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                        <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' />
                    </svg>
                    <input 
                        value={search} 
                        onChange={e => setSearch(e.target.value)}
                        placeholder='Search and filter by patient name, doctor name, or specific keywords…'
                        className='w-full pl-9 pr-3 py-2 border border-slate-200 bg-white rounded-xl text-sm font-medium focus:bg-white focus:border-indigo-400 outline-none transition-all placeholder:text-gray-400' 
                    />
                </div>

                {/* Dropdown Filters & Actions */}
                <div className='flex flex-col lg:flex-row gap-4 items-stretch lg:items-end'>
                    <div className='flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3'>
                        <div className='space-y-1'>
                            <label className='text-[10px] font-black uppercase tracking-wider text-gray-400 ml-1'>Appointment Date</label>
                            <input
                                type='date'
                                value={filters.date}
                                onChange={(e) => setFilters({ ...filters, date: e.target.value })}
                                className='w-full px-4 py-2.5 border-2 border-indigo-50 bg-indigo-50/50 rounded-xl text-sm font-bold text-gray-700 focus:bg-white focus:border-indigo-400 outline-none'
                            />
                        </div>
                        <div className='space-y-1 relative' ref={docDropdownRef}>
                            <label className='text-[10px] font-black uppercase tracking-wider text-gray-400 ml-1'>Select Doctor</label>
                            <div className='relative group'>
                                <input
                                    type='text'
                                    placeholder='Search by name or speciality...'
                                    value={isDocDropdownOpen ? docSearch : (filters.doctor ? doctorsList.find(d => String(d._id) === String(filters.doctor))?.name : 'All Medical Professionals')}
                                    onFocus={() => {
                                        setIsDocDropdownOpen(true)
                                        setDocSearch('')
                                    }}
                                    onChange={(e) => setDocSearch(e.target.value)}
                                    className={`w-full px-4 py-3 border-2 rounded-xl text-sm font-bold transition-all outline-none appearance-none ${
                                        isDocDropdownOpen 
                                            ? 'border-indigo-400 bg-white ring-4 ring-indigo-50' 
                                            : 'border-indigo-50 bg-indigo-50/50 text-gray-700 hover:bg-indigo-50'
                                    }`}
                                />
                                {isDocDropdownOpen && docSearch && (
                                    <button 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setDocSearch('');
                                        }}
                                        className='absolute right-10 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 transition-all'
                                    >
                                        <svg className='w-4 h-4' fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                )}
                                <div 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setIsDocDropdownOpen(!isDocDropdownOpen);
                                    }}
                                    className='absolute right-4 top-1/2 -translate-y-1/2 cursor-pointer p-1 hover:bg-indigo-50 rounded-full transition-all z-20'
                                >
                                    <svg className={`w-4 h-4 text-indigo-400 transition-transform duration-300 ${isDocDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </div>

                                {isDocDropdownOpen && (
                                    <div className='absolute z-[100] top-full left-0 right-0 mt-2 bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-indigo-100 max-h-[320px] overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-200 custom-scrollbar'>
                                        <div 
                                            onClick={() => {
                                                setFilters({...filters, doctor: ''})
                                                setDocSearch('')
                                                setIsDocDropdownOpen(false)
                                            }}
                                            className='px-4 py-3 hover:bg-indigo-50 cursor-pointer text-xs font-black uppercase tracking-widest text-indigo-500 border-b border-indigo-50 transition-colors'
                                        >
                                            View All Professionals
                                        </div>
                                        
                                        {doctorsList
                                            .filter(d => 
                                                !docSearch || 
                                                d.name.toLowerCase().includes(docSearch.toLowerCase()) || 
                                                d.speciality.toLowerCase().includes(docSearch.toLowerCase())
                                            )
                                            .map(doctor => (
                                                <div 
                                                    key={doctor._id}
                                                    onClick={() => {
                                                        setFilters({...filters, doctor: doctor._id})
                                                        setDocSearch('')
                                                        setIsDocDropdownOpen(false)
                                                    }}
                                                    className='px-4 py-3 hover:bg-indigo-50 cursor-pointer flex items-center gap-3 transition-all border-b border-gray-50 last:border-0 group/item'
                                                >
                                                    <div className='relative'>
                                                        <img src={doctor.image} className='w-10 h-10 rounded-full border-2 border-white shadow-sm group-hover/item:border-indigo-200 transition-all' alt='' />
                                                        {doctor.available && <div className='absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-white rounded-full' />}
                                                    </div>
                                                    <div className='min-w-0 flex-1'>
                                                        <p className='text-sm font-bold text-gray-800 truncate group-hover/item:text-indigo-600 transition-colors'>{doctor.name}</p>
                                                        <div className='flex items-center gap-2'>
                                                            <span className='text-[10px] font-medium text-gray-500 truncate'>{doctor.speciality}</span>
                                                            {doctor.hospital_name && (
                                                                <>
                                                                    <span className='w-1 h-1 rounded-full bg-gray-300' />
                                                                    <span className='text-[9px] font-bold text-cyan-600 truncate uppercase'>{doctor.hospital_name}</span>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                    {String(filters.doctor) === String(doctor._id) && (
                                                        <svg className='w-5 h-5 text-indigo-500' fill="currentColor" viewBox="0 0 20 20">
                                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                        </svg>
                                                    )}
                                                </div>
                                            ))}
                                        
                                        {doctorsList.filter(d => 
                                            !docSearch || 
                                            d.name.toLowerCase().includes(docSearch.toLowerCase()) || 
                                            d.speciality.toLowerCase().includes(docSearch.toLowerCase())
                                        ).length === 0 && (
                                            <div className='px-4 py-10 text-center'>
                                                <div className='w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-3'>
                                                    <svg className='w-6 h-6 text-gray-300' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                                                        <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' />
                                                    </svg>
                                                </div>
                                                <p className='text-xs font-bold text-gray-400'>No doctors found matching your search</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className='space-y-1'>
                            <label className='text-[10px] font-black uppercase tracking-wider text-gray-400 ml-1'>Current Status</label>
                            <div className='relative'>
                                <select
                                    value={filters.status}
                                    onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                                    className='w-full px-4 py-3 border-2 border-indigo-50 bg-indigo-50/50 rounded-xl text-sm font-bold text-gray-700 outline-none focus:bg-white focus:border-indigo-400 appearance-none transition-all cursor-pointer'
                                >
                                    <option value=''>All Booking Status</option>
                                    <option value='Confirmed'>Confirmed</option>
                                    <option value='Cancelled'>Cancelled</option>
                                    <option value='Completed'>Completed</option>
                                </select>
                                <div className='absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none'>
                                    <svg className='w-4 h-4 text-indigo-400' fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className='flex flex-row gap-2 h-9'>
                        <button onClick={exportToExcel} className='flex-1 px-3 bg-emerald-600 text-white rounded-lg hover:shadow-emerald-500/20 active:scale-95 transition-all flex items-center justify-center gap-2 font-black text-[10px] uppercase'>
                            <svg className='w-4 h-4' fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                            Excel
                        </button>
                        <button onClick={exportToPDF} className='flex-1 px-3 bg-pink-600 text-white rounded-lg hover:shadow-pink-500/20 active:scale-95 transition-all flex items-center justify-center gap-2 font-black text-[10px] uppercase'>
                            <svg className='w-4 h-4' fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                            PDF
                        </button>
                    </div>
                </div>

                {(search || filters.date || filters.doctor || filters.status) && (
                    <div className='flex items-center justify-between px-1'>
                        <p className='text-[10px] font-bold text-indigo-600 animate-pulse'>Showing narrowed results across all records...</p>
                        <button
                            onClick={() => {
                                setFilters({ date: '', doctor: '', status: '' });
                                setSearch('');
                            }}
                            className='text-[10px] font-black uppercase text-red-500 hover:text-red-700 flex items-center gap-1 transition-colors'
                        >
                            <svg className='w-3 h-3' fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                            Reset All Filters
                        </button>
                    </div>
                )}
            </div>
        </GlassCard>

        {/* Clean Block Container */}
        <div className='bg-gray-50 rounded-lg p-4 sm:p-6'>
          <div>
            {filteredAppointments.length === 0 ? (
              <div className='flex flex-col items-center justify-center py-16 text-gray-400'>
                <svg className='w-20 h-20 mb-4' fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <p className='text-lg font-medium'>No appointments found</p>
                <p className='text-sm'>Try adjusting your filters</p>
              </div>
            ) : (
              <>
                {/* Desktop Table (lg and up) */}
                <div className='hidden lg:block overflow-x-auto'>
                  <table className='admin-table'>
                    <thead>
                      <tr>
                        <th style={{ width: '56px', textAlign: 'center' }}>#</th>
                        <th>Patient</th>
                        <th style={{ width: '80px', textAlign: 'center' }}>Age</th>
                        <th style={{ width: '180px' }}>Date &amp; Time</th>
                        <th>Doctor</th>
                        <th style={{ width: '80px', textAlign: 'center' }}>Fees</th>
                        <th style={{ width: '100px', textAlign: 'center' }}>Payment</th>
                        <th style={{ width: '160px', textAlign: 'center' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAppointments.map((item, index) => {
                        const patientPhone = item.actualPatient && !item.actualPatient.isSelf
                          ? item.actualPatient.phone
                          : item.userData.phone;
                        const patientEmail = item.userData.email;
                        const patientName = item.actualPatient && !item.actualPatient.isSelf
                          ? item.actualPatient.name
                          : item.userData.name;

                        return (
                          <tr key={index}>
                            {/* # */}
                            <td style={{ textAlign: 'center' }}>
                              <span className='text-sm text-gray-500 font-medium'>{index + 1}</span>
                            </td>

                            {/* Patient */}
                            <td>
                              <div className='flex items-center gap-3'>
                                <img
                                  src={item.userData.image}
                                  className='w-10 h-10 rounded-full border-2 border-indigo-100 flex-shrink-0'
                                  alt=""
                                />
                                <div className='min-w-0'>
                                  <button
                                    onClick={() => {
                                      setSelectedPatient(item);
                                      setShowPatientModal(true);
                                    }}
                                    className='font-semibold text-gray-800 text-sm hover:text-indigo-600 transition-colors text-left block truncate'
                                  >
                                    {patientName}
                                  </button>
                                  {item.actualPatient && !item.actualPatient.isSelf && (
                                    <p className='text-xs text-cyan-600 font-medium truncate mt-0.5'>
                                      {item.actualPatient.relationship} • Booked by: {item.userData.name}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </td>

                            {/* Age */}
                            <td style={{ textAlign: 'center' }}>
                              <span className='inline-flex items-center justify-center px-2.5 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-medium'>
                                {item.actualPatient && !item.actualPatient.isSelf
                                  ? item.actualPatient.age
                                  : calculateAge(item.userData.dob)}
                              </span>
                            </td>

                            {/* Date & Time - compact single line */}
                            <td>
                              <span className='text-sm font-semibold text-gray-800 whitespace-nowrap'>
                                {slotDateFormat(item.slotDate)}
                                <span className='text-xs font-normal text-gray-500 ml-2'>
                                  • {item.slotTime}
                                </span>
                              </span>
                            </td>

                            {/* Doctor */}
                            <td>
                              <div className='flex items-center gap-3'>
                                <img
                                  src={item.docData.image}
                                  className='w-10 h-10 rounded-full border-2 border-purple-100 flex-shrink-0'
                                  alt=""
                                />
                                <div className='min-w-0'>
                                  <p className='font-semibold text-gray-800 text-sm truncate'>
                                    {item.docData.name}
                                  </p>
                                  <p className='text-xs text-gray-500 truncate mt-0.5'>
                                    {item.docData.speciality}
                                  </p>
                                  {helplineMap[item.docData._id] && helplineMap[item.docData._id].status === 'Active' && helplineMap[item.docData._id].helplineNumber && (
                                    <a
                                      href={`tel:${helplineMap[item.docData._id].helplineNumber.replace(/\s/g, '')}`}
                                      className='text-[11px] text-blue-600 hover:text-blue-700 flex items-center gap-1 mt-0.5'
                                    >
                                      <svg className='w-3.5 h-3.5 flex-shrink-0' fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                      </svg>
                                      <span className='truncate'>{helplineMap[item.docData._id].helplineNumber}</span>
                                    </a>
                                  )}
                                </div>
                              </div>
                            </td>

                            {/* Fees */}
                            <td style={{ textAlign: 'center' }}>
                              <span className='font-bold text-gray-800 text-sm whitespace-nowrap'>
                                {currency}{item.amount}
                              </span>
                            </td>

                            {/* Payment Status */}
                            <td style={{ textAlign: 'center' }}>
                              <span className={`inline-flex items-center justify-center px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                item.payment || item.paidAtBooking
                                  ? 'bg-green-100 text-green-700 border border-green-200' 
                                  : 'bg-orange-100 text-orange-700 border border-orange-200'
                              }`}>
                                {paymentLabelForAppointment(item)}
                              </span>
                            </td>

                            {/* Actions */}
                            <td>
                              <div className='flex items-center justify-center gap-3'>
                                {/* Action Icons */}
                                <div className='flex items-center gap-1.5'>
                                  {/* Call */}
                                  <button
                                    onClick={() => {
                                      if (patientPhone) {
                                        window.location.href = `tel:${patientPhone.replace(/\s/g, '')}`;
                                      } else {
                                        toast.error('Patient phone number not available');
                                      }
                                    }}
                                    className='p-1.5 hover:bg-green-50 rounded-lg transition-colors flex items-center justify-center'
                                    title='Call Patient'
                                    disabled={!patientPhone}
                                    style={{ width: '32px', height: '32px' }}
                                  >
                                    <svg className={`w-4 h-4 ${patientPhone ? 'text-green-600' : 'text-gray-300'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                    </svg>
                                  </button>

                                  {/* Message */}
                                  <button
                                    onClick={() => {
                                      if (patientEmail) {
                                        const subject = encodeURIComponent('MedClues Appointment Update');
                                        const body = encodeURIComponent(`Hello ${patientName},\n\nThis is MedClues Hospital regarding your appointment on ${item.slotDate} at ${item.slotTime}.\n\nRegards,\nMedClues Team`);
                                        window.location.href = `mailto:${patientEmail}?subject=${subject}&body=${body}`;
                                      } else {
                                        toast.error('Patient email not available');
                                      }
                                    }}
                                    className='p-1.5 hover:bg-blue-50 rounded-lg transition-colors flex items-center justify-center'
                                    title='Message Patient'
                                    disabled={!patientEmail}
                                    style={{ width: '32px', height: '32px' }}
                                  >
                                    <svg className={`w-4 h-4 ${patientEmail ? 'text-blue-600' : 'text-gray-300'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                    </svg>
                                  </button>

                                  {/* Mail */}
                                  <button
                                    onClick={() => {
                                      if (patientEmail) {
                                        setSelectedAppointmentForEmail(item);
                                        setShowEmailModal(true);
                                      } else {
                                        toast.error('Patient email not available');
                                      }
                                    }}
                                    className='p-1.5 hover:bg-purple-50 rounded-lg transition-colors flex items-center justify-center'
                                    title='Send Email'
                                    disabled={!patientEmail}
                                    style={{ width: '32px', height: '32px' }}
                                  >
                                    <svg className={`w-4 h-4 ${patientEmail ? 'text-purple-600' : 'text-gray-300'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                    </svg>
                                  </button>
                                </div>

                                {/* Status / Cancel */}
                                {item.cancelled ? (
                                  <span className='inline-flex items-center justify-center px-2.5 py-1 bg-red-100 text-red-700 text-xs font-semibold rounded-full whitespace-nowrap'>
                                    Cancelled
                                  </span>
                                ) : item.isCompleted ? (
                                  <span className='inline-flex items-center justify-center gap-1 px-2.5 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full whitespace-nowrap'>
                                    <svg className='w-3.5 h-3.5' fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                    </svg>
                                    Completed
                                  </span>
                                ) : (
                                  <div className='flex items-center gap-1.5 justify-center'>
                                    <span className='inline-flex px-2 py-1 bg-blue-50 text-blue-700 text-[10px] font-bold rounded-full whitespace-nowrap'>
                                      {labelForAppointment(item)}
                                    </span>
                                    <button
                                      onClick={() => cancelAppointment(item._id)}
                                      className='p-1.5 hover:bg-red-50 rounded-lg transition-colors flex items-center justify-center'
                                      title='Cancel Appointment'
                                      style={{ width: '32px', height: '32px' }}
                                    >
                                      <img className='w-5 h-5' src={assets.cancel_icon} alt="Cancel" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* Mobile Cards */}
            <div className='lg:hidden space-y-4 sm:space-y-5 p-0'>
              {filteredAppointments.map((item, index) => {
                const patientPhone = item.actualPatient && !item.actualPatient.isSelf
                  ? item.actualPatient.phone
                  : item.userData.phone;
                const patientEmail = item.userData.email;
                const patientName = item.actualPatient && !item.actualPatient.isSelf
                  ? item.actualPatient.name
                  : item.userData.name;

                return (
                  <div key={index} className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6 shadow-sm w-full">
                    <div className='flex items-start gap-4 sm:gap-5'>
                      <img src={item.userData.image} className='w-12 h-12 sm:w-14 sm:h-14 rounded-full border-2 border-indigo-100 flex-shrink-0' alt="" />
                      <div className='flex-1 min-w-0'>
                        <button
                          onClick={() => {
                            setSelectedPatient(item);
                            setShowPatientModal(true);
                          }}
                          className='font-semibold text-base sm:text-lg text-gray-800 hover:text-indigo-600 transition-colors text-left truncate block w-full mb-1'
                        >
                          {patientName}
                        </button>
                        {item.actualPatient && !item.actualPatient.isSelf && (
                          <p className='text-xs sm:text-sm text-cyan-600 font-medium mt-1.5 mb-1.5 break-words'>
                            {item.actualPatient.relationship} • Booked by: {item.userData.name}
                          </p>
                        )}
                        <p className='text-xs sm:text-sm text-gray-500 mt-1.5 mb-3'>{slotDateFormat(item.slotDate)} at {item.slotTime}</p>
                        <div className='flex items-center gap-3 mt-3'>
                          <img src={item.docData.image} className='w-9 h-9 sm:w-10 sm:h-10 rounded-full flex-shrink-0 border-2 border-blue-100' alt="" />
                          <div className='min-w-0 flex-1'>
                            <p className='text-sm sm:text-base font-medium text-gray-700 truncate mb-0.5'>{item.docData.name}</p>
                            <p className='text-xs sm:text-sm text-gray-500 truncate'>{item.docData.speciality}</p>
                            {helplineMap[item.docData._id] && helplineMap[item.docData._id].status === 'Active' && helplineMap[item.docData._id].helplineNumber && (
                              <a
                                href={`tel:${helplineMap[item.docData._id].helplineNumber.replace(/\s/g, '')}`}
                                className='text-[10px] text-blue-600 hover:text-blue-700 flex items-center gap-1 mt-0.5'
                              >
                                <svg className='w-3 h-3' fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                </svg>
                                {helplineMap[item.docData._id].helplineNumber}
                              </a>
                            )}
                          </div>
                        </div>

                        {/* Action Buttons for Mobile */}
                        <div className='grid grid-cols-3 gap-3 mt-4'>
                          <button
                            onClick={() => {
                              if (patientPhone) {
                                window.location.href = `tel:${patientPhone.replace(/\s/g, '')}`;
                              } else {
                                toast.error('Patient phone number not available');
                              }
                            }}
                            disabled={!patientPhone}
                            className={`px-3 sm:px-4 py-2.5 rounded-lg text-xs sm:text-sm font-medium flex items-center justify-center gap-1.5 sm:gap-2 transition-colors ${patientPhone
                                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                              }`}
                          >
                            <svg className='w-4 h-4 sm:w-5 sm:h-5' fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                            </svg>
                            <span className='hidden sm:inline'>Call</span>
                          </button>
                          <button
                            onClick={() => {
                              if (patientEmail) {
                                const subject = encodeURIComponent('MedClues Appointment Update');
                                const body = encodeURIComponent(`Hello ${patientName},\n\nThis is MedClues Hospital regarding your appointment on ${item.slotDate} at ${item.slotTime}.\n\nRegards,\nMedClues Team`);
                                window.location.href = `mailto:${patientEmail}?subject=${subject}&body=${body}`;
                              } else {
                                toast.error('Patient email not available');
                              }
                            }}
                            disabled={!patientEmail}
                            className={`px-3 sm:px-4 py-2.5 rounded-lg text-xs sm:text-sm font-medium flex items-center justify-center gap-1.5 sm:gap-2 transition-colors ${patientEmail
                                ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                              }`}
                          >
                            <svg className='w-4 h-4 sm:w-5 sm:h-5' fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                            <span className='hidden sm:inline'>Message</span>
                          </button>
                          <button
                            onClick={() => {
                              if (patientEmail) {
                                setSelectedAppointmentForEmail(item);
                                setShowEmailModal(true);
                              } else {
                                toast.error('Patient email not available');
                              }
                            }}
                            disabled={!patientEmail}
                            className={`px-3 sm:px-4 py-2.5 rounded-lg text-xs sm:text-sm font-medium flex items-center justify-center gap-1.5 sm:gap-2 transition-colors ${patientEmail
                                ? 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                              }`}
                          >
                            <svg className='w-4 h-4 sm:w-5 sm:h-5' fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                            <span className='hidden sm:inline'>Mail</span>
                          </button>
                        </div>

                        <div className='flex items-center justify-between mt-4 pt-3 border-t border-gray-200'>
                          <div className='flex flex-col'>
                            <span className='text-lg sm:text-xl font-bold text-indigo-600'>{currency}{item.amount}</span>
                            <span className={`text-[10px] uppercase tracking-wider font-bold ${item.payment || item.paidAtBooking ? 'text-green-600' : 'text-orange-600'}`}>
                              {paymentLabelForAppointment(item)}
                            </span>
                          </div>
                          {item.cancelled ? (
                            <span className='px-3 sm:px-4 py-1.5 bg-red-100 text-red-600 text-xs sm:text-sm font-semibold rounded-lg'>Cancelled</span>
                          ) : item.isCompleted ? (
                            <span className='px-3 sm:px-4 py-1.5 bg-green-100 text-green-600 text-xs sm:text-sm font-semibold rounded-lg'>Completed</span>
                          ) : (
                            <button
                              onClick={() => cancelAppointment(item._id)}
                              className='p-2 sm:p-2.5 hover:bg-red-50 rounded-lg transition-colors'
                            >
                              <img className='w-5 h-5 sm:w-6 sm:h-6' src={assets.cancel_icon} alt="Cancel" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Patient Details Modal */}
        {selectedPatient && (
          <PatientDetailsModal
            isOpen={showPatientModal}
            onClose={() => {
              setShowPatientModal(false);
              setSelectedPatient(null);
            }}
            appointment={selectedPatient}
            backendUrl={backendUrl}
            aToken={aToken}
          />
        )}

        {/* Email Modal */}
        {selectedAppointmentForEmail && (
          <EmailModal
            isOpen={showEmailModal}
            onClose={() => {
              setShowEmailModal(false);
              setSelectedAppointmentForEmail(null);
            }}
            patientEmail={selectedAppointmentForEmail.userData.email}
            patientName={
              selectedAppointmentForEmail.actualPatient && !selectedAppointmentForEmail.actualPatient.isSelf
                ? selectedAppointmentForEmail.actualPatient.name
                : selectedAppointmentForEmail.userData.name
            }
            appointment={selectedAppointmentForEmail}
            backendUrl={backendUrl}
            aToken={aToken}
          />
        )}
    </AdminPageLayout>
  )
}

export default AllAppointments
