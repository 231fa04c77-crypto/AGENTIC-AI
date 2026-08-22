import React, { useContext, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AdminContext } from '../../context/AdminContext'
import { toast } from 'react-toastify'
import GlassCard from '../../components/ui/GlassCard'
import DoctorProfileView from '../../components/DoctorProfileView'
import { AdminPageLayout, PageHero, KpiCard, FilterToolbar, McButton } from '../../components/mc'

const HospitalTieUps = () => {
    const navigate = useNavigate()
    const {
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
        migrateEmbeddedDoctors
    } = useContext(AdminContext)

    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [showDoctorModal, setShowDoctorModal] = useState(false)
    const [editingHospital, setEditingHospital] = useState(null)
    const [expandedHospitalId, setExpandedHospitalId] = useState(null)
    const [selectedHospitalForDoctor, setSelectedHospitalForDoctor] = useState(null)
    const [editingDoctor, setEditingDoctor] = useState(null)

    // Profile View State
    const [showProfileView, setShowProfileView] = useState(false)
    const [selectedDoctorForProfile, setSelectedDoctorForProfile] = useState(null)

    // Bulk Upload State
    const [showBulkUploadModal, setShowBulkUploadModal] = useState(false)
    const [bulkFile, setBulkFile] = useState(null)
    const [bulkUploading, setBulkUploading] = useState(false)
    const [bulkPreview, setBulkPreview] = useState(null)
    const [bulkResults, setBulkResults] = useState(null)
    const [showBulkPreview, setShowBulkPreview] = useState(false)

    // List of 12 specialties matching frontend
    const specialties = [
        'General Medicine',
        'Gynecology',
        'Dermatology',
        'Pediatrics',
        'Neurology',
        'Gastroenterology',
        'Cardiology',
        'Orthopedics',
        'Psychiatry',
        'Ophthalmology',
        'ENT',
        'Dentistry'
    ]

    const [formData, setFormData] = useState({
        name: '',
        address: '',
        mapsLink: '',
        contact: '',
        specialization: '',
        type: 'General',
        showOnHome: false
    })

    const [doctorFormData, setDoctorFormData] = useState({
        name: '',
        qualification: '',
        specialization: '',
        experience: 0,
        available: true
    })

    useEffect(() => {
        fetchData()
    }, [])

    const fetchData = async () => {
        setLoading(true)
        await getAllHospitals()
        setLoading(false)
    }

    // --- HOSPITAL HANDLERS ---
    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!formData.name || !formData.address || !formData.contact || !formData.specialization) {
            toast.error('Please fill all required fields')
            return
        }
        let success = false
        if (editingHospital) {
            success = await updateHospital({ ...formData, id: editingHospital._id })
        } else {
            success = await addHospital(formData)
        }
        if (success) {
            setShowModal(false)
            resetForm()
        }
    }

    const handleEdit = (hospital) => {
        setEditingHospital(hospital)
        setFormData({
            name: hospital.name,
            address: hospital.address,
            mapsLink: hospital.mapsLink || hospital.maps_link || '',
            contact: hospital.contact,
            specialization: hospital.specialization,
            type: hospital.type || 'General',
            showOnHome: hospital.showOnHome
        })
        setShowModal(true)
    }

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure you want to remove this hospital?')) {
            await deleteHospital(id)
        }
    }

    const handleToggleVisibility = async (hospital) => {
        const updatedData = { ...hospital, id: hospital._id, showOnHome: !hospital.showOnHome }
        await updateHospital(updatedData)
    }

    // --- DOCTOR HANDLERS ---
    const handleDoctorSubmit = async (e) => {
        e.preventDefault()
        if (!doctorFormData.name || !doctorFormData.qualification) {
            toast.error('Please fill all required fields')
            return
        }

        let success = false
        if (editingDoctor) {
            success = await updateDoctorInHospital(selectedHospitalForDoctor._id, editingDoctor._id, doctorFormData)
        } else {
            success = await addDoctorToHospital(selectedHospitalForDoctor._id, doctorFormData)
        }

        if (success) {
            setShowDoctorModal(false)
            resetDoctorForm()
        }
    }

    const handleAddDoctor = (hospital) => {
        setSelectedHospitalForDoctor(hospital)
        resetDoctorForm()
        setShowDoctorModal(true)
    }

    const handleEditDoctor = (hospital, doctor) => {
        setSelectedHospitalForDoctor(hospital)
        setEditingDoctor(doctor)
        setDoctorFormData({
            name: doctor.name,
            qualification: doctor.qualification,
            specialization: doctor.specialization,
            experience: doctor.experience,
            available: doctor.available
        })
        setShowDoctorModal(true)
    }

    const handleDeleteDoctor = async (hospital, doctorId) => {
        if (window.confirm('Remove this doctor?')) {
            await deleteDoctorFromHospital(hospital._id, doctorId)
        }
    }

    const handleToggleDoctorVisibility = async (hospital, doctor) => {
        await updateDoctorInHospital(hospital._id, doctor._id, { ...doctor, showOnHospitalPage: !doctor.showOnHospitalPage })
    }

    const handleViewProfile = (hospital, doctor) => {
        setSelectedHospitalForDoctor(hospital)
        setSelectedDoctorForProfile(doctor)
        setShowProfileView(true)
    }

    // --- BULK UPLOAD HANDLERS ---
    const handleBulkUploadClick = (hospital) => {
        setSelectedHospitalForDoctor(hospital)
        setBulkFile(null)
        setBulkPreview(null)
        setBulkResults(null)
        setShowBulkPreview(false)
        setShowBulkUploadModal(true)
    }

    const handleBulkUploadPreview = async (e) => {
        e.preventDefault()
        if (!bulkFile || !selectedHospitalForDoctor) {
            return toast.error('Please select a file and hospital')
        }

        const fileExtension = bulkFile.name.split('.').pop().toLowerCase()
        if (!['csv', 'xlsx', 'xls'].includes(fileExtension)) {
            return toast.error('Please upload a CSV or Excel file (.csv, .xlsx, .xls)')
        }

        setBulkUploading(true)
        setBulkPreview(null)
        setBulkResults(null)

        try {
            const result = await bulkAddHospitalDoctorsPreview(selectedHospitalForDoctor._id, bulkFile)
            if (result) {
                if (result.success) {
                    setBulkPreview(result)
                    setShowBulkPreview(true)
                } else {
                    toast.error(result.message || 'Failed to process file')
                }
            } else {
                toast.error('Failed to process file. Please try again.')
            }
        } catch (error) {
            toast.error(error.message || 'Failed to process file')
        } finally {
            setBulkUploading(false)
        }
    }

    const handleBulkUploadConfirm = async () => {
        if (!bulkPreview || !bulkPreview.preview || bulkPreview.preview.length === 0) {
            return toast.error('No valid doctors to upload')
        }

        setBulkUploading(true)
        try {
            const result = await bulkAddHospitalDoctors(selectedHospitalForDoctor._id, bulkPreview.preview)
            if (result) {
                setBulkResults(result.results)
                setBulkPreview(null)
                setBulkFile(null)
                setShowBulkPreview(false)
                setShowBulkUploadModal(false)
            }
        } catch (error) {
            toast.error(error.message || 'Failed to upload doctors')
        } finally {
            setBulkUploading(false)
        }
    }

    // --- UTILS ---
    const resetForm = () => {
        setFormData({
            name: '',
            address: '',
            mapsLink: '',
            contact: '',
            specialization: '',
            type: 'General',
            showOnHome: false
        })
        setEditingHospital(null)
    }

    const resetDoctorForm = () => {
        setDoctorFormData({
            name: '',
            qualification: '',
            specialization: '',
            experience: 0,
            available: true
        })
        setEditingDoctor(null)
    }

    return (
        <AdminPageLayout>
                <PageHero
                    title="Hospital Tie ups"
                    subtitle="Manage partner hospitals, agreements, and doctor hierarchies across the network."
                    features={['Centralized Control', 'Multi-Hospital View', 'Better Patient Flow']}
                />

                <div className="mc-kpi-grid mc-kpi-grid--4">
                    <KpiCard label="Total Partners" value={hospitals?.length || 0} iconBg="bg-sky-100 text-sky-600"
                        icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>}
                    />
                    <KpiCard label="Active Tie-ups" value={hospitals?.filter(h => h.showOnHome).length || 0} iconBg="bg-emerald-100 text-emerald-600"
                        icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                    />
                </div>

                <FilterToolbar
                    actions={
                        <>
                        <McButton variant="outline" onClick={async () => {
                                if (window.confirm('This will migrate all embedded doctors (with emails) to the doctors collection. Continue?')) {
                                    await migrateEmbeddedDoctors()
                                }
                            }}
                        >
                            Migrate Doctors
                        </McButton>
                        <McButton onClick={() => navigate('/hospital-wizard')}>
                            + Add Partnership
                        </McButton>
                        </>
                    }
                />

                {loading ? (
                    <div className='text-center py-12'><p className='text-gray-500'>Loading...</p></div>
                ) : hospitals.length === 0 ? (
                    <GlassCard className='p-8 text-center bg-white/80 border border-dashed border-gray-300 rounded-2xl'>
                        <p className='text-gray-500 text-sm'>No hospitals found. Click <span className='font-semibold text-indigo-600'>“Add Hospital”</span> to create your first partner.</p>
                    </GlassCard>
                ) : (
                    <div className='space-y-4'>
                        {hospitals.map((hospital) => (
                            <GlassCard key={hospital._id} className='overflow-hidden bg-white/90 border border-gray-100 rounded-2xl shadow-sm hover:shadow-md transition-shadow'>
                                {/* Hospital Row Header */}
                                <div className='p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4'>
                                    <div className='flex-1 cursor-pointer' onClick={() => setExpandedHospitalId(expandedHospitalId === hospital._id ? null : hospital._id)}>
                                        <div className='flex items-center gap-2 mb-1'>
                                            <h3 className='text-lg font-semibold text-gray-900'>{hospital.name}</h3>
                                            <span className={`text-xs px-2 py-0.5 rounded-full ${hospital.type === 'Teaching Hospital' ? 'bg-purple-100 text-purple-700' : 'bg-blue-50 text-blue-600'}`}>
                                                {hospital.type}
                                            </span>
                                        </div>
                                        <div className='text-sm text-gray-600 flex flex-wrap gap-x-4 gap-y-1'>
                                            <span className='flex items-center gap-1'><svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>{hospital.address}</span>
                                            <span className='flex items-center gap-1'><svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>{hospital.contact}</span>
                                        </div>
                                        <div className='mt-2 text-xs text-blue-600 font-medium flex items-center gap-1 hover:underline'>
                                            {expandedHospitalId === hospital._id ? 'Hide Doctors' : `View Doctors (${hospital.doctors?.length || 0})`}
                                            <svg className={`w-4 h-4 transition-transform ${expandedHospitalId === hospital._id ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                        </div>
                                    </div>

                                    <div className='flex items-center gap-4 border-t sm:border-t-0 sm:border-l border-gray-100 pt-3 sm:pt-0 sm:pl-4 mt-2 sm:mt-0'>
                                        <div className='flex flex-col items-center'>
                                            <span className='text-[10px] text-gray-500 uppercase tracking-wider font-semibold mb-1'>Home Page</span>
                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <input type="checkbox" checked={hospital.showOnHome} onChange={() => handleToggleVisibility(hospital)} className="sr-only peer" />
                                                <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-green-600"></div>
                                            </label>
                                        </div>
                                        <div className='flex items-center gap-2'>
                                            <button onClick={() => handleEdit(hospital)} className='p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors'><svg className='w-5 h-5' fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg></button>
                                            <button onClick={() => handleDelete(hospital._id)} className='p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors'><svg className='w-5 h-5' fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                                        </div>
                                    </div>
                                </div>

                                {/* Doctors Section (Expandable) */}
                                {expandedHospitalId === hospital._id && (
                                    <div className='bg-gray-50/70 border-t border-gray-100 p-3 sm:p-5'>
                                        <div className='flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-5'>
                                            <div>
                                                <h4 className='font-bold text-gray-800 text-sm uppercase tracking-widest'>Medical Staff Directory</h4>
                                                <p className='text-[10px] text-gray-400 font-medium'>Manage specialized doctors practicing at this facility</p>
                                            </div>
                                            <div className='flex items-center gap-2 w-full sm:w-auto'>
                                                <button onClick={() => handleBulkUploadClick(hospital)} className='flex-1 sm:flex-none text-xs bg-indigo-600 text-white px-3 py-2 rounded-lg shadow-sm hover:bg-indigo-700 transition-all flex items-center justify-center gap-1.5 font-bold'>
                                                    <svg className='w-3.5 h-3.5' fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg> Bulk Add
                                                </button>
                                                <button onClick={() => handleAddDoctor(hospital)} className='flex-1 sm:flex-none text-xs bg-white border border-indigo-200 text-indigo-600 px-3 py-2 rounded-lg shadow-sm hover:bg-indigo-50 transition-all flex items-center justify-center gap-1.5 font-bold'>
                                                    <svg className='w-3.5 h-3.5' fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg> Individual Add
                                                </button>
                                            </div>
                                        </div>

                                        {(!hospital.doctors || hospital.doctors.length === 0) ? (
                                            <div className='py-12 bg-white/50 rounded-2xl border-2 border-dashed border-gray-200 text-center'>
                                                <p className='text-3xl mb-2'>👨‍⚕️</p>
                                                <p className='text-sm text-gray-500 font-bold'>No staff registered yet.</p>
                                                <p className='text-[10px] text-gray-400 mt-1'>Add specialized doctors to enable appointments for this hospital.</p>
                                            </div>
                                        ) : (
                                            <>
                                                {/* Desktop Table */}
                                                <div className='hidden lg:block overflow-x-auto bg-white rounded-2xl border border-gray-100 shadow-sm'>
                                                    <table className='w-full text-sm text-left'>
                                                        <thead className='text-[11px] text-gray-400 font-bold uppercase tracking-widest bg-gray-50/80 border-b border-gray-100'>
                                                            <tr>
                                                                <th className='px-5 py-4'>Doctor Details</th>
                                                                <th className='px-5 py-4'>Clinical Expertise</th>
                                                                <th className='px-5 py-4 text-center'>Experience</th>
                                                                <th className='px-5 py-4 text-center'>Public Status</th>
                                                                <th className='px-5 py-4 text-right'>Management</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className='divide-y divide-gray-50 bg-white/40'>
                                                            {hospital.doctors.map(doctor => (
                                                                <tr key={doctor._id} className='hover:bg-indigo-50/30 transition-colors group'>
                                                                    <td className='px-5 py-4'>
                                                                        <div className='flex items-center gap-3'>
                                                                            <div className='w-9 h-9 bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-700 font-bold text-xs'>
                                                                                {(doctor.name || 'D')[0]}
                                                                            </div>
                                                                            <div>
                                                                                <p className='font-bold text-gray-800'>{doctor.name}</p>
                                                                                <p className='text-[10px] text-gray-400 font-semibold'>{doctor.qualification}</p>
                                                                            </div>
                                                                        </div>
                                                                    </td>
                                                                    <td className='px-5 py-4'>
                                                                        <span className='px-2.5 py-1 bg-white border border-indigo-100 text-indigo-700 rounded-lg text-xs font-bold shadow-sm'>
                                                                            {doctor.specialization}
                                                                        </span>
                                                                    </td>
                                                                    <td className='px-5 py-4 text-center'>
                                                                        <span className='text-sm font-bold text-gray-700'>{doctor.experience} Yrs</span>
                                                                    </td>
                                                                    <td className='px-5 py-4'>
                                                                        <div className='flex flex-col items-center gap-1.5'>
                                                                            <span className={`inline-flex px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-tighter ${doctor.available ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-red-100 text-red-700 border border-red-200'}`}>
                                                                                {doctor.available ? 'Active' : 'Offline'}
                                                                            </span>
                                                                            <label className="relative inline-flex items-center cursor-pointer scale-90">
                                                                                <input type="checkbox" checked={doctor.showOnHospitalPage} onChange={() => handleToggleDoctorVisibility(hospital, doctor)} className="sr-only peer" />
                                                                                <div className="w-8 h-4.5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-blue-600"></div>
                                                                            </label>
                                                                        </div>
                                                                    </td>
                                                                    <td className='px-5 py-4 text-right'>
                                                                        <div className='flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity'>
                                                                            <button onClick={() => handleViewProfile(hospital, doctor)} className='p-2 bg-white text-gray-500 hover:text-indigo-600 rounded-xl border border-gray-100 hover:border-indigo-200 shadow-sm transition-all'>
                                                                                <svg className='w-4 h-4' fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                                                            </button>
                                                                            <button onClick={() => handleEditDoctor(hospital, doctor)} className='p-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-xl transition-all border border-indigo-100'>
                                                                                <svg className='w-4 h-4' fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                                                            </button>
                                                                            <button onClick={() => handleDeleteDoctor(hospital, doctor._id)} className='p-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl transition-all border border-red-100'>
                                                                                <svg className='w-4 h-4' fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                                            </button>
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>

                                                {/* Mobile Cards for Doctors */}
                                                <div className='lg:hidden space-y-3'>
                                                    {hospital.doctors.map(doctor => (
                                                        <div key={doctor._id} className='bg-white p-4 rounded-2xl border border-gray-100 shadow-sm'>
                                                            <div className='flex items-center justify-between mb-4'>
                                                                <div className='flex items-center gap-3'>
                                                                    <div className='w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-700 font-bold'>
                                                                        {(doctor.name || 'D')[0]}
                                                                    </div>
                                                                    <div>
                                                                        <p className='font-bold text-gray-800 text-sm'>{doctor.name}</p>
                                                                        <p className='text-[10px] text-gray-400 font-bold uppercase tracking-tight'>{doctor.qualification}</p>
                                                                    </div>
                                                                </div>
                                                                <div className='flex items-center gap-1'>
                                                                    <button onClick={() => handleEditDoctor(hospital, doctor)} className='p-2 bg-indigo-50 text-indigo-600 rounded-lg anim-scale'>
                                                                        <svg className='w-4 h-4' fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                                                    </button>
                                                                    <button onClick={() => handleDeleteDoctor(hospital, doctor._id)} className='p-2 bg-red-50 text-red-600 rounded-lg anim-scale'>
                                                                        <svg className='w-4 h-4' fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                                    </button>
                                                                </div>
                                                            </div>

                                                            <div className='grid grid-cols-2 gap-2 mb-3'>
                                                                <div className='p-2 bg-gray-50/80 rounded-xl border border-gray-100 shadow-inner'>
                                                                    <p className='text-[9px] uppercase font-bold text-gray-400 tracking-wider mb-0.5'>Expertise</p>
                                                                    <p className='text-xs font-bold text-indigo-600 truncate'>{doctor.specialization}</p>
                                                                </div>
                                                                <div className='p-2 bg-gray-50/80 rounded-xl border border-gray-100 shadow-inner'>
                                                                    <p className='text-[9px] uppercase font-bold text-gray-400 tracking-wider mb-0.5'>Experience</p>
                                                                    <p className='text-xs font-bold text-gray-800'>{doctor.experience} Years</p>
                                                                </div>
                                                            </div>

                                                            <div className='flex items-center justify-between pt-3 border-t border-gray-50'>
                                                                <div className='flex items-center gap-2'>
                                                                    <span className={`w-2 h-2 rounded-full ${doctor.available ? 'bg-green-500' : 'bg-red-500'}`}></span>
                                                                    <span className='text-[11px] font-bold text-gray-500 capitalize'>{doctor.available ? 'Ready' : 'Unavailable'}</span>
                                                                </div>
                                                                <div className='flex items-center gap-2'>
                                                                    <span className='text-[10px] font-bold text-gray-400'>Home Visibility</span>
                                                                    <label className="relative inline-flex items-center cursor-pointer scale-75">
                                                                        <input type="checkbox" checked={doctor.showOnHospitalPage} onChange={() => handleToggleDoctorVisibility(hospital, doctor)} className="sr-only peer" />
                                                                        <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                                                                    </label>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                )}
                            </GlassCard>
                        ))}
                    </div>
                )}

                {/* Hospital Modal */}
                {showModal && (
                    <div className='fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4' onClick={() => setShowModal(false)}>
                        <div className='bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden' onClick={(e) => e.stopPropagation()}>
                            {/* Header */}
                            <div className='bg-gradient-to-r from-indigo-500 to-purple-600 px-5 py-3 flex items-center justify-between'>
                                <h2 className='text-lg font-bold text-white flex items-center gap-2'>
                                    <svg className='w-5 h-5 text-white' fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                    </svg>
                                    {editingHospital ? 'Edit Hospital' : 'Add New Hospital'}
                                </h2>
                                <button
                                    onClick={() => setShowModal(false)}
                                    className='text-white/80 hover:text-white transition-colors p-1 rounded-full hover:bg-white/20'
                                >
                                    <svg className='w-5 h-5' fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            {/* Form */}
                            <form onSubmit={handleSubmit} className='p-5 space-y-3.5'>
                                <div className='flex flex-col gap-1.5'>
                                    <label className='text-xs font-semibold text-gray-700 flex items-center gap-1.5'>
                                        <span className='text-red-500'>*</span>
                                        Hospital Name
                                    </label>
                                    <input
                                        type='text'
                                        placeholder='Enter hospital name'
                                        className='w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all bg-white'
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        required
                                    />
                                </div>

                                <div className='flex flex-col gap-1.5'>
                                    <label className='text-xs font-semibold text-gray-700 flex items-center gap-1.5'>
                                        <span className='text-red-500'>*</span>
                                        Location / Address
                                    </label>
                                    <input
                                        type='text'
                                        placeholder='Enter full address'
                                        className='w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all bg-white'
                                        value={formData.address}
                                        onChange={e => setFormData({ ...formData, address: e.target.value })}
                                        required
                                    />
                                </div>

                                <div className='flex flex-col gap-1.5'>
                                    <label className='text-xs font-semibold text-gray-700'>
                                        Google Maps Link
                                    </label>
                                    <input
                                        type='url'
                                        placeholder='https://maps.app.goo.gl/... or https://www.google.com/maps/place/...'
                                        className='w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all bg-white'
                                        value={formData.mapsLink}
                                        onChange={e => setFormData({ ...formData, mapsLink: e.target.value })}
                                    />
                                    <p className='text-[11px] text-gray-500 leading-snug'>
                                        Paste the share link from Google Maps. Patients use this for Navigate on the hospital page.
                                    </p>
                                </div>

                                <div className='grid grid-cols-2 gap-3'>
                                    <div className='flex flex-col gap-1.5'>
                                        <label className='text-xs font-semibold text-gray-700 flex items-center gap-1.5'>
                                            <span className='text-red-500'>*</span>
                                            Contact Number
                                        </label>
                                        <input
                                            type='text'
                                            placeholder='Enter contact'
                                            className='w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all bg-white'
                                            value={formData.contact}
                                            onChange={e => setFormData({ ...formData, contact: e.target.value })}
                                            required
                                        />
                                    </div>

                                    <div className='flex flex-col gap-1.5'>
                                        <label className='text-xs font-semibold text-gray-700 flex items-center gap-1.5'>
                                            <span className='text-red-500'>*</span>
                                            Hospital Type
                                        </label>
                                        <select
                                            className='w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all bg-white cursor-pointer'
                                            value={formData.type}
                                            onChange={e => setFormData({ ...formData, type: e.target.value })}
                                        >
                                            <option value="General">General</option>
                                            <option value="Super Specialty">Super Specialty</option>
                                            <option value="Teaching Hospital">Teaching Hospital</option>
                                        </select>
                                    </div>
                                </div>

                                <div className='flex flex-col gap-1.5'>
                                    <label className='text-xs font-semibold text-gray-700 flex items-center gap-1.5'>
                                        <span className='text-red-500'>*</span>
                                        Specialization
                                    </label>
                                    <select
                                        className='w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all bg-white cursor-pointer'
                                        value={formData.specialization}
                                        onChange={e => setFormData({ ...formData, specialization: e.target.value })}
                                        required
                                    >
                                        <option value="">Select Specialization</option>
                                        {specialties.map(specialty => (
                                            <option key={specialty} value={specialty}>
                                                {specialty}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="flex items-center gap-2.5 p-3 bg-indigo-50/50 rounded-lg border border-indigo-100">
                                    <input
                                        type="checkbox"
                                        id="showOnHome"
                                        checked={formData.showOnHome}
                                        onChange={e => setFormData({ ...formData, showOnHome: e.target.checked })}
                                        className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                                    />
                                    <label htmlFor="showOnHome" className="text-xs font-semibold text-gray-700 cursor-pointer">
                                        Show on Home Page
                                    </label>
                                </div>

                                <div className='flex gap-2.5 pt-3 border-t border-gray-200'>
                                    <button
                                        type='button'
                                        onClick={() => setShowModal(false)}
                                        className='flex-1 px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 font-semibold text-gray-700 transition-all'
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type='submit'
                                        className='flex-1 px-4 py-2 text-sm bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-semibold shadow-md hover:shadow-lg transition-all'
                                    >
                                        {editingHospital ? 'Update' : 'Add Hospital'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Doctor Modal */}
                {showDoctorModal && (
                    <div className='fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4' onClick={() => setShowDoctorModal(false)}>
                        <div className='bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto' onClick={(e) => e.stopPropagation()}>
                            {/* Header */}
                            <div className='sticky top-0 bg-gradient-to-r from-indigo-500 to-purple-600 px-6 py-4 rounded-t-2xl flex items-center justify-between z-10'>
                                <div>
                                    <h2 className='text-xl font-bold text-white flex items-center gap-2'>
                                        <div className='bg-white/20 rounded-lg p-1.5'>
                                            <svg className='w-5 h-5 text-white' fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                            </svg>
                                        </div>
                                        {editingDoctor ? 'Edit Doctor' : 'Add New Doctor'}
                                    </h2>
                                    <p className='text-xs text-white/80 mt-1 ml-11'>For {selectedHospitalForDoctor?.name}</p>
                                </div>
                                <button
                                    onClick={() => setShowDoctorModal(false)}
                                    className='text-white/80 hover:text-white transition-colors p-1 rounded-full hover:bg-white/20'
                                >
                                    <svg className='w-6 h-6' fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            {/* Form */}
                            <form onSubmit={handleDoctorSubmit} className='p-6 space-y-5'>
                                <div className='flex flex-col gap-2'>
                                    <label className='text-sm font-bold text-gray-700 flex items-center gap-2'>
                                        <span className='text-indigo-600'>•</span>
                                        Doctor Name
                                    </label>
                                    <input
                                        type='text'
                                        placeholder='Enter doctor full name'
                                        className='w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all duration-200 hover:border-indigo-300 bg-white shadow-sm'
                                        value={doctorFormData.name}
                                        onChange={e => setDoctorFormData({ ...doctorFormData, name: e.target.value })}
                                        required
                                    />
                                </div>

                                <div className='flex flex-col gap-2'>
                                    <label className='text-sm font-bold text-gray-700 flex items-center gap-2'>
                                        <span className='text-indigo-600'>•</span>
                                        Qualification
                                    </label>
                                    <input
                                        type='text'
                                        placeholder='e.g., MBBS, MD, MS'
                                        className='w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all duration-200 hover:border-indigo-300 bg-white shadow-sm'
                                        value={doctorFormData.qualification}
                                        onChange={e => setDoctorFormData({ ...doctorFormData, qualification: e.target.value })}
                                        required
                                    />
                                </div>

                                <div className='flex flex-col gap-2'>
                                    <label className='text-sm font-bold text-gray-700 flex items-center gap-2'>
                                        <span className='text-indigo-600'>•</span>
                                        Specialization
                                    </label>
                                    <input
                                        type='text'
                                        placeholder='Enter specialization'
                                        className='w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all duration-200 hover:border-indigo-300 bg-white shadow-sm'
                                        value={doctorFormData.specialization}
                                        onChange={e => setDoctorFormData({ ...doctorFormData, specialization: e.target.value })}
                                        required
                                    />
                                </div>

                                <div className='grid grid-cols-2 gap-4'>
                                    <div className='flex flex-col gap-2'>
                                        <label className='text-sm font-bold text-gray-700 flex items-center gap-2'>
                                            <span className='text-indigo-600'>•</span>
                                            Experience (Years)
                                        </label>
                                        <input
                                            type='number'
                                            placeholder='0'
                                            className='w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all duration-200 hover:border-indigo-300 bg-white shadow-sm'
                                            value={doctorFormData.experience}
                                            onChange={e => setDoctorFormData({ ...doctorFormData, experience: e.target.value })}
                                            required
                                            min="0"
                                        />
                                    </div>
                                    <div className='flex flex-col justify-end'>
                                        <div className="flex items-center gap-3 p-4 bg-green-50/50 rounded-xl border border-green-100 h-full">
                                            <input
                                                type="checkbox"
                                                checked={doctorFormData.available}
                                                onChange={e => setDoctorFormData({ ...doctorFormData, available: e.target.checked })}
                                                className="w-5 h-5 rounded border-gray-300 text-green-600 focus:ring-2 focus:ring-green-500 cursor-pointer"
                                            />
                                            <label className="text-sm font-semibold text-gray-700 cursor-pointer">
                                                Available
                                            </label>
                                        </div>
                                    </div>
                                </div>

                                <div className='flex gap-3 pt-4 border-t border-gray-200'>
                                    <button
                                        type='button'
                                        onClick={() => setShowDoctorModal(false)}
                                        className='flex-1 px-5 py-3 border-2 border-gray-200 rounded-xl hover:bg-gray-50 font-semibold text-gray-700 transition-all duration-200'
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type='submit'
                                        className='flex-1 px-5 py-3 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-500/30 hover:shadow-xl hover:shadow-indigo-500/40 transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98]'
                                    >
                                        {editingDoctor ? 'Update Doctor' : 'Add Doctor'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
                {/* Doctor Profile View Drawer */}
                <DoctorProfileView
                    doctor={selectedDoctorForProfile}
                    hospital={selectedHospitalForDoctor}
                    isOpen={showProfileView}
                    onClose={() => setShowProfileView(false)}
                />

                {/* Bulk Upload Doctors Modal */}
                {showBulkUploadModal && selectedHospitalForDoctor && (
                    <div className='fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4' onClick={() => {
                        if (!bulkUploading) {
                            setShowBulkUploadModal(false)
                            setBulkFile(null)
                            setBulkPreview(null)
                            setBulkResults(null)
                            setShowBulkPreview(false)
                        }
                    }}>
                        <div className='bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto' onClick={(e) => e.stopPropagation()}>
                            {/* Header */}
                            <div className='sticky top-0 bg-gradient-to-r from-purple-500 to-indigo-600 px-6 py-4 rounded-t-2xl flex items-center justify-between z-10'>
                                <h2 className='text-xl font-bold text-white flex items-center gap-2'>
                                    <div className='bg-white/20 rounded-lg p-1.5'>
                                        <svg className='w-5 h-5 text-white' fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                        </svg>
                                    </div>
                                    Bulk Upload Doctors
                                </h2>
                                <p className='text-xs text-white/80 ml-2'>For {selectedHospitalForDoctor.name}</p>
                                <button
                                    onClick={() => {
                                        if (!bulkUploading) {
                                            setShowBulkUploadModal(false)
                                            setBulkFile(null)
                                            setBulkPreview(null)
                                            setBulkResults(null)
                                            setShowBulkPreview(false)
                                        }
                                    }}
                                    className='text-white/80 hover:text-white transition-colors p-1 rounded-full hover:bg-white/20'
                                    disabled={bulkUploading}
                                >
                                    <svg className='w-6 h-6' fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            {/* Form */}
                            <form onSubmit={handleBulkUploadPreview} className='p-6 space-y-5'>
                                <div className='mb-6'>
                                    <p className='text-sm text-gray-600 mb-4'>
                                        Upload a CSV or Excel file with doctor information. Each doctor will receive login credentials via email.
                                    </p>
                                </div>

                                {/* File Upload */}
                                <div className='mb-6 p-6 bg-gradient-to-br from-indigo-50/50 to-purple-50/50 rounded-2xl border-2 border-dashed border-indigo-200 hover:border-indigo-400 transition-all duration-300'>
                                    <label htmlFor="bulk-file" className='cursor-pointer block text-center'>
                                        <div className='mb-4'>
                                            <svg className='w-16 h-16 mx-auto text-indigo-500' fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                            </svg>
                                        </div>
                                        <p className='text-base font-bold text-gray-800 mb-2'>
                                            {bulkFile ? bulkFile.name : 'Click to select or drag & drop file here'}
                                        </p>
                                        <p className='text-xs text-gray-500'>Supports CSV (.csv) and Excel (.xlsx, .xls) files</p>
                                    </label>
                                    <input
                                        onChange={(e) => setBulkFile(e.target.files[0])}
                                        type="file"
                                        id="bulk-file"
                                        hidden
                                        accept=".csv,.xlsx,.xls"
                                        disabled={bulkUploading}
                                    />
                                </div>

                                {/* CSV Format Guide */}
                                <div className='mb-6 p-5 bg-blue-50 rounded-xl border border-blue-200'>
                                    <h4 className='font-bold text-gray-800 mb-3 flex items-center gap-2'>
                                        <svg className='w-5 h-5 text-blue-600' fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        Required CSV/Excel Columns
                                    </h4>
                                    <div className='text-sm text-gray-700 space-y-1'>
                                        <p><strong>Required:</strong> hospitalName, name, email</p>
                                        <p><strong>Optional:</strong> qualification, specialization, experience</p>
                                        <div className='mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg'>
                                            <p className='text-xs font-semibold text-yellow-800 mb-1'>⚠️ Important:</p>
                                            <p className='text-xs text-yellow-700'>
                                                The <strong>hospitalName</strong> field must match exactly: <strong className='text-indigo-600'>"{selectedHospitalForDoctor?.name}"</strong>
                                            </p>
                                            <p className='text-xs text-yellow-700 mt-1'>
                                                This prevents uploading doctors to the wrong hospital by mistake.
                                            </p>
                                        </div>
                                        <p className='text-xs text-gray-600 mt-2'>
                                            Passwords will be auto-generated (starting with "pms") and sent via email.
                                        </p>
                                    </div>
                                </div>

                                {/* Upload Button */}
                                {!showBulkPreview ? (
                                    <button
                                        type='submit'
                                        disabled={!bulkFile || bulkUploading}
                                        className='w-full mt-4 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 px-10 py-4 text-white rounded-xl shadow-lg shadow-indigo-500/30 hover:shadow-xl hover:shadow-indigo-500/40 transition-all duration-300 font-bold text-base flex items-center justify-center gap-3 transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed'
                                    >
                                        {bulkUploading ? (
                                            <>
                                                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                </svg>
                                                Processing...
                                            </>
                                        ) : (
                                            <>
                                                <svg className='w-5 h-5' fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                </svg>
                                                Preview Doctors
                                            </>
                                        )}
                                    </button>
                                ) : (
                                    <div className='mt-4 space-y-3'>
                                        <button
                                            type='button'
                                            onClick={handleBulkUploadConfirm}
                                            disabled={bulkUploading || !bulkPreview || bulkPreview.preview.length === 0}
                                            className='w-full bg-gradient-to-r from-green-600 to-emerald-600 px-10 py-4 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 font-bold text-base flex items-center justify-center gap-3 transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed'
                                        >
                                            {bulkUploading ? (
                                                <>
                                                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                    </svg>
                                                    Saving...
                                                </>
                                            ) : (
                                                <>
                                                    <svg className='w-5 h-5' fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                                    </svg>
                                                    Confirm & Save to Database ({bulkPreview?.preview?.length || 0} doctors)
                                                </>
                                            )}
                                        </button>
                                        <button
                                            type='button'
                                            onClick={() => {
                                                setShowBulkPreview(false)
                                                setBulkPreview(null)
                                                setBulkFile(null)
                                            }}
                                            className='w-full bg-gray-200 px-10 py-4 text-gray-700 rounded-xl hover:bg-gray-300 transition-all duration-300 font-bold text-base'
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                )}

                                {/* Preview Display */}
                                {showBulkPreview && bulkPreview && (
                                    <div className='mt-6 p-5 bg-blue-50 rounded-xl border-2 border-blue-200'>
                                        <h4 className='font-bold text-gray-800 mb-4 flex items-center gap-2'>
                                            <svg className='w-5 h-5 text-blue-600' fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                            </svg>
                                            Preview - Review Before Saving
                                        </h4>
                                        <div className='space-y-2 text-sm mb-4'>
                                            <p><strong>Total Rows:</strong> {bulkPreview.summary?.total || 0}</p>
                                            <p className='text-green-600'><strong>Valid:</strong> {bulkPreview.summary?.valid || 0} doctors</p>
                                            {bulkPreview.summary?.invalid > 0 && (
                                                <p className='text-red-600'><strong>Invalid:</strong> {bulkPreview.summary.invalid} rows</p>
                                            )}
                                        </div>

                                        {bulkPreview.preview && bulkPreview.preview.length > 0 && (
                                            <div className='max-h-96 overflow-y-auto space-y-2 mb-4'>
                                                {bulkPreview.preview.map((doc, idx) => (
                                                    <div key={idx} className='bg-white p-3 rounded-lg border border-gray-200 text-xs'>
                                                        <div className='flex justify-between items-start mb-2'>
                                                            <div>
                                                                <p className='font-bold text-gray-900'>{doc.name}</p>
                                                                <p className='text-gray-600'>{doc.email}</p>
                                                            </div>
                                                            <span className='bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-semibold'>Valid</span>
                                                        </div>
                                                        <div className='grid grid-cols-2 gap-2 text-gray-600 mt-2'>
                                                            <p><strong>Qualification:</strong> {doc.qualification}</p>
                                                            <p><strong>Specialization:</strong> {doc.specialization}</p>
                                                            <p><strong>Experience:</strong> {doc.experience} years</p>
                                                        </div>
                                                        <div className='mt-2 pt-2 border-t border-gray-200'>
                                                            <p className='text-gray-500'><strong>Password:</strong> <span className='font-mono bg-gray-100 px-2 py-1 rounded'>{doc.password}</span></p>
                                                            <p className='text-gray-500'><strong>Employee ID:</strong> <span className='font-mono bg-gray-100 px-2 py-1 rounded'>{doc.employeeId}</span></p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {bulkPreview.errors && bulkPreview.errors.length > 0 && (
                                            <div className='mt-4'>
                                                <p className='text-sm font-semibold text-red-600 mb-2'>Errors Found:</p>
                                                <div className='max-h-40 overflow-y-auto space-y-1'>
                                                    {bulkPreview.errors.map((error, idx) => (
                                                        <div key={idx} className='bg-red-50 p-2 rounded border border-red-200 text-xs'>
                                                            <p><strong>Row {error.row}:</strong> {error.name} ({error.email})</p>
                                                            <p className='text-red-600'>{error.reason}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Results Display */}
                                {bulkResults && !showBulkPreview && (
                                    <div className='mt-6 p-5 bg-gray-50 rounded-xl border border-gray-200'>
                                        <h4 className='font-bold text-gray-800 mb-3'>Upload Results</h4>
                                        <div className='space-y-2 text-sm'>
                                            <p><strong>Total:</strong> {bulkResults?.total || 0} doctors</p>
                                            <p className='text-green-600'><strong>Successful:</strong> {bulkResults?.successful || 0} doctors</p>
                                            {bulkResults?.failed > 0 && (
                                                <p className='text-red-600'><strong>Failed:</strong> {bulkResults.failed} doctors</p>
                                            )}
                                        </div>
                                        {bulkResults.details && bulkResults.details.success && bulkResults.details.success.length > 0 && (
                                            <div className='mt-4'>
                                                <p className='text-xs font-semibold text-gray-600 mb-2'>Successfully Created:</p>
                                                <div className='max-h-40 overflow-y-auto space-y-1'>
                                                    {bulkResults.details.success.slice(0, 10).map((doc, idx) => (
                                                        <div key={idx} className='text-xs bg-green-50 p-2 rounded border border-green-200'>
                                                            <p><strong>{doc.name}</strong> ({doc.email})</p>
                                                            <p className='text-gray-600'>Password: {doc.password} | ID: {doc.employeeId}</p>
                                                        </div>
                                                    ))}
                                                    {bulkResults.details.success.length > 10 && (
                                                        <p className='text-xs text-gray-500'>... and {bulkResults.details.success.length - 10} more</p>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </form>
                        </div>
                    </div>
                )}
        </AdminPageLayout>
    )
}

export default HospitalTieUps
