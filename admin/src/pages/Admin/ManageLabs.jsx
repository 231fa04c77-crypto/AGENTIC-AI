import React, { useContext, useEffect, useState } from 'react'
import { AdminContext } from '../../context/AdminContext'
import { toast } from 'react-toastify'
import { AdminPageLayout, PageHero, KpiCard, FilterToolbar, McButton } from '../../components/mc'

const ManageLabs = () => {
    const { labs, getAllLabs, addLab, updateLab, deleteLab } = useContext(AdminContext)

    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [editingLab, setEditingLab] = useState(null)

    const [formData, setFormData] = useState({
        name: '',
        location: '',
        city: '',
        latitude: '',
        longitude: '',
        rating: 4.5,
        verified: true,
        services: '',
        openNow: true,
        partnerType: 'normal',
        image: ''
    })

    useEffect(() => {
        fetchData()
    }, [])

    const fetchData = async () => {
        setLoading(true)
        await getAllLabs()
        setLoading(false)
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        
        if (!formData.latitude || !formData.longitude) {
            toast.warning('Please provide latitude and longitude for mapping')
        }

        const labData = {
            ...formData,
            latitude: parseFloat(formData.latitude) || 0,
            longitude: parseFloat(formData.longitude) || 0,
            services: formData.services.split(',').map(s => s.trim()).filter(s => s !== '')
        }

        let success
        if (editingLab) {
            success = await updateLab(editingLab.id, labData)
        } else {
            success = await addLab(labData)
        }

        if (success) {
            setShowModal(false)
            resetForm()
        }
    }

    const resetForm = () => {
        setFormData({
            name: '',
            location: '',
            city: '',
            latitude: '',
            longitude: '',
            rating: 4.5,
            verified: true,
            services: '',
            openNow: true,
            partnerType: 'normal',
            image: ''
        })
        setEditingLab(null)
    }

    const handleEdit = (lab) => {
        setEditingLab(lab)
        setFormData({
            name: lab.name,
            location: lab.location,
            city: lab.city,
            latitude: lab.latitude,
            longitude: lab.longitude,
            rating: lab.rating,
            verified: lab.verified,
            services: Array.isArray(lab.services) ? lab.services.join(', ') : lab.services,
            openNow: lab.open_now,
            partnerType: lab.partner_type || 'normal',
            image: lab.image || ''
        })
        setShowModal(true)
    }

    const verifiedCount = labs.filter(l => l.verified).length
    const partnerCount = labs.filter(l => l.partner_type === 'partner').length
    const openCount = labs.filter(l => l.open_now).length

    return (
        <AdminPageLayout>
                <PageHero
                    title="Labs"
                    subtitle="Manage and monitor connected diagnostic labs and test operations."
                    features={['Real-time Lab Connectivity', 'SLA & TAT Monitoring', 'Report Automation', 'Quality Assurance']}
                />

                <div className="mc-kpi-grid mc-kpi-grid--4">
                    <KpiCard label="Connected Labs" value={labs.length} iconBg="bg-sky-100 text-sky-600"
                        icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>}
                    />
                    <KpiCard label="Verified Labs" value={verifiedCount} iconBg="bg-emerald-100 text-emerald-600"
                        icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                    />
                    <KpiCard label="Elite Partners" value={partnerCount} iconBg="bg-violet-100 text-violet-600"
                        icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.783-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>}
                    />
                    <KpiCard label="Operational Now" value={openCount} iconBg="bg-amber-100 text-amber-600"
                        icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                    />
                </div>

                <FilterToolbar
                    actions={<McButton onClick={() => { resetForm(); setShowModal(true) }}>+ Register New Lab</McButton>}
                >
                    <span className="text-sm text-mc-text-muted">Diagnostic Lab Management</span>
                </FilterToolbar>

                {loading ? (
                    <div className='flex flex-col items-center justify-center py-32 space-y-4'>
                        <div className='w-12 h-12 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin'></div>
                        <p className='text-gray-400 font-medium animate-pulse'>Fetching lab directory...</p>
                    </div>
                ) : labs.length === 0 ? (
                    <div className='text-center py-32 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200'>
                        <div className='bg-indigo-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4'>
                            <svg className='w-10 h-10 text-indigo-500' fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.183.394l-1.154.908a2 2 0 01-2.003.882l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517" />
                            </svg>
                        </div>
                        <h3 className='text-xl font-bold text-gray-800'>No Labs Registered</h3>
                        <p className='text-gray-500 mt-2'>Connect with diagnostic centres to expand your healthcare network.</p>
                    </div>
                ) : (
                    <div className='grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3'>
                        {labs.map(lab => (
                            <div key={lab.id} className='group bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-md hover:border-teal-200 transition-all overflow-hidden flex flex-col'>
                                <div className='h-16 bg-gradient-to-r from-slate-800 via-teal-800 to-sky-800 relative overflow-hidden'>
                                    {lab.image ? (
                                        <img src={lab.image} className='w-full h-full object-cover opacity-50' alt={lab.name} />
                                    ) : null}
                                    <div className='absolute inset-0 flex items-center justify-between px-3'>
                                        <div className='flex items-center gap-1.5'>
                                            {lab.verified && (
                                                <span className='bg-emerald-500 text-white p-1 rounded-full'>
                                                    <svg className='w-3 h-3' fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                                                </span>
                                            )}
                                            <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider ${lab.partner_type === 'partner' ? 'bg-white/90 text-teal-700' : 'bg-black/25 text-white'}`}>
                                                {lab.partner_type || 'NORMAL'}
                                            </span>
                                        </div>
                                        <span className='text-[10px] font-bold text-white/80'>{lab.rating || 4.5}★</span>
                                    </div>
                                </div>

                                <div className='p-3.5 flex flex-col flex-1 gap-2.5'>
                                    <div>
                                        <h3 className='text-sm font-bold text-rd-text truncate'>{lab.name}</h3>
                                        <p className='text-[11px] text-rd-muted truncate mt-0.5'>{lab.location}, {lab.city}</p>
                                    </div>

                                    <div className='flex flex-wrap gap-1'>
                                        {Array.isArray(lab.services) && lab.services.slice(0, 3).map(service => (
                                            <span key={service} className='text-[9px] bg-slate-50 text-slate-600 px-2 py-0.5 rounded-md font-semibold uppercase'>{service}</span>
                                        ))}
                                        {Array.isArray(lab.services) && lab.services.length > 3 && (
                                            <span className='text-[9px] bg-slate-50 text-slate-400 px-2 py-0.5 rounded-md font-bold'>+{lab.services.length - 3}</span>
                                        )}
                                    </div>

                                    <div className='flex items-center gap-2 mt-auto pt-1'>
                                        <button 
                                            onClick={() => handleEdit(lab)} 
                                            className='flex-[2] py-2 px-3 bg-teal-50 text-teal-800 text-xs font-bold rounded-lg hover:bg-teal-100 transition-colors'
                                        >
                                            Edit
                                        </button>
                                        <button 
                                            onClick={() => {
                                                if(window.confirm('Remove this lab permanently?')) deleteLab(lab.id)
                                            }} 
                                            className='py-2 px-3 flex items-center justify-center bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-100 transition-colors'
                                        >
                                            <svg className='w-4 h-4' fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Lab Modal */}
                {showModal && (
                    <div className='fixed inset-0 bg-black/60 backdrop-blur-md z-[100] flex items-center justify-center p-4 sm:p-6 overflow-y-auto'>
                        <div className='bg-white rounded-[2rem] shadow-2xl w-full max-w-3xl overflow-hidden my-auto animate-modal-in'>
                            <div className='bg-gradient-to-r from-indigo-600 to-purple-700 px-8 py-6 flex items-center justify-between'>
                                <div>
                                    <h2 className='text-2xl font-black text-white tracking-tight'>{editingLab ? 'Update Lab Registry' : 'Establish New Lab'}</h2>
                                    <p className='text-indigo-100 text-xs font-medium mt-1'>Configure diagnostic services and verify credentials.</p>
                                </div>
                                <button onClick={() => setShowModal(false)} className='bg-white/20 hover:bg-white/30 text-white p-2 rounded-xl transition-colors'>
                                    <svg className='w-6 h-6' fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className='p-8 space-y-8 h-[75vh] overflow-y-auto scrollbar-hide'>
                                <div className='space-y-6'>
                                    <h3 className='text-sm font-black text-gray-400 uppercase tracking-widest flex items-center gap-2'>
                                        <span className='w-8 h-px bg-gray-200'></span> Directory Information
                                    </h3>
                                    
                                    <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
                                        <div className='md:col-span-2'>
                                            <label className='block text-[11px] font-black text-gray-500 uppercase tracking-wider mb-2 ml-1'>Full Name of Lab</label>
                                            <input type='text' required placeholder='e.g. Apollo Diagnostics & Research Lab' className='w-full px-5 py-4 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-medium' value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                                        </div>

                                        <div className='md:col-span-2'>
                                            <label className='block text-[11px] font-black text-gray-500 uppercase tracking-wider mb-2 ml-1'>Image URL</label>
                                            <input type='text' placeholder='https://...' className='w-full px-5 py-4 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-medium' value={formData.image} onChange={e => setFormData({ ...formData, image: e.target.value })} />
                                        </div>

                                        <div>
                                            <label className='block text-[11px] font-black text-gray-500 uppercase tracking-wider mb-2 ml-1'>Street Address</label>
                                            <input type='text' required placeholder='Locality, Building...' className='w-full px-5 py-4 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-medium' value={formData.location} onChange={e => setFormData({ ...formData, location: e.target.value })} />
                                        </div>
                                        <div>
                                            <label className='block text-[11px] font-black text-gray-500 uppercase tracking-wider mb-2 ml-1'>City</label>
                                            <input type='text' required placeholder='City' className='w-full px-5 py-4 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-medium' value={formData.city} onChange={e => setFormData({ ...formData, city: e.target.value })} />
                                        </div>
                                    </div>
                                </div>

                                <div className='space-y-6'>
                                    <h3 className='text-sm font-black text-gray-400 uppercase tracking-widest flex items-center gap-2'>
                                        <span className='w-8 h-px bg-gray-200'></span> Mapping & Tier
                                    </h3>
                                    <div className='grid grid-cols-1 md:grid-cols-3 gap-6'>
                                        <div>
                                            <label className='block text-[11px] font-black text-gray-500 uppercase tracking-wider mb-2 ml-1'>Latitude</label>
                                            <input type='number' step="any" required placeholder='Latitude' className='w-full px-5 py-4 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-medium' value={formData.latitude} onChange={e => setFormData({ ...formData, latitude: e.target.value })} />
                                        </div>
                                        <div>
                                            <label className='block text-[11px] font-black text-gray-500 uppercase tracking-wider mb-2 ml-1'>Longitude</label>
                                            <input type='number' step="any" required placeholder='Longitude' className='w-full px-5 py-4 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-medium' value={formData.longitude} onChange={e => setFormData({ ...formData, longitude: e.target.value })} />
                                        </div>
                                        <div>
                                            <label className='block text-[11px] font-black text-gray-500 uppercase tracking-wider mb-2 ml-1'>Lab Rating (0-5)</label>
                                            <input type='number' step="0.1" min="0" max="5" required placeholder='4.5' className='w-full px-5 py-4 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-medium' value={formData.rating} onChange={e => setFormData({ ...formData, rating: e.target.value })} />
                                        </div>
                                        <div>
                                            <label className='block text-[11px] font-black text-gray-500 uppercase tracking-wider mb-2 ml-1'>Partnership Tier</label>
                                            <select className='w-full px-5 py-[1.12rem] bg-gray-50 border-2 border-gray-100 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-bold appearance-none cursor-pointer' value={formData.partnerType} onChange={e => setFormData({ ...formData, partnerType: e.target.value })}>
                                                <option value="normal">Standard Vendor</option>
                                                <option value="partner">Elite Partner</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                <div className='space-y-6'>
                                    <h3 className='text-sm font-black text-gray-400 uppercase tracking-widest flex items-center gap-2'>
                                        <span className='w-8 h-px bg-gray-200'></span> Service Metrics
                                    </h3>
                                    <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
                                        <div className='md:col-span-2'>
                                            <label className='block text-[11px] font-black text-gray-500 uppercase tracking-wider mb-2 ml-1'>Offered Services (Comma Separated)</label>
                                            <input type='text' placeholder='Blood Test, MRI, CT Scan, X-Ray, Pathology' className='w-full px-5 py-4 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-medium' value={formData.services} onChange={e => setFormData({ ...formData, services: e.target.value })} />
                                        </div>
                                        <div className='flex gap-6 pt-4'>
                                            <div className='flex items-center gap-3 group cursor-pointer'>
                                                <input type='checkbox' id='verified' className='w-6 h-6 rounded-lg text-green-500 focus:ring-green-500 transition-all cursor-pointer' checked={formData.verified} onChange={e => setFormData({ ...formData, verified: e.target.checked })} />
                                                <label htmlFor='verified' className='text-sm font-black text-gray-700 cursor-pointer group-hover:text-green-600 transition-colors'>Certified & Verified</label>
                                            </div>
                                            <div className='flex items-center gap-3 group cursor-pointer'>
                                                <input type='checkbox' id='openNow' className='w-6 h-6 rounded-lg text-indigo-500 focus:ring-indigo-500 transition-all cursor-pointer' checked={formData.openNow} onChange={e => setFormData({ ...formData, openNow: e.target.checked })} />
                                                <label htmlFor='openNow' className='text-sm font-black text-gray-700 cursor-pointer group-hover:text-indigo-600 transition-colors'>Currently Operational</label>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className='flex gap-4 pt-6 pb-2'>
                                    <button type='button' onClick={() => setShowModal(false)} className='flex-1 py-5 border-2 border-gray-100 rounded-2xl font-bold text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-all active:scale-95'>Close</button>
                                    <button type='submit' className='flex-[2] py-5 bg-gradient-to-r from-indigo-600 to-purple-700 text-white rounded-2xl font-black shadow-xl shadow-indigo-200 hover:shadow-indigo-300 hover:-translate-y-1 transition-all active:scale-95'>
                                        {editingLab ? 'Update Lab Details' : 'Authenticate & Save'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
        </AdminPageLayout>
    )
}

export default ManageLabs
