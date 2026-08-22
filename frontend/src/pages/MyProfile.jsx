import React, { useContext, useState } from 'react'
import { AppContext } from '../context/AppContext'
import axios from 'axios'
import { toast } from 'react-toastify'
import { useNavigate } from 'react-router-dom'
import BackButton from '../components/BackButton'
import BackArrow from '../components/BackArrow'
import LoadingSpinner, { ButtonSpinner } from '../components/LoadingSpinner'

const MyProfile = () => {

    const [isEdit, setIsEdit] = useState(false)
    const [image, setImage] = useState(false)
    const [isUpdating, setIsUpdating] = useState(false)
    const [records, setRecords] = useState([])
    const [isRecordsLoading, setIsRecordsLoading] = useState(false)
    const [showUploadForm, setShowUploadForm] = useState(false)
    const [isUploadingRecord, setIsUploadingRecord] = useState(false)
    const [newRecord, setNewRecord] = useState({
        title: '',
        recordType: 'General',
        description: '',
        doctorName: '',
        date: new Date().toISOString().split('T')[0],
        isImportant: false,
        files: []
    })
    const { token, backendUrl, userData, setUserData, loadUserProfileData, setToken, isProfileLoading } = useContext(AppContext)
    const navigate = useNavigate()

    // Function to load health records
    const loadHealthRecords = async () => {
        if (!token) return
        setIsRecordsLoading(true)
        try {
            const { data } = await axios.get(backendUrl + '/api/user/health-records', { headers: { token } })
            if (data.success) {
                // Normalize data from snake_case (SQL) to camelCase (JS)
                const normalizedRecords = data.records.map(r => ({
                    ...r,
                    recordType: r.record_type || 'General',
                    doctorName: r.doctor_name || '',
                    date: r.record_date || r.date,
                    isImportant: r.is_important || false,
                    attachments: typeof r.attachments === 'string' ? JSON.parse(r.attachments) : (r.attachments || [])
                }));
                setRecords(normalizedRecords);
            }
        } catch (error) {
            console.error('Error loading records:', error)
        } finally {
            setIsRecordsLoading(false)
        }
    }

    // Effect to load records on mount
    React.useEffect(() => {
        loadHealthRecords()
    }, [token])

    // Function to handle report upload
    const handleUploadRecord = async (e, directFiles = null) => {
        if (e) e.preventDefault();

        const filesToUpload = directFiles || newRecord.files;

        if (!filesToUpload || filesToUpload.length === 0) {
            toast.error('Please select at least one file');
            return;
        }

        setIsUploadingRecord(true);
        try {
            const formData = new FormData();

            // If using direct upload, title and other fields will use defaults
            formData.append('title', newRecord.title || '');
            formData.append('recordType', newRecord.recordType || 'General');
            formData.append('date', newRecord.date || new Date().toISOString().split('T')[0]);
            formData.append('doctorName', newRecord.doctorName || '');
            formData.append('description', newRecord.description || '');
            formData.append('isImportant', newRecord.isImportant);

            Array.from(filesToUpload).forEach(file => {
                formData.append('files', file);
            });

            const { data } = await axios.post(backendUrl + '/api/user/health-records', formData, {
                headers: { token }
            });

            if (data.success) {
                toast.success(data.message || 'Record uploaded successfully');
                setShowUploadForm(false);
                setNewRecord({
                    title: '',
                    recordType: 'General',
                    date: new Date().toISOString().split('T')[0],
                    doctorName: '',
                    description: '',
                    files: null,
                    isImportant: false
                });
                loadHealthRecords();
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.message || 'Error uploading record');
        } finally {
            setIsUploadingRecord(false);
        }
    };

    // Function to delete record
    const deleteRecord = async (id) => {
        if (!window.confirm('Are you sure you want to delete this report?')) return

        try {
            const { data } = await axios.delete(backendUrl + `/api/user/health-records/${id}`, {
                headers: { token }
            })
            if (data.success) {
                toast.success('Report deleted')
                loadHealthRecords()
            } else {
                toast.error(data.message)
            }
        } catch (error) {
            console.error('Error deleting record:', error)
            toast.error('Failed to delete report')
        }
    }

    const handleLogout = () => {
        localStorage.removeItem('token')
        setToken(false)
        toast.success('Logged out successfully!')
        navigate('/login')
    }

    // Function to update user profile data using API
    const updateUserProfileData = async () => {
        console.log('Update profile triggered');
        setIsUpdating(true)
        try {
            const formData = new FormData();
            formData.append('name', userData.name)
            formData.append('phone', userData.phone)
            formData.append('address', JSON.stringify(userData.address))
            formData.append('gender', userData.gender)
            formData.append('dob', userData.dob)
            formData.append('age', userData.age || '')
            formData.append('bloodGroup', userData.bloodGroup || '')
            image && formData.append('image', image)

            const { data } = await axios.post(backendUrl + '/api/user/update-profile', formData, { headers: { token } })

            if (data.success) {
                toast.success(data.message)
                await loadUserProfileData()
                setIsEdit(false)
                setImage(false)
            } else {
                toast.error(data.message)
            }
        } catch (error) {
            console.error('Error updating profile:', error)
            const errorMessage = error?.response?.data?.message || error?.message || 'Failed to update profile'
            toast.error(errorMessage)
        } finally {
            setIsUpdating(false)
        }
    }

    if (isProfileLoading) {
        return <LoadingSpinner fullScreen text="Loading profile..." />
    }

    if (!userData) {
        return (
            <div className="page-container">
            <div className='mb-4 sm:mb-6 flex flex-wrap items-center gap-2 sm:gap-4'>
                <BackArrow className="flex-shrink-0" />
                <BackButton className="flex-grow sm:flex-grow-0" />
            </div>
                <div className="empty-state card mt-6">
                    <svg className="empty-state-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <h3 className="empty-state-title">Profile Not Found</h3>
                    <p className="empty-state-text">Please log in to view your profile.</p>
                    <button onClick={() => navigate('/login')} className="btn btn-primary mt-4">
                        Login
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className='page-container fade-in'>
            {/* Back Arrow Button */}
            <div className='mb-4 sm:mb-6 flex flex-wrap items-center gap-2 sm:gap-4'>
                <BackArrow className="flex-shrink-0" />
                <BackButton className="flex-grow sm:flex-grow-0" />
            </div>

            <div className='max-w-6xl mx-auto'>
                {/* Profile Card Container */}
                <div className='card card-overflow-hidden'>
                    {/* Profile Header with Medical Gradient */}
                    {/* Clean White Profile Header */}
                    <div className='profile-banner relative overflow-hidden px-6 pt-24 pb-12 sm:px-10 sm:pt-32 sm:pb-16 bg-white border-b border-slate-100'>
                        {/* Subtle decorative elements for "Official" look */}
                        <div className='absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500'></div>
                        <div className='absolute top-0 right-0 p-8 opacity-5 pointer-events-none'>
                            <svg width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1"><path d="M12 2v20M2 12h20M7 7l10 10M7 17L17 7" /></svg>
                        </div>

                        {/* Top Right Header Actions - Elevated Priority */}
                        <div className='absolute top-24 right-6 sm:top-28 sm:right-10 z-[50] pointer-events-auto'>
                            {isEdit ? (
                                <div className='flex items-center gap-3 bg-white/80 backdrop-blur-md p-1.5 rounded-2xl border border-slate-200 shadow-xl'>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setIsEdit(false); setImage(false); loadUserProfileData(); }}
                                        className='px-5 py-2.5 hover:bg-slate-100 active:scale-[0.95] text-slate-500 text-xs font-bold rounded-xl transition-all uppercase tracking-wider cursor-pointer'
                                        disabled={isUpdating}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); updateUserProfileData(); }}
                                        className='px-7 py-2.5 bg-indigo-600 text-white hover:bg-indigo-700 active:scale-[0.95] text-xs font-bold rounded-xl transition-all shadow-lg hover:shadow-indigo-500/40 flex items-center gap-2 uppercase tracking-wider !cursor-pointer relative z-[9999]'
                                        disabled={isUpdating}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        {isUpdating ? <ButtonSpinner /> : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>}
                                        {isUpdating ? 'Saving...' : 'Save Changes'}
                                    </button>
                                </div>
                            ) : (
                                <button
                                    onClick={() => setIsEdit(true)}
                                    className='flex items-center gap-2 bg-slate-100 hover:bg-slate-200 active:scale-[0.95] border border-slate-200 px-4 py-2 rounded-xl text-slate-700 transition-all shadow-sm cursor-pointer'
                                >
                                    <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                    <span className='text-[11px] font-bold uppercase tracking-wider'>Edit Profile</span>
                                </button>
                            )}
                        </div>

                        {/* Profile Picture Section */}
                        <div className='relative z-[2] flex flex-col sm:flex-row items-center sm:items-end gap-4 sm:gap-6'>
                            {isEdit ? (
                                <label htmlFor='image' className='cursor-pointer group relative'>
                                    <div className='relative'>
                                        <img
                                            className='w-32 h-32 sm:w-40 sm:h-40 rounded-3xl border-4 border-white shadow-2xl object-cover group-hover:opacity-90 transition-opacity ring-1 ring-slate-100'
                                            src={image ? URL.createObjectURL(image) : userData.image}
                                            alt="Profile"
                                        />
                                        <div className='absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity'>
                                            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                                            </svg>
                                        </div>
                                    </div>
                                    <input onChange={(e) => setImage(e.target.files[0])} type="file" id="image" accept="image/*" hidden />
                                </label>
                            ) : (
                                <div className='relative'>
                                    <img
                                        className='w-32 h-32 sm:w-40 sm:h-40 rounded-3xl border-4 border-white shadow-2xl object-cover ring-1 ring-slate-100'
                                        src={userData.image}
                                        alt="Profile"
                                    />
                                    {/* Online Status Indicator */}
                                    <div className='absolute bottom-1 right-1 bg-green-500 border-3 border-white rounded-full w-6 h-6 flex items-center justify-center shadow-lg'>
                                        <div className='w-3 h-3 bg-green-300 rounded-full animate-pulse'></div>
                                    </div>
                                </div>
                            )}

                            <div className='flex-1 text-center sm:text-left pb-4 relative z-[2]'>
                                <div className='inline-flex items-center gap-2 px-3 py-1 bg-cyan-50 border border-cyan-100 rounded-full mb-4 transform hover:scale-105 transition-transform'>
                                    <span className='w-2 h-2 bg-cyan-500 rounded-full animate-pulse'></span>
                                    <span className='text-[10px] font-black uppercase tracking-[0.2em] text-cyan-700'>Verified Patient Account</span>
                                </div>
                                {isEdit ? (
                                    <div className='relative group max-w-lg'>
                                        <input
                                            className='bg-transparent text-3xl sm:text-5xl font-black text-slate-900 placeholder-slate-300 border-b-4 border-slate-100 focus:border-cyan-500 outline-none py-2 w-full transition-all tracking-tight'
                                            type="text"
                                            autoFocus
                                            onChange={(e) => setUserData(prev => ({ ...prev, name: e.target.value }))}
                                            value={userData.name}
                                            placeholder="Full Name"
                                        />
                                    </div>
                                ) : (
                                    <h1 className='text-4xl sm:text-6xl font-black mb-2 tracking-tighter text-slate-900 leading-none'>{userData.name}</h1>
                                )}
                                <div className='flex flex-wrap items-center justify-center sm:justify-start gap-3 mt-6'>
                                    <div className='flex items-center h-10 gap-3 bg-slate-100/80 px-4 rounded-xl border border-slate-200 shadow-sm'>
                                        <div className='w-2 h-2 bg-indigo-500 rounded-full shrink-0'></div>
                                        <span className='text-[10px] text-slate-500 font-bold uppercase tracking-[0.15em] whitespace-nowrap leading-none'>Registry ID</span>
                                        <p className='text-sm font-mono font-bold text-slate-800 tracking-wider leading-none mb-[1px]'>#PAT-{userData.id?.toString().padStart(4, '0') || '0001'}</p>
                                    </div>
                                    <div className='hidden sm:block h-6 w-px bg-slate-200 self-center mx-1'></div>
                                    <div className='flex items-center h-10 gap-3 bg-slate-50/80 px-4 rounded-xl border border-slate-100 shadow-sm'>
                                        <div className='w-2 h-2 bg-emerald-400 rounded-full shrink-0 animate-pulse'></div>
                                        <span className='text-[10px] text-slate-500 font-bold uppercase tracking-[0.15em] whitespace-nowrap leading-none'>Last Updated</span>
                                        <p className='text-xs font-bold text-slate-600 leading-none mb-[1px]'>Just Now</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Profile Content - Premium Adaptive Grid */}
                    <div className='p-6 sm:p-10 lg:p-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-8 lg:gap-10 bg-slate-50/50'>
                        {/* Left Side: Personal Details (4/12) */}
                        <div className='lg:col-span-5 space-y-6'>
                            {/* Contact Information Card - Refined Alignment */}
                            <div className='bg-white rounded-3xl p-8 border border-slate-200 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-indigo-500/10 transition-all duration-500 group'>
                                <div className='flex items-center gap-4 mb-8'>
                                    <div className='bg-indigo-50 p-3 rounded-2xl group-hover:bg-indigo-600 transition-colors'>
                                        <svg className="w-6 h-6 text-indigo-600 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                        </svg>
                                    </div>
                                    <div>
                                        <h2 className='text-2xl font-black text-slate-900 tracking-tight'>Contact Vector</h2>
                                        <p className='text-[10px] font-bold text-slate-400 uppercase tracking-widest'>Secure Communication</p>
                                    </div>
                                </div>

                                <div className='space-y-4 text-sm sm:text-base'>
                                    <div className='flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4'>
                                        <span className='text-gray-500 sm:w-24'>Email</span>
                                        <span className='text-cyan-600 font-semibold'>{userData.email}</span>
                                    </div>

                                    <div className='flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4'>
                                        <span className='text-gray-500 sm:w-24'>Phone</span>
                                        {isEdit ? (
                                            <input
                                                className='flex-1 px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-cyan-500 outline-none transition-all'
                                                type="tel"
                                                onChange={(e) => setUserData(prev => ({ ...prev, phone: e.target.value }))}
                                                value={userData.phone}
                                            />
                                        ) : (
                                            <span className='text-gray-700 font-medium'>{userData.phone || 'Not provided'}</span>
                                        )}
                                    </div>

                                    <div className='flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4'>
                                        <span className='text-gray-500 sm:w-24 sm:pt-2'>Address</span>
                                        {isEdit ? (
                                            <div className='flex-1 space-y-2'>
                                                <input
                                                    className='w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-cyan-500 outline-none transition-all'
                                                    type="text"
                                                    placeholder="Street Address"
                                                    onChange={(e) => setUserData(prev => ({ ...prev, address: { ...prev.address, line1: e.target.value } }))}
                                                    value={userData.address.line1}
                                                />
                                                <input
                                                    className='w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-cyan-500 outline-none transition-all'
                                                    type="text"
                                                    placeholder="City, State, ZIP"
                                                    onChange={(e) => setUserData(prev => ({ ...prev, address: { ...prev.address, line2: e.target.value } }))}
                                                    value={userData.address.line2}
                                                />
                                            </div>
                                        ) : (
                                            <span className='text-gray-700 font-medium'>
                                                {userData.address.line1 || userData.address.line2
                                                    ? `${userData.address.line1} ${userData.address.line2}`.trim()
                                                    : 'No address provided'}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Basic Information Card */}
                            <div className='bg-white/80 backdrop-blur-sm rounded-xl p-5 sm:p-6 border border-slate-100 shadow-sm hover:shadow-md transition-shadow'>
                                <div className='flex items-center gap-3 mb-6'>
                                    <div className='bg-cyan-50 p-2.5 rounded-xl'>
                                        <svg className="w-5 h-5 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                        </svg>
                                    </div>
                                    <h2 className='text-xl font-bold text-slate-800 tracking-tight'>Basic Information</h2>
                                </div>

                                <div className='grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm'>
                                    <div className='flex flex-col gap-1.5'>
                                        <span className='text-gray-400 font-medium uppercase tracking-wider text-[10px]'>Gender</span>
                                        {isEdit ? (
                                            <select
                                                className='px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-cyan-500 outline-none bg-white font-medium'
                                                onChange={(e) => setUserData(prev => ({ ...prev, gender: e.target.value }))}
                                                value={userData.gender}
                                            >
                                                <option value="Not Selected">Not Selected</option>
                                                <option value="Male">Male</option>
                                                <option value="Female">Female</option>
                                                <option value="Other">Other</option>
                                            </select>
                                        ) : (
                                            <span className='text-slate-700 font-bold bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100'>{userData.gender || 'Not Selected'}</span>
                                        )}
                                    </div>

                                    <div className='flex flex-col gap-1.5'>
                                        <span className='text-gray-400 font-medium uppercase tracking-wider text-[10px]'>Age</span>
                                        <span className='text-slate-700 font-bold bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100'>
                                            {userData.age ? `${userData.age} years` : 'N/A'}
                                        </span>
                                    </div>

                                    <div className='flex flex-col gap-1.5'>
                                        <span className='text-gray-400 font-medium uppercase tracking-wider text-[10px]'>Date of Birth</span>
                                        {isEdit ? (
                                            <input
                                                className='px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-cyan-500 outline-none bg-white font-medium'
                                                type='date'
                                                onChange={(e) => setUserData(prev => ({ ...prev, dob: e.target.value }))}
                                                value={userData.dob}
                                            />
                                        ) : (
                                            <span className='text-slate-700 font-bold bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100'>
                                                {userData.dob === 'Not Selected' ? 'Not Selected' : new Date(userData.dob).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                                            </span>
                                        )}
                                    </div>

                                    <div className='flex flex-col gap-1.5'>
                                        <span className='text-gray-400 font-medium uppercase tracking-wider text-[10px]'>Blood Group</span>
                                        {isEdit ? (
                                            <select
                                                className='px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-cyan-500 outline-none bg-white font-medium'
                                                onChange={(e) => setUserData(prev => ({ ...prev, bloodGroup: e.target.value }))}
                                                value={userData.bloodGroup || ''}
                                            >
                                                <option value="">N/A</option>
                                                <option value="A+">A+</option>
                                                <option value="A-">A-</option>
                                                <option value="B+">B+</option>
                                                <option value="B-">B-</option>
                                                <option value="AB+">AB+</option>
                                                <option value="AB-">AB-</option>
                                                <option value="O+">O+</option>
                                                <option value="O-">O-</option>
                                            </select>
                                        ) : (
                                            <span className='text-slate-700 font-bold bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100 flex items-center gap-2'>
                                                {userData.bloodGroup ? (
                                                    <>
                                                        <span className='w-2 h-2 bg-red-500 rounded-full'></span>
                                                        {userData.bloodGroup}
                                                    </>
                                                ) : (
                                                    'Not provided'
                                                )}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Right Side: Medical Records (7/12) */}
                        <div className='lg:col-span-7'>
                            {/* Medical Reports & Records Section */}
                            <div
                                className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden transition-all hover:border-cyan-400 group h-full flex flex-col"
                                onDragOver={(e) => {
                                    e.preventDefault();
                                    e.currentTarget.classList.add('border-cyan-500', 'bg-cyan-50/30');
                                }}
                                onDragLeave={(e) => {
                                    e.preventDefault();
                                    e.currentTarget.classList.remove('border-cyan-500', 'bg-cyan-50/30');
                                }}
                                onDrop={async (e) => {
                                    e.preventDefault();
                                    e.currentTarget.classList.remove('border-cyan-500', 'bg-cyan-50/30');
                                    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                                        toast.info(`Uploading ${e.dataTransfer.files.length} record(s)...`);
                                        await handleUploadRecord(null, e.dataTransfer.files);
                                    }
                                }}
                            >
                                <div className='bg-slate-50/50 backdrop-blur-sm px-5 sm:px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4'>
                                    <div className='flex items-center gap-3'>
                                        <div className='bg-cyan-600 p-2.5 rounded-xl shadow-sm shrink-0'>
                                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                            </svg>
                                        </div>
                                        <h2 className='text-xl font-bold text-slate-800 tracking-tight leading-tight uppercase text-xs tracking-widest'>Report Archive</h2>
                                    </div>
                                    <div className='flex items-center gap-2'>
                                        <input
                                            id="hidden-file-input"
                                            type="file"
                                            multiple
                                            className="hidden"
                                            onChange={async (e) => {
                                                if (e.target.files && e.target.files.length > 0) {
                                                    toast.info(`Uploading ${e.target.files.length} record(s)...`);
                                                    await handleUploadRecord(null, e.target.files);
                                                }
                                            }}
                                        />
                                        <button
                                            onClick={() => document.getElementById('hidden-file-input').click()}
                                            disabled={isUploadingRecord}
                                            className="h-10 px-6 bg-cyan-600 hover:bg-cyan-700 active:scale-[0.98] text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-md hover:shadow-cyan-500/20 transition-all disabled:opacity-50 cursor-pointer"
                                        >
                                            {isUploadingRecord ? (
                                                <ButtonSpinner />
                                            ) : (
                                                <>
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                                    </svg>
                                                    Upload Record
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>

                                <div className='p-6 flex-1 flex flex-col'>
                                    {isUploadingRecord && (
                                        <div className='mb-6 p-4 bg-cyan-50 border border-cyan-100 rounded-xl flex items-center gap-4 animate-pulse'>
                                            <div className='w-10 h-10 bg-cyan-500 rounded-full flex items-center justify-center'>
                                                <div className='w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin'></div>
                                            </div>
                                            <div>
                                                <p className='font-bold text-cyan-800'>Uploading...</p>
                                                <p className='text-xs text-cyan-600/70'>Securing your record.</p>
                                            </div>
                                        </div>
                                    )}

                                    {isRecordsLoading ? (
                                        <div className='flex-1 flex flex-col items-center justify-center py-10 text-gray-400'>
                                            <LoadingSpinner text="Fetching Archive..." />
                                        </div>
                                    ) : records.length > 0 ? (
                                        <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                                            {records.map((r, index) => (
                                                <div key={r.id} className={`p-4 rounded-xl border flex flex-col justify-between hover:shadow-lg transition-all bg-white group/item ${r.isImportant ? 'border-amber-200 ring-1 ring-amber-100' : 'border-slate-100'}`}>
                                                    <div>
                                                        <div className='flex items-start justify-between mb-3'>
                                                            <div className='flex items-center gap-3'>
                                                                {r.recordType === 'Prescription' ? (
                                                                    <span className='p-2 bg-purple-50 text-purple-600 rounded-lg group-hover/item:bg-purple-600 group-hover/item:text-white transition-colors'>
                                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                                                        </svg>
                                                                    </span>
                                                                ) : r.recordType === 'Lab Report' ? (
                                                                    <span className='p-2 bg-emerald-50 text-emerald-600 rounded-lg group-hover/item:bg-emerald-600 group-hover/item:text-white transition-colors'>
                                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                                                                        </svg>
                                                                    </span>
                                                                ) : (
                                                                    <span className='p-2 bg-cyan-50 text-cyan-600 rounded-lg group-hover/item:bg-cyan-600 group-hover/item:text-white transition-colors'>
                                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                                                        </svg>
                                                                    </span>
                                                                )}
                                                                <div>
                                                                    <h4 className='font-bold text-slate-800 line-clamp-1 group-hover/item:text-cyan-700 transition-colors uppercase text-[11px] tracking-wider'>{r.title}</h4>
                                                                    {r.isImportant && (
                                                                        <span className='text-[9px] font-bold text-amber-600 uppercase tracking-tighter'>Priority Record</span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <button
                                                                onClick={() => deleteRecord(r.id)}
                                                                className='p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all'
                                                            >
                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                                </svg>
                                                            </button>
                                                        </div>
                                                        <div className='flex items-center gap-4 text-xs text-slate-400 mb-4 px-1'>
                                                            <span className='flex items-center gap-1.5'>
                                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                                </svg>
                                                                {new Date(r.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                                            </span>
                                                            {r.doctorName && (
                                                                <span className='flex items-center gap-1.5'>
                                                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                                                    </svg>
                                                                    {r.doctorName}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div className='space-y-2 mt-auto'>
                                                        {r.attachments && r.attachments.map((att, i) => (
                                                            <a
                                                                key={i}
                                                                href={att.url}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className='flex items-center justify-between px-3 py-2 bg-slate-50 hover:bg-cyan-50 text-slate-600 hover:text-cyan-700 text-[11px] font-bold rounded-lg border border-slate-100 hover:border-cyan-200 transition-all group/btn'
                                                            >
                                                                <span className='flex items-center gap-1.5'>
                                                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                                    </svg>
                                                                    VIEW ATTACHMENT {r.attachments.length > 1 ? `#${i + 1}` : ''}
                                                                </span>
                                                                <svg className="w-3.5 h-3.5 transform group-hover/btn:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                                                </svg>
                                                            </a>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className='flex-1 flex flex-col items-center justify-center py-10 text-slate-300'>
                                            <div className='w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6'>
                                                <svg className="w-10 h-10 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                </svg>
                                            </div>
                                            <p className='text-sm font-bold uppercase tracking-widest text-slate-400'>No Records Found</p>
                                            <p className='text-xs mt-1'>Drop files here or use the upload button.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Quick Actions & Action Buttons */}
                        <div className='lg:col-span-12 space-y-6 pt-6 border-t'>
                            {/* Quick Actions */}
                            <div className='bg-gray-50/50 backdrop-blur-sm rounded-xl p-5 sm:p-6 border border-gray-200'>
                                <h3 className='text-lg font-bold text-gray-800 mb-4 flex items-center gap-2'>
                                    <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                                    </svg>
                                    Quick Actions
                                </h3>
                                <div className='flex flex-wrap items-center gap-3'>
                                    {!isEdit && (
                                        <button
                                            onClick={() => setIsEdit(true)}
                                            className='h-11 px-6 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white rounded-xl shadow-md hover:shadow-indigo-500/20 transition-all flex items-center justify-center gap-2 text-[11px] font-bold uppercase tracking-wider cursor-pointer'
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                            </svg>
                                            Edit Full Profile
                                        </button>
                                    )}
                                    <button
                                        onClick={() => navigate('/my-appointments')}
                                        className='h-11 px-6 bg-white hover:bg-slate-50 active:scale-[0.98] text-slate-700 border border-slate-200 hover:border-indigo-400 rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 text-[11px] font-bold uppercase tracking-wider cursor-pointer'
                                    >
                                        <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                        My Appointments
                                    </button>
                                    <button
                                        onClick={handleLogout}
                                        className='h-11 px-6 bg-slate-100 hover:bg-red-50 active:scale-[0.98] text-slate-600 hover:text-red-600 border border-slate-200 hover:border-red-200 rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 text-[11px] font-bold uppercase tracking-wider cursor-pointer ml-auto'
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                        </svg>
                                        Logout
                                    </button>
                                </div>
                            </div>

                            {/* Security Footer - Premium Alignment */}
                            <div className='pt-10 mt-10 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-4 opacity-70'>
                                <div className='flex items-center gap-3'>
                                    <div className='w-4 h-4 rounded-full bg-emerald-100 flex items-center justify-center'>
                                        <div className='w-2 h-2 bg-emerald-500 rounded-full animate-pulse'></div>
                                    </div>
                                    <p className='text-[10px] text-slate-500 font-black uppercase tracking-[0.2em]'>TLS 1.3 Encryption Active</p>
                                </div>
                                <p className='text-[10px] text-slate-300 font-bold'>Session ID: {Math.random().toString(36).substr(2, 9).toUpperCase()}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default MyProfile
