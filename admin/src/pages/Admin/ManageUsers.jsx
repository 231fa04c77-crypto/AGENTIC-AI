import React, { useContext, useEffect, useState } from 'react'
import axios from 'axios'
import { AdminContext } from '../../context/AdminContext'
import GlassCard from '../../components/ui/GlassCard'
import { toast } from 'react-toastify'
import { formatPublicId, publicIdBadgeClass } from '../../utils/publicIdDisplay'
import { AdminPageLayout, PageHero, KpiCard, FilterToolbar, McSearch, ExportMenu } from '../../components/mc'

const USER_EXPORT_COLUMNS = [
    { key: 'name', label: 'Name' },
    { key: (u) => u.publicId || u.id || u._id, label: 'Patient ID' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Phone' },
    { key: 'gender', label: 'Gender' },
    { key: 'trustScore', label: 'Trust Score' },
    { key: (u) => u.date || u.created_at, label: 'Joined', format: (v) => (v ? new Date(v).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '') },
]

const ManageUsers = () => {
    const { aToken } = useContext(AdminContext)
    const [users, setUsers] = useState([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [debouncedSearch, setDebouncedSearch] = useState('')

    // Debounce search input
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(search)
        }, 300)
        return () => clearTimeout(timer)
    }, [search])

    const backendUrl = import.meta.env.VITE_BACKEND_URL

    const fetchAllUsers = async () => {
        setLoading(true)
        try {
            const { data } = await axios.get(`${backendUrl}/api/admin/users`, {
                headers: { aToken }
            })
            if (data.success) {
                setUsers(data.users || [])
            } else {
                toast.error(data.message)
            }
        } catch (err) {
            toast.error(err.message)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (aToken) {
            fetchAllUsers()
        }
    }, [aToken])

    const filtered = users.filter(u => 
        (u.name && u.name.toLowerCase().includes(debouncedSearch.toLowerCase())) || 
        (u.email && u.email.toLowerCase().includes(debouncedSearch.toLowerCase())) ||
        (u.publicId && u.publicId.toLowerCase().includes(debouncedSearch.toLowerCase()))
    )

    return (
        <AdminPageLayout>
                <PageHero
                    title="User Management"
                    subtitle="Monitor and manage all patients and platform users across MedClues."
                    features={['Role-based Access', 'Activity Tracking', 'Secure Invitations']}
                />

                <div className="mc-kpi-grid mc-kpi-grid--4">
                    <KpiCard label="Total Users" value={users.length} iconBg="bg-sky-100 text-sky-600"
                        icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>}
                    />
                    <KpiCard label="Search Results" value={filtered.length} iconBg="bg-violet-100 text-violet-600"
                        icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>}
                    />
                </div>

                <FilterToolbar
                    actions={
                        <ExportMenu
                            columns={USER_EXPORT_COLUMNS}
                            rows={() => filtered}
                            filename='platform_users'
                            title='Platform Users'
                            subtitle={`${filtered.length} record(s)`}
                            orientation='portrait'
                        />
                    }
                >
                    <McSearch placeholder="Search users by name, email or ID..." value={search} onChange={(e) => setSearch(e.target.value)} />
                </FilterToolbar>

                <div className='bg-gray-50/50 rounded-2xl p-1'>
                    {loading ? (
                        <div className='py-24 flex flex-col items-center justify-center bg-white rounded-2xl border border-gray-100 shadow-sm'>
                            <div className='relative'>
                                <div className='animate-spin h-14 w-14 border-4 border-indigo-100 border-t-indigo-600 rounded-full'></div>
                                <div className='absolute inset-0 flex items-center justify-center'>
                                    <div className='h-6 w-6 bg-indigo-500 rounded-full animate-pulse'></div>
                                </div>
                            </div>
                            <p className='mt-6 text-gray-500 font-bold text-lg animate-pulse'>Accessing Secure User Database...</p>
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className='py-24 text-center bg-white rounded-2xl border border-dashed border-gray-200'>
                            <div className='text-6xl mb-6 grayscale opacity-60'>👥</div>
                            <h3 className='text-xl font-bold text-gray-800 mb-2'>No Users Matched</h3>
                            <p className='text-gray-400 max-w-sm mx-auto'>We couldn't find any platform users matching your current search criteria.</p>
                            <button onClick={() => setSearch('')} className='mt-6 text-indigo-600 font-bold hover:bg-indigo-50 px-6 py-2 rounded-xl transition-all'>
                                Clear Search
                            </button>
                        </div>
                    ) : (
                        <>
                            {/* Desktop View (Table) */}
                            <div className='hidden lg:block'>
                                <GlassCard className='overflow-hidden border-none shadow-md'>
                                    <div className='bg-white/60 px-3 py-2 border-b border-gray-100 flex items-center justify-between'>
                                         <h3 className='font-bold text-gray-800 flex items-center gap-2'>
                                            <svg className='w-5 h-5 text-indigo-600' fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                                            Registered Platform Users
                                        </h3>
                                        <span className='px-3 py-1 bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-bold rounded-full'>
                                            {filtered.length} Patients
                                        </span>
                                    </div>
                                    <div className='overflow-x-auto'>
                                        <table className='w-full text-sm text-left'>
                                            <thead className='bg-gray-50/80 text-gray-400 font-bold uppercase text-[10px] tracking-widest'>
                                                <tr>
                                                    <th className='px-3 py-2'>Full Name & Avatar</th>
                                                    <th className='px-3 py-2'>Patient ID</th>
                                                    <th className='px-3 py-2'>Contact Credentials</th>
                                                    <th className='px-3 py-2 text-center'>Access Role</th>
                                                    <th className='px-3 py-2 text-right'>Onboarding Date</th>
                                                </tr>
                                            </thead>
                                            <tbody className='divide-y divide-gray-50 bg-white/40'>
                                                {filtered.map((u, idx) => (
                                                    <tr key={idx} className='hover:bg-indigo-50/40 transition-colors group'>
                                                        <td className='px-3 py-2'>
                                                            <div className='flex items-center gap-3'>
                                                                <div className='relative'>
                                                                     <img src={u.image || `https://ui-avatars.com/api/?name=${u.name}&background=6366f1&color=fff`} className='w-8 h-8 rounded-xl shadow-sm group-hover:scale-110 transition-transform duration-300' alt='' />
                                                                     <div className='absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 border-2 border-white rounded-full'></div>
                                                                </div>
                                                                <span className='font-bold text-gray-900 group-hover:text-indigo-600 transition-colors'>{u.name}</span>
                                                            </div>
                                                        </td>
                                                        <td className='px-3 py-2'>
                                                            <span className={publicIdBadgeClass('indigo')}>
                                                                {formatPublicId(u, 'PAT', u.id || u._id)}
                                                            </span>
                                                        </td>
                                                        <td className='px-3 py-2'>
                                                            <div className='flex flex-col'>
                                                                <span className='text-gray-800 font-bold'>{u.email}</span>
                                                                <span className='text-gray-400 text-xs mt-0.5'>{u.phone || 'No phone verified'}</span>
                                                            </div>
                                                        </td>
                                                        <td className='px-3 py-2 text-center'>
                                                            <span className='px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-tighter bg-indigo-100 text-indigo-700 border border-indigo-200'>
                                                                Patient
                                                            </span>
                                                        </td>
                                                        <td className='px-3 py-2 text-right text-gray-500 font-medium'>
                                                            {new Date(u.date || u.created_at || Date.now()).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </GlassCard>
                            </div>

                            {/* Mobile View (Cards) */}
                            <div className='lg:hidden space-y-4'>
                                {filtered.map((u, idx) => (
                                    <GlassCard key={idx} className='p-5 border-none shadow-md overflow-hidden animate-fade-in-up' style={{ animationDelay: `${idx * 0.05}s` }}>
                                         <div className='flex items-center gap-4 mb-4 pb-4 border-b border-gray-100'>
                                             <div className='relative'>
                                                <img src={u.image || `https://ui-avatars.com/api/?name=${u.name}&background=6366f1&color=fff`} className='w-14 h-14 rounded-2xl shadow-lg' alt='' />
                                                <div className='absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-white rounded-full'></div>
                                             </div>
                                             <div className='flex-1 min-w-0'>
                                                 <h3 className='font-black text-gray-900 truncate'>{u.name}</h3>
                                                 <span className='inline-block px-2 py-0.5 rounded-md text-[9px] font-black uppercase bg-indigo-100 text-indigo-700 border border-indigo-200 mt-1'>
                                                    Patient Account
                                                 </span>
                                             </div>
                                         </div>

                                         <div className='grid grid-cols-1 gap-4'>
                                             <div className='flex flex-col gap-1'>
                                                 <label className='text-[10px] font-bold text-gray-400 uppercase tracking-widest'>Patient ID</label>
                                                 <span className={publicIdBadgeClass('indigo')}>{formatPublicId(u, 'PAT', u.id || u._id)}</span>
                                             </div>
                                             {u.trustScore != null && (
                                             <div className='flex flex-col gap-1'>
                                                 <label className='text-[10px] font-bold text-gray-400 uppercase tracking-widest'>Trust Score</label>
                                                 <span className='text-sm font-bold text-gray-800'>{u.trustScore} · {u.trustLevel || 'NORMAL'}</span>
                                             </div>
                                             )}
                                             <div className='flex flex-col gap-1'>
                                                 <label className='text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1'>
                                                     <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                                                     Contact Info
                                                 </label>
                                                 <p className='text-sm font-bold text-gray-800'>{u.email}</p>
                                                 <p className='text-xs text-gray-500'>{u.phone || 'No phone number'}</p>
                                             </div>

                                             <div className='flex items-center justify-between pt-3 border-t border-gray-50'>
                                                 <span className='text-[10px] font-bold text-gray-400 uppercase tracking-widest'>Joined MedClues</span>
                                                 <span className='text-xs font-black text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md'>
                                                     {new Date(u.date || u.created_at || Date.now()).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                 </span>
                                             </div>
                                         </div>
                                    </GlassCard>
                                ))}
                            </div>
                        </>
                    )}
                </div>
        </AdminPageLayout>
    )
}

export default ManageUsers
