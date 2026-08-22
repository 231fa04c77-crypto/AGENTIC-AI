import React, { useContext, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { DeanContext } from '../../context/DeanContext'
import AnimatedCounter from '../../components/ui/AnimatedCounter'
import LineChart from '../../components/charts/LineChart'
import BarChart from '../../components/charts/BarChart'
import AreaChart from '../../components/charts/AreaChart'
import { DeskPage, DeskHeader, DeskKpi, DeskCard, DeskBtn } from '../../components/desk/DeskChrome'

const DeanDashboard = () => {
  const { deanToken, deanInfo, dashData, getDashData, getHospital, hospital } = useContext(DeanContext)
  const navigate = useNavigate()
  const [chartData, setChartData] = useState({
    patientGrowth: { labels: [], values: [] },
    revenue: { labels: [], values: [] },
    appointments: { labels: [], values: [] }
  })

  useEffect(() => {
    if (deanToken) {
      getDashData()
      getHospital()
    }
  }, [deanToken])

  useEffect(() => {
    if (dashData && dashData.chartData) {
      setChartData({
        patientGrowth: dashData.chartData.patientGrowth || { labels: [], values: [] },
        revenue: dashData.chartData.revenue || { labels: [], values: [] },
        appointments: dashData.chartData.appointments || { labels: [], values: [] }
      })
    }
  }, [dashData])

  if (!dashData) {
    return (
      <DeskPage>
        <div className="flex items-center justify-center min-h-[40vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto" />
            <p className="mt-4 text-rd-muted">Loading hospital dashboard…</p>
          </div>
        </div>
      </DeskPage>
    )
  }

  const hospitalName = hospital?.name || deanInfo?.hospitalName || 'Your Hospital'

  return (
    <DeskPage>
      <DeskHeader
        title={`Good day, ${deanInfo?.name || 'Dean'}`}
        subtitle={`Here's what's happening at ${hospitalName} today.`}
        right={<DeskBtn onClick={() => getDashData()}>Refresh</DeskBtn>}
      />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        <DeskKpi
          label="Revenue"
          value={<AnimatedCounter value={dashData.revenueTotal || 0} prefix="₹" />}
          sub={`Today: ₹${dashData.revenueToday || 0}`}
          tone="rose"
          onClick={() => navigate('/dean-appointments')}
          icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
        />
        <DeskKpi
          label="Total Appts"
          value={<AnimatedCounter value={dashData.totalAppointments || 0} />}
          tone="sky"
          onClick={() => navigate('/dean-appointments')}
          icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
        />
        <DeskKpi
          label="Active Doctors"
          value={`${dashData.activeDoctors || 0} / ${dashData.totalDoctors || 0}`}
          tone="emerald"
          onClick={() => navigate('/dean-doctors')}
          icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
        />
        <DeskKpi
          label="Total Patients"
          value={<AnimatedCounter value={dashData.totalPatients || 0} />}
          sub={`Today: ${dashData.patientsToday || 0}`}
          tone="indigo"
          onClick={() => navigate('/dean-patients')}
          icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>}
        />
        <DeskKpi
          label="Appts Today"
          value={<AnimatedCounter value={dashData.appointmentsToday || 0} />}
          tone="violet"
          onClick={() => navigate('/dean-appointments')}
          icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
        />
      </div>

      <div className="rd-card rd-soft bg-rd-surface rounded-[16px] border border-rd-border px-3.5 py-3">
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="text-sm font-bold text-rd-text shrink-0">Quick Actions</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 flex-1 min-w-0">
            {[
              { label: 'Appointments', to: '/dean-appointments', bg: 'bg-teal-500' },
              { label: 'Doctors', to: '/dean-doctors', bg: 'bg-sky-500' },
              { label: 'Add Doctor', to: '/dean-add-doctor', bg: 'bg-violet-500' },
              { label: 'ER Dispatch', to: '/dean-er-dispatch', bg: 'bg-rose-500' },
            ].map((a) => (
              <button
                key={a.to}
                type="button"
                onClick={() => navigate(a.to)}
                className={`${a.bg} text-white text-[11px] font-semibold rounded-xl px-2 py-2.5 text-center hover:opacity-90`}
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <DeskCard className="p-3">
          <h3 className="text-xs font-bold text-rd-text mb-2">Patient Registration Trend</h3>
          <div className="h-[120px]">
            <LineChart data={chartData.patientGrowth} title="Patients" color="#10b981" />
          </div>
        </DeskCard>
        <DeskCard className="p-3">
          <h3 className="text-xs font-bold text-rd-text mb-2">Revenue Trend (30 Days)</h3>
          <div className="h-[120px]">
            <BarChart data={chartData.revenue} title="Revenue" color="#0d9488" />
          </div>
        </DeskCard>
      </div>

      <DeskCard className="p-3">
        <h3 className="text-xs font-bold text-rd-text mb-2">Appointments Peak Hours</h3>
        <div className="h-[120px]">
          <AreaChart data={chartData.appointments} title="Appointments" color="#0891b2" />
        </div>
      </DeskCard>
    </DeskPage>
  )
}

export default DeanDashboard
