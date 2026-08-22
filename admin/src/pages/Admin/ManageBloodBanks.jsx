import React, { useContext, useEffect, useState } from 'react'
import { AdminContext } from '../../context/AdminContext'
import { AppContext } from '../../context/AppContext'
import { toast } from 'react-toastify'
import { AdminPageLayout, PageHero, KpiCard, FilterToolbar, McButton } from '../../components/mc'

const ManageBloodBanks = () => {
    const { bloodBanks, getAllBloodBanks, addBloodBank, updateBloodBank, deleteBloodBank } = useContext(AdminContext)
    const { currency } = useContext(AppContext)

    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [editingBB, setEditingBB] = useState(null)

    const [formData, setFormData] = useState({
        name: '',
        location: '',
        city: '',
        latitude: '',
        longitude: '',
        partnerType: 'normal',
        image: '',
        availableBlood: {
            "A+": "Available",
            "A-": "Limited",
            "B+": "Available",
            "B-": "Unavailable",
            "AB+": "Available",
            "AB-": "Limited",
            "O+": "Available",
            "O-": "Limited"
        }
    })

    const bloodGroups = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]
    const statusOptions = ["Available", "Limited", "Unavailable"]

    useEffect(() => {
        fetchData()
    }, [])

    const fetchData = async () => {
        setLoading(true)
        try {
            await getAllBloodBanks()
        } finally {
            setLoading(false)
        }
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        
        // Validation
        if (!formData.latitude || !formData.longitude) {
            toast.warning('Please provide latitude and longitude for mapping')
        }

        const bbData = {
            ...formData,
            latitude: parseFloat(formData.latitude) || 0,
            longitude: parseFloat(formData.longitude) || 0
        }

        let success
        if (editingBB) {
            success = await updateBloodBank(editingBB.id, bbData)
        } else {
            success = await addBloodBank(bbData)
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
            partnerType: 'normal',
            image: '',
            availableBlood: {
                "A+": "Available",
                "A-": "Available",
                "B+": "Available",
                "B-": "Available",
                "AB+": "Available",
                "AB-": "Available",
                "O+": "Available",
                "O-": "Available"
            }
        })
        setEditingBB(null)
    }

    const handleEdit = (bb) => {
        setEditingBB(bb)
        setFormData({
            name: bb.name,
            location: bb.location,
            city: bb.city,
            latitude: bb.latitude,
            longitude: bb.longitude,
            partnerType: bb.partner_type || 'normal',
            image: bb.image || '',
            availableBlood: typeof bb.available_blood === 'string' ? JSON.parse(bb.available_blood) : bb.available_blood
        })
        setShowModal(true)
    }

    const handleBloodStatusChange = (group, status) => {
        setFormData(prev => ({
            ...prev,
            availableBlood: {
                ...prev.availableBlood,
                [group]: status
            }
        }))
    }

    const partnerCount = bloodBanks.filter(b => b.partner_type === 'partner').length
    const cityCount = new Set(bloodBanks.map(b => b.city).filter(Boolean)).size

    return (
        <AdminPageLayout>
                <PageHero
                    title="Blood Banks"
                    subtitle="Monitor blood bank inventory, requests and ensure timely availability."
                    features={['Real-time Inventory', 'Request Management', 'Expiry Tracking', 'Low Stock Alerts']}
                />

                <div className="mc-kpi-grid mc-kpi-grid--4">
                    <KpiCard label="Available Blood Banks" value={bloodBanks.length} iconBg="bg-rose-100 text-rose-600"
                        icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>}
                    />
                    <KpiCard label="Elite Partners" value={partnerCount} iconBg="bg-violet-100 text-violet-600"
                        icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.783-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>}
                    />
                    <KpiCard label="Cities Covered" value={cityCount} iconBg="bg-sky-100 text-sky-600"
                        icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
                    />
                    <KpiCard label="Blood Groups" value={8} iconBg="bg-amber-100 text-amber-600"
                        icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>}
                    />
                </div>

                <FilterToolbar
                    actions={<McButton onClick={() => { resetForm(); setShowModal(true) }}>+ Add New Blood Bank</McButton>}
                >
                    <span className="text-sm text-mc-text-muted">Blood Bank Management</span>
                </FilterToolbar>

                {loading ? (
                    <div className='flex flex-col items-center justify-center py-32 space-y-4'>
                        <div className='w-12 h-12 border-4 border-red-100 border-t-red-600 rounded-full animate-spin'></div>
                        <p className='text-gray-400 font-medium animate-pulse'>Fetching blood bank registry...</p>
                    </div>
                ) : bloodBanks.length === 0 ? (
                    <div className='text-center py-32 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200'>
                        <div className='bg-red-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4'>
                            <svg className='w-10 h-10 text-red-500' fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                            </svg>
                        </div>
                        <h3 className='text-xl font-bold text-gray-800'>No Blood Banks Found</h3>
                        <p className='text-gray-500 mt-2'>Start by adding your first partnered blood bank to the system.</p>
                    </div>
                ) : (
                    <div className='grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3'>
                        {bloodBanks.map(bb => (
                            <div key={bb.id} className='group bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-md hover:border-rose-200 transition-all overflow-hidden flex flex-col'>
                                <div className='h-12 bg-gradient-to-r from-rose-700 to-red-500 relative overflow-hidden flex items-center justify-between px-3'>
                                    {bb.image && (
                                        <img src={bb.image} className='absolute inset-0 w-full h-full object-cover opacity-30' alt={bb.name} />
                                    )}
                                    <span className={`relative z-10 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider ${bb.partner_type === 'partner' ? 'bg-white/90 text-rose-700' : 'bg-black/20 text-white'}`}>
                                        {bb.partner_type || 'NORMAL'}
                                    </span>
                                    <span className='relative z-10 text-[9px] font-bold text-white/90 flex items-center gap-1'>
                                        <svg className='w-3 h-3' fill="currentColor" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
                                        Partner
                                    </span>
                                </div>

                                <div className='p-3.5 flex flex-col flex-1 gap-2.5'>
                                    <div>
                                        <h3 className='text-sm font-bold text-rd-text truncate'>{bb.name}</h3>
                                        <p className='text-[11px] text-rd-muted truncate mt-0.5'>{bb.location}, {bb.city}</p>
                                    </div>

                                    <div className='grid grid-cols-4 gap-1.5'>
                                        {Object.entries(typeof bb.available_blood === 'string' ? JSON.parse(bb.available_blood) : bb.available_blood).map(([group, status]) => (
                                            <div key={group} className='flex flex-col items-center py-1.5 rounded-lg bg-slate-50 border border-slate-100'>
                                                <span className='text-[10px] font-black text-rose-600'>{group}</span>
                                                <div className={`w-1.5 h-1.5 rounded-full mt-1 ${status === 'Available' ? 'bg-emerald-500' : status === 'Limited' ? 'bg-amber-500' : 'bg-rose-400'}`}></div>
                                            </div>
                                        ))}
                                    </div>

                                    <div className='flex items-center gap-2 mt-auto pt-1'>
                                        <button 
                                            onClick={() => handleEdit(bb)} 
                                            className='flex-[2] py-2 px-3 bg-rose-50 text-rose-800 text-xs font-bold rounded-lg hover:bg-rose-100 transition-colors'
                                        >
                                            Edit
                                        </button>
                                        <button 
                                            onClick={() => {
                                                if(window.confirm('Delete this blood bank?')) deleteBloodBank(bb.id)
                                            }} 
                                            className='py-2 px-3 flex items-center justify-center bg-slate-50 text-rose-600 rounded-lg hover:bg-rose-50 transition-colors'
                                        >
                                            <svg className='w-4 h-4' fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Blood Bank Modal */}
                {showModal && (
                    <div className='fixed inset-0 bg-black/60 backdrop-blur-md z-[100] flex items-center justify-center p-4 sm:p-6 overflow-y-auto'>
                        <div className='bg-white rounded-[2rem] shadow-2xl w-full max-w-3xl overflow-hidden my-auto animate-modal-in'>
                            {/* Modal Header */}
                            <div className='bg-gradient-to-r from-red-600 to-rose-700 px-8 py-6 flex items-center justify-between'>
                                <div>
                                    <h2 className='text-2xl font-black text-white tracking-tight'>{editingBB ? 'Update Registry' : 'Add Partner Bank'}</h2>
                                    <p className='text-red-100 text-xs font-medium mt-1'>Fill in the directory details and inventory data.</p>
                                </div>
                                <button onClick={() => setShowModal(false)} className='bg-white/20 hover:bg-white/30 text-white p-2 rounded-xl transition-colors'>
                                    <svg className='w-6 h-6' fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className='p-8 space-y-8 h-[75vh] overflow-y-auto scrollbar-hide'>
                                {/* Basic Info Group */}
                                <div className='space-y-6'>
                                    <h3 className='text-sm font-black text-gray-400 uppercase tracking-widest flex items-center gap-2'>
                                        <span className='w-8 h-px bg-gray-200'></span> Basic Information
                                    </h3>
                                    
                                    <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
                                        <div className='md:col-span-2'>
                                            <label className='block text-[11px] font-black text-gray-500 uppercase tracking-wider mb-2 ml-1'>Blood Bank Name</label>
                                            <input 
                                                type='text' 
                                                required 
                                                placeholder='e.g. LifeGuard Memorial Blood Centre'
                                                className='w-full px-5 py-4 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:ring-4 focus:ring-red-500/10 focus:border-red-500 outline-none transition-all font-medium' 
                                                value={formData.name} 
                                                onChange={e => setFormData({ ...formData, name: e.target.value })} 
                                            />
                                        </div>
                                        
                                        <div className='md:col-span-2'>
                                            <label className='block text-[11px] font-black text-gray-500 uppercase tracking-wider mb-2 ml-1'>Image URL (Optional)</label>
                                            <input 
                                                type='text' 
                                                placeholder='https://images.unsplash.com/...'
                                                className='w-full px-5 py-4 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:ring-4 focus:ring-red-500/10 focus:border-red-500 outline-none transition-all font-medium' 
                                                value={formData.image} 
                                                onChange={e => setFormData({ ...formData, image: e.target.value })} 
                                            />
                                        </div>

                                        <div>
                                            <label className='block text-[11px] font-black text-gray-500 uppercase tracking-wider mb-2 ml-1'>Address / Location</label>
                                            <input 
                                                type='text' 
                                                required 
                                                placeholder='Street name, Building...'
                                                className='w-full px-5 py-4 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:ring-4 focus:ring-red-500/10 focus:border-red-500 outline-none transition-all font-medium' 
                                                value={formData.location} 
                                                onChange={e => setFormData({ ...formData, location: e.target.value })} 
                                            />
                                        </div>
                                        
                                        <div>
                                            <label className='block text-[11px] font-black text-gray-500 uppercase tracking-wider mb-2 ml-1'>City</label>
                                            <input 
                                                type='text' 
                                                required 
                                                placeholder='City name'
                                                className='w-full px-5 py-4 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:ring-4 focus:ring-red-500/10 focus:border-red-500 outline-none transition-all font-medium' 
                                                value={formData.city} 
                                                onChange={e => setFormData({ ...formData, city: e.target.value })} 
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Geographic Data */}
                                <div className='space-y-6'>
                                    <h3 className='text-sm font-black text-gray-400 uppercase tracking-widest flex items-center gap-2'>
                                        <span className='w-8 h-px bg-gray-200'></span> Mapping Coordinates
                                    </h3>
                                    <div className='grid grid-cols-1 md:grid-cols-3 gap-6'>
                                        <div>
                                            <label className='block text-[11px] font-black text-gray-500 uppercase tracking-wider mb-2 ml-1'>Latitude</label>
                                            <input 
                                                type='number' 
                                                step="any"
                                                required 
                                                placeholder='e.g. 17.3850'
                                                className='w-full px-5 py-4 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:ring-4 focus:ring-red-500/10 focus:border-red-500 outline-none transition-all font-medium' 
                                                value={formData.latitude} 
                                                onChange={e => setFormData({ ...formData, latitude: e.target.value })} 
                                            />
                                        </div>
                                        <div>
                                            <label className='block text-[11px] font-black text-gray-500 uppercase tracking-wider mb-2 ml-1'>Longitude</label>
                                            <input 
                                                type='number' 
                                                step="any"
                                                required 
                                                placeholder='e.g. 78.4867'
                                                className='w-full px-5 py-4 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:ring-4 focus:ring-red-500/10 focus:border-red-500 outline-none transition-all font-medium' 
                                                value={formData.longitude} 
                                                onChange={e => setFormData({ ...formData, longitude: e.target.value })} 
                                            />
                                        </div>
                                        <div>
                                            <label className='block text-[11px] font-black text-gray-500 uppercase tracking-wider mb-2 ml-1'>Partner Tier</label>
                                            <select 
                                                className='w-full px-5 py-[1.12rem] bg-gray-50 border-2 border-gray-100 rounded-2xl focus:ring-4 focus:ring-red-500/10 focus:border-red-500 outline-none transition-all font-bold appearance-none cursor-pointer' 
                                                value={formData.partnerType} 
                                                onChange={e => setFormData({ ...formData, partnerType: e.target.value })}
                                            >
                                                <option value="normal">Standard Partner</option>
                                                <option value="partner">Premium Collaborator</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                {/* Inventory Group */}
                                <div className='space-y-6'>
                                    <div className='flex items-center justify-between'>
                                        <h3 className='text-sm font-black text-gray-400 uppercase tracking-widest flex items-center gap-2'>
                                            <span className='w-8 h-px bg-gray-200'></span> Inventory Status
                                        </h3>
                                        <span className='text-[10px] font-bold text-red-500 bg-red-50 px-3 py-1 rounded-full'>UPDATES IN REAL-TIME</span>
                                    </div>
                                    <div className='grid grid-cols-2 sm:grid-cols-4 gap-4'>
                                        {bloodGroups.map(group => (
                                            <div key={group} className='p-4 rounded-3xl border-2 border-gray-50 bg-gray-50/50 flex flex-col gap-2 hover:border-red-100 hover:bg-red-50/20 transition-all'>
                                                <div className='flex items-center justify-between'>
                                                    <label className='block text-xs font-black text-red-600 uppercase'>{group}</label>
                                                    <div className={`w-2 h-2 rounded-full ${formData.availableBlood[group] === 'Available' ? 'bg-green-500' : formData.availableBlood[group] === 'Limited' ? 'bg-amber-500' : 'bg-red-500'}`}></div>
                                                </div>
                                                <select
                                                    className='w-full px-2 py-2 text-[10px] font-bold bg-white border border-gray-100 rounded-xl focus:ring-2 focus:ring-red-500 outline-none shadow-sm cursor-pointer'
                                                    value={formData.availableBlood[group]}
                                                    onChange={(e) => handleBloodStatusChange(group, e.target.value)}
                                                >
                                                    {statusOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                                </select>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Footer Action */}
                                <div className='flex gap-4 pt-6 pb-2'>
                                    <button 
                                        type='button' 
                                        onClick={() => setShowModal(false)} 
                                        className='flex-1 py-5 border-2 border-gray-100 rounded-2xl font-bold text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-all active:scale-95'
                                    >
                                        Dismiss
                                    </button>
                                    <button 
                                        type='submit' 
                                        className='flex-[2] py-5 bg-gradient-to-r from-red-600 to-rose-700 text-white rounded-2xl font-black shadow-xl shadow-red-200 hover:shadow-red-300 hover:-translate-y-1 transition-all active:scale-95'
                                    >
                                        {editingBB ? 'Commit Updates' : 'Launch New Bank'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
        </AdminPageLayout>
    )
}

export default ManageBloodBanks
