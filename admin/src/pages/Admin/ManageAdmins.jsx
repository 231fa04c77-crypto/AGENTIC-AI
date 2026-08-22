import React, { useContext, useEffect, useState } from 'react'
import axios from 'axios'
import { AdminContext } from '../../context/AdminContext'
import { toast } from 'react-toastify'
import GlassCard from '../../components/ui/GlassCard'
import { formatPublicId, publicIdBadgeClass } from '../../utils/publicIdDisplay'
import { AdminPageLayout, PageHero, KpiCard, McCard } from '../../components/mc'

const ManageAdmins = () => {
    const { aToken } = useContext(AdminContext)
    const backendUrl = import.meta.env.VITE_BACKEND_URL
    const [admins, setAdmins] = useState([])
    const [loading, setLoading] = useState(true)

    const fetchAdmins = async () => {
        setLoading(true)
        try {
            const { data } = await axios.get(`${backendUrl}/api/admin/admins`, {
                headers: { aToken }
            })
            if (data.success) setAdmins(data.admins || [])
            else toast.error(data.message)
        } catch (err) {
            toast.error(err.message)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (aToken) fetchAdmins()
    }, [aToken])

    return (
        <AdminPageLayout maxWidth="max-w-5xl mx-auto">
                <PageHero
                    title="Admins"
                    subtitle="Super-admin accounts with global MedClues platform access."
                    features={['Secure Access Control', 'Role Management', 'Audit Trail']}
                />

                <div className="mc-kpi-grid mc-kpi-grid--4">
                    <KpiCard label="Total Admins" value={admins.length} iconBg="bg-violet-100 text-violet-600"
                        icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>}
                    />
                </div>

                {loading ? (
                    <div className='py-20 flex justify-center'>
                        <div className='animate-spin h-12 w-12 border-4 border-indigo-100 border-t-indigo-600 rounded-full' />
                    </div>
                ) : admins.length === 0 ? (
                    <GlassCard className='p-10 text-center text-gray-500'>
                        No admin records in database yet. Env-based login may still work via `.env`.
                    </GlassCard>
                ) : (
                    <McCard title="Admin Users" noPadding bodyClassName="overflow-x-auto">
                        <table className='mc-data-table'>
                            <thead>
                                <tr>
                                    <th>Admin ID</th>
                                    <th>Email</th>
                                    <th style={{ textAlign: 'right' }}>Created</th>
                                </tr>
                            </thead>
                            <tbody>
                                {admins.map((admin) => (
                                    <tr key={admin.id}>
                                        <td>
                                            <span className={publicIdBadgeClass('slate')}>
                                                {formatPublicId(admin, 'ADM', admin.id)}
                                            </span>
                                        </td>
                                        <td>{admin.email}</td>
                                        <td style={{ textAlign: 'right' }} className='text-mc-text-muted text-xs'>
                                            {admin.createdAt
                                                ? new Date(admin.createdAt).toLocaleDateString('en-IN', {
                                                    day: '2-digit',
                                                    month: 'short',
                                                    year: 'numeric',
                                                })
                                                : '—'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </McCard>
                )}
        </AdminPageLayout>
    )
}

export default ManageAdmins
