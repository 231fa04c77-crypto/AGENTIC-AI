import React, { useContext, useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { AdminContext } from '../../context/AdminContext'
import { useSocket } from '../../context/SocketContext'
import { toast } from 'react-toastify'
import AnimatedCounter from '../../components/ui/AnimatedCounter'
import LineChart from '../../components/charts/LineChart'
import AreaChart from '../../components/charts/AreaChart'
import BarChart from '../../components/charts/BarChart'
import { DeskPage, DeskHeader, DeskKpi, DeskCard, DeskBtn } from '../../components/desk/DeskChrome'

const QUICK_ACTIONS = [
  { label: 'Schedule Appointment', path: '/all-appointments', bg: 'bg-sky-500' },
  { label: 'Add New Dean', path: '/manage-deans', bg: 'bg-violet-500' },
  { label: 'Add New Hospital', path: '/hospital-tieups', bg: 'bg-blue-500' },
  { label: 'Connect New Lab', path: '/manage-labs', bg: 'bg-orange-500' },
  { label: 'Generate Report', path: '/revenue-analytics', bg: 'bg-emerald-500' },
]

const Dashboard = () => {
  const {
    aToken,
    getDashData,
    dashData,
    getAllDoctors,
    doctors,
    getAllAppointments,
    hospitals,
    getAllHospitals,
    getAllLabs,
    getAllBloodBanks,
    labs,
    bloodBanks,
  } = useContext(AdminContext)
  const { socket, isConnected } = useSocket()
  const navigate = useNavigate()
  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000'

  const [extraStats, setExtraStats] = useState({ deans: 0, refunds: 0 })
  const [chartData, setChartData] = useState({
    patientGrowth: { labels: [], values: [] },
    revenue: { labels: [], values: [] },
    appointments: { labels: [], values: [] },
  })

  useEffect(() => {
    if (!aToken) return
    getDashData()
    getAllDoctors()
    getAllHospitals()
    getAllLabs()
    getAllBloodBanks()

    const refreshInterval = setInterval(() => getDashData(), 30000)
    return () => clearInterval(refreshInterval)
  }, [aToken])

  useEffect(() => {
    if (!aToken) return
    const loadExtra = async () => {
      try {
        const [deansRes, refundsRes] = await Promise.all([
          axios.get(`${backendUrl}/api/admin/deans`, { headers: { aToken } }),
          axios.get(`${backendUrl}/api/admin/refunds/pending`, { headers: { aToken } }),
        ])
        setExtraStats({
          deans: deansRes.data?.success ? (deansRes.data.deans?.length || 0) : 0,
          refunds: refundsRes.data?.success ? (refundsRes.data.refunds?.length || refundsRes.data.pending?.length || 0) : 0,
        })
      } catch {
        /* optional endpoints */
      }
    }
    loadExtra()
  }, [aToken, backendUrl])

  useEffect(() => {
    if (dashData?.chartData) {
      setChartData({
        patientGrowth: dashData.chartData.patientGrowth || { labels: [], values: [] },
        revenue: dashData.chartData.revenue || { labels: [], values: [] },
        appointments: dashData.chartData.appointments || { labels: [], values: [] },
      })
    }
  }, [dashData])

  useEffect(() => {
    if (!socket || !isConnected) return
    const refresh = () => {
      getDashData()
      if (getAllAppointments) getAllAppointments()
    }
    socket.on('new-appointment', (data) => {
      toast.success(`New appointment: ${data.patientName} at ${data.slotTime}`, { autoClose: 3000 })
      refresh()
    })
    socket.on('appointments-deleted', refresh)
    return () => {
      socket.off('new-appointment')
      socket.off('appointments-deleted')
    }
  }, [socket, isConnected])

  const loading = dashData === null
  const data = dashData || {}

  const totalDoctors = data.doctors || doctors?.length || 0
  const activeDoctors = data.activeDoctors || doctors?.filter((d) => d.available).length || 0
  const totalHospitals = data.hospitals || hospitals?.length || 0
  const labsCount = labs?.length || 0
  const bloodBanksCount = bloodBanks?.length || 0

  const topHospitals = useMemo(() => {
    return (hospitals || [])
      .map((h) => ({
        id: h._id || h.id,
        name: h.name,
        location: (h.address || '').split(',').slice(-2).join(',').trim() || h.address || '—',
        doctors: h.doctors?.length || 0,
        showOnHome: h.showOnHome,
      }))
      .sort((a, b) => b.doctors - a.doctors)
      .slice(0, 5)
  }, [hospitals])

  const recentActivity = useMemo(() => {
    const items = []
    ;(data.latestAppointments || []).slice(0, 6).forEach((apt) => {
      const patient = apt.userData?.name || 'Patient'
      const doctor = apt.docData?.name || 'Doctor'
      items.push({
        id: `apt-${apt._id}`,
        type: 'appointment',
        title: 'New appointment booked',
        detail: `${patient} with ${doctor}`,
        time: apt.slotTime || '',
      })
    })
    ;(doctors || []).slice(0, 3).forEach((doc) => {
      items.push({
        id: `doc-${doc._id}`,
        type: 'doctor',
        title: 'Doctor on platform',
        detail: `${doc.name} · ${doc.speciality || 'General'}`,
        time: '',
      })
    })
    return items.slice(0, 8)
  }, [data.latestAppointments, doctors])

  const fmtInr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`

  if (loading) {
    return (
      <DeskPage>
        <div className="rd-card animate-pulse h-20 rounded-2xl bg-slate-200" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rd-card animate-pulse h-24 bg-slate-100 rounded-xl" />
          ))}
        </div>
        <p className="text-center text-sm text-rd-muted py-8">Loading dashboard…</p>
      </DeskPage>
    )
  }

  return (
    <DeskPage>
      <DeskHeader
        title="Good day, Super Admin"
        subtitle="Real-time overview of platform performance and healthcare operations."
        right={
          <DeskBtn onClick={() => getDashData()}>Refresh</DeskBtn>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <DeskKpi
          label="Total Revenue"
          value={<AnimatedCounter value={data.revenueTotal || 0} prefix="₹" />}
          sub={`Today ${fmtInr(data.revenueToday)}`}
          tone="emerald"
          onClick={() => navigate('/revenue-analytics')}
          icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
        />
        <DeskKpi
          label="Total Appointments"
          value={<AnimatedCounter value={data.appointments || 0} />}
          tone="sky"
          onClick={() => navigate('/all-appointments')}
          icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
        />
        <DeskKpi
          label="Active Doctors"
          value={<AnimatedCounter value={activeDoctors} />}
          tone="teal"
          onClick={() => navigate('/doctor-list?filter=available')}
          icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
        />
        <DeskKpi
          label="Tie-up Hospitals"
          value={<AnimatedCounter value={totalHospitals} />}
          tone="violet"
          onClick={() => navigate('/hospital-tieups')}
          icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>}
        />
        <DeskKpi
          label="Active Deans"
          value={<AnimatedCounter value={extraStats.deans} />}
          tone="indigo"
          onClick={() => navigate('/manage-deans')}
          icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" /></svg>}
        />
        <DeskKpi
          label="Labs Connected"
          value={<AnimatedCounter value={labsCount} />}
          tone="orange"
          onClick={() => navigate('/manage-labs')}
          icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>}
        />
        <DeskKpi
          label="Blood Banks"
          value={<AnimatedCounter value={bloodBanksCount} />}
          tone="rose"
          onClick={() => navigate('/manage-blood-banks')}
          icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>}
        />
        <DeskKpi
          label="Refund Requests"
          value={<AnimatedCounter value={extraStats.refunds} />}
          tone="amber"
          onClick={() => navigate('/refund-management')}
          icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>}
        />
      </div>

      <div className="rd-card rd-soft bg-rd-surface rounded-[16px] border border-rd-border px-3.5 py-3">
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="text-sm font-bold text-rd-text shrink-0">Quick Actions</h2>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 flex-1 min-w-0">
            {QUICK_ACTIONS.map((action) => (
              <button
                key={action.path}
                type="button"
                onClick={() => navigate(action.path)}
                className={`${action.bg} text-white text-[11px] font-semibold rounded-xl px-2 py-2.5 text-center hover:opacity-90 transition-opacity`}
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
        <DeskCard className="p-3">
          <h3 className="text-xs font-bold text-rd-text mb-2">Patient Registration</h3>
          <div className="h-[120px]">
            <LineChart data={chartData.patientGrowth} title="Patients" color="#0ea5e9" />
          </div>
        </DeskCard>
        <DeskCard className="p-3">
          <h3 className="text-xs font-bold text-rd-text mb-2">Revenue (30 Days)</h3>
          <div className="h-[120px]">
            <AreaChart data={chartData.revenue} title="Revenue" color="#0ea5e9" />
          </div>
        </DeskCard>
        <DeskCard className="p-3">
          <h3 className="text-xs font-bold text-rd-text mb-2">Appts Peak Hours</h3>
          <div className="h-[120px]">
            <BarChart data={chartData.appointments} title="Appointments" color="#8b5cf6" />
          </div>
        </DeskCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DeskCard className="overflow-hidden">
          <div className="px-4 py-3 border-b border-rd-border">
            <h3 className="text-sm font-bold text-rd-text">Top Performing Hospitals</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="mc-data-table w-full">
              <thead>
                <tr>
                  <th>Hospital</th>
                  <th>Location</th>
                  <th>Doctors</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {topHospitals.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center text-rd-muted py-6">No hospitals yet</td>
                  </tr>
                ) : (
                  topHospitals.map((h) => (
                    <tr key={h.id} className="cursor-pointer" onClick={() => navigate('/hospital-tieups')}>
                      <td className="font-semibold">{h.name}</td>
                      <td className="text-rd-muted text-xs max-w-[120px] truncate">{h.location}</td>
                      <td>{h.doctors}</td>
                      <td>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${h.showOnHome ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                          {h.showOnHome ? 'Featured' : 'Active'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </DeskCard>

        <DeskCard className="p-4">
          <h3 className="text-sm font-bold text-rd-text mb-3">Recent Activity</h3>
          <ul className="space-y-3">
            {recentActivity.length === 0 ? (
              <li className="text-sm text-rd-muted py-4 text-center">No recent activity</li>
            ) : (
              recentActivity.map((item) => (
                <li key={item.id} className="flex gap-3 items-start">
                  <span className={`mt-1 w-2 h-2 rounded-full shrink-0 ${item.type === 'appointment' ? 'bg-sky-500' : 'bg-violet-500'}`} />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-rd-text">{item.title}</p>
                    <p className="text-xs text-rd-muted truncate">{item.detail}</p>
                    {item.time && <p className="text-[10px] text-rd-muted mt-0.5">{item.time}</p>}
                  </div>
                </li>
              ))
            )}
          </ul>
        </DeskCard>
      </div>
    </DeskPage>
  )
}

export default Dashboard
