import React, { useContext, useEffect, useState } from 'react'
import axios from 'axios'
import { DeanContext } from '../../context/DeanContext'
import GlassCard from '../../components/ui/GlassCard'
import { ExportMenu } from '../../components/mc'
import { toast } from 'react-toastify'

const PATIENT_EXPORT_COLUMNS = [
    { key: 'name', label: 'Patient' },
    { key: 'publicId', label: 'Patient ID' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Phone' },
    { key: 'gender', label: 'Gender' },
    { key: 'age', label: 'Age' },
    { key: 'bloodGroup', label: 'Blood Group' },
    { key: 'hospitalVisits', label: 'Visits', format: (v) => v ?? 0 },
    { key: 'cancelledAtHospital', label: 'Cancelled', format: (v) => v ?? 0 },
    { key: 'trustScore', label: 'Trust Score', format: (v) => v ?? 100 },
    { key: 'lastBookedAt', label: 'Last Visit', format: (v) => (v ? new Date(v).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '') },
]

const DeanPatients = () => {
    const { deanToken } = useContext(DeanContext)
    const [patients, setPatients] = useState([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')

    const backendUrl = import.meta.env.VITE_BACKEND_URL

    const fetchPatients = async () => {
        setLoading(true)
        try {
            const { data } = await axios.get(`${backendUrl}/api/dean/patients`, {
                headers: { deantoken: deanToken }
            })
            if (data.success) {
                setPatients(data.patients)
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
        if (deanToken) fetchPatients()
    }, [deanToken])

    const filtered = patients.filter(p => 
        p.name?.toLowerCase().includes(search.toLowerCase()) || 
        p.email?.toLowerCase().includes(search.toLowerCase())
    )

    return (
        <div className='w-full bg-gradient-to-br from-gray-50 via-white to-emerald-50/30 p-4 sm:p-6 mobile-safe-area pb-6 min-h-full'>
            <div className='max-w-6xl mx-auto space-y-6'>
                <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-4'>
                    <div>
                        <h2 className='text-2xl font-bold text-gray-900'>Patients</h2>
                        <p className='text-sm text-gray-500'>Monitor and manage patients who have interacted with your facility.</p>
                    </div>
                    <div className='flex items-center gap-3 w-full sm:w-auto'>
                        <div className='relative flex-1 sm:w-64'>
                            <input 
                                value={search} 
                                onChange={e => setSearch(e.target.value)} 
                                placeholder='Search by name or email...' 
                                className='w-full pl-10 pr-4 py-2 border-2 border-gray-100 rounded-xl focus:border-emerald-500 outline-none transition-all text-sm'
                            />
                            <svg className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400' fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>
                        <ExportMenu
                            columns={PATIENT_EXPORT_COLUMNS}
                            rows={() => filtered}
                            filename='hospital_patients'
                            title='Hospital Patients'
                            subtitle={`${filtered.length} record(s)`}
                        />
                    </div>
                </div>

                <GlassCard className='overflow-hidden'>
                    {loading ? (
                        <div className='py-20 flex justify-center'>
                            <div className='animate-spin h-10 w-10 border-4 border-emerald-500 border-t-transparent rounded-full'></div>
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className='py-20 text-center text-gray-400'>
                            <p className='text-4xl mb-4'>👥</p>
                            <p>No patients found.</p>
                        </div>
                    ) : (
                        <div className='responsive-table-wrap'>
                            <table className='w-full text-sm text-left min-w-[900px]'>
                                <thead className='bg-gray-50 text-gray-600 font-bold uppercase text-[10px] tracking-widest'>
                                    <tr>
                                        <th className='px-6 py-4'>Patient</th>
                                        <th className='px-6 py-4'>Contact</th>
                                        <th className='px-6 py-4'>Gender / Age</th>
                                        <th className='px-6 py-4'>Blood Group</th>
                                        <th className='px-6 py-4 text-center'>Visits</th>
                                        <th className='px-6 py-4 text-center'>Trust</th>
                                        <th className='px-6 py-4'>Last Visit</th>
                                    </tr>
                                </thead>
                                <tbody className='divide-y divide-gray-100'>
                                    {filtered.map((p, idx) => (
                                        <tr key={idx} className='hover:bg-emerald-50/30 transition-colors'>
                                            <td className='px-6 py-4'>
                                                <div className='flex items-center gap-3'>
                                                    <img src={p.image || 'https://ui-avatars.com/api/?name='+p.name} className='w-10 h-10 rounded-full bg-gray-100' alt='' />
                                                    <div className='min-w-0'>
                                                        <p className='font-semibold text-gray-800 truncate'>{p.name}</p>
                                                        {p.publicId && <p className='text-[10px] text-gray-400 font-mono'>{p.publicId}</p>}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className='px-6 py-4'>
                                                <p className='text-gray-700'>{p.email || '—'}</p>
                                                <p className='text-gray-400 text-xs'>{p.phone || '—'}</p>
                                            </td>
                                            <td className='px-6 py-4 text-gray-600 capitalize'>
                                                {p.gender || '—'} / {p.age ? `${p.age} yrs` : '—'}
                                            </td>
                                            <td className='px-6 py-4'>
                                                <span className={`px-2 py-1 rounded text-xs font-bold ${p.bloodGroup ? 'bg-red-50 text-red-600' : 'text-gray-300'}`}>
                                                    {p.bloodGroup || 'N/A'}
                                                </span>
                                            </td>
                                            <td className='px-6 py-4 text-center'>
                                                <span className='font-bold text-gray-800'>{p.hospitalVisits ?? 0}</span>
                                                {(p.cancelledAtHospital > 0) && (
                                                    <span className='block text-[10px] text-red-400'>{p.cancelledAtHospital} cancelled</span>
                                                )}
                                            </td>
                                            <td className='px-6 py-4 text-center'>
                                                <span className={`px-2 py-1 rounded-full text-[11px] font-bold ${
                                                    (p.trustScore ?? 100) >= 80 ? 'bg-emerald-50 text-emerald-600'
                                                    : (p.trustScore ?? 100) >= 50 ? 'bg-amber-50 text-amber-600'
                                                    : 'bg-red-50 text-red-600'
                                                }`}>
                                                    {p.trustScore ?? 100}
                                                </span>
                                            </td>
                                            <td className='px-6 py-4 text-gray-500 text-xs font-medium'>
                                                {p.lastBookedAt
                                                    ? new Date(p.lastBookedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                                                    : '—'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </GlassCard>
            </div>
        </div>
    )
}

export default DeanPatients
