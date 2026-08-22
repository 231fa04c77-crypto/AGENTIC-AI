import React, { useContext, useEffect, useState } from 'react'
import axios from 'axios'
import { AdminContext } from '../../context/AdminContext'
import { DeskPage, DeskHeader, DeskCard } from '../../components/desk/DeskChrome'
import { toast } from 'react-toastify'

const SystemSettings = () => {
  const { aToken } = useContext(AdminContext)
  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000'

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [maintenanceMode, setMaintenanceMode] = useState(false)
  const [emailNotifications, setEmailNotifications] = useState(true)
  const [auditLogRetention, setAuditLogRetention] = useState(30)
  const [systemName, setSystemName] = useState('MedClues')

  const applySettings = (s) => {
    if (!s) return
    setSystemName(s.system_name || 'MedClues')
    setEmailNotifications(Boolean(s.email_notifications))
    setMaintenanceMode(Boolean(s.maintenance_mode))
    setAuditLogRetention(Number(s.audit_log_retention_days) || 30)
    if (s.system_name) {
      document.title = `${s.system_name} — System Settings`
    }
  }

  useEffect(() => {
    if (!aToken) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const { data } = await axios.get(`${backendUrl}/api/admin/system-settings`, {
          headers: { aToken },
        })
        if (!cancelled && data.success) {
          applySettings(data.settings)
        } else if (!cancelled) {
          toast.error(data.message || 'Failed to load settings')
        }
      } catch (err) {
        if (!cancelled) {
          toast.error(err.response?.data?.message || err.message || 'Failed to load settings')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [aToken, backendUrl])

  const handleSave = async () => {
    const retention = Number(auditLogRetention)
    if (!Number.isFinite(retention) || retention < 1) {
      toast.error('Audit log retention must be at least 1 day')
      return
    }
    if (!systemName.trim()) {
      toast.error('Platform display name is required')
      return
    }

    setSaving(true)
    try {
      const { data } = await axios.put(
        `${backendUrl}/api/admin/system-settings`,
        {
          system_name: systemName.trim(),
          email_notifications: emailNotifications,
          maintenance_mode: maintenanceMode,
          audit_log_retention_days: Math.round(retention),
        },
        { headers: { aToken } }
      )
      if (data.success) {
        applySettings(data.settings)
        const purged = data.audit_logs_purged
        toast.success(
          purged
            ? `Config saved. Purged ${purged} old audit log(s).`
            : 'Platform configuration updated.'
        )
      } else {
        toast.error(data.message || 'Save failed')
      }
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const Toggle = ({ on, onToggle, onColor = 'bg-green-500' }) => (
    <button
      type='button'
      onClick={onToggle}
      disabled={loading || saving}
      className={`w-12 h-6 rounded-full transition-all relative shrink-0 disabled:opacity-50 ${
        on ? onColor : 'bg-gray-300'
      }`}
      aria-pressed={on}
    >
      <span
        className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${
          on ? 'right-1' : 'left-1'
        }`}
      />
    </button>
  )

  return (
    <DeskPage>
      <DeskHeader
        title='System Configuration'
        subtitle='Super Admin: Global properties and platform controls.'
      />

      {loading ? (
        <p className='text-sm text-rd-muted'>Loading settings…</p>
      ) : (
        <>
          <div className='grid grid-cols-1 md:grid-cols-2 gap-3 max-w-3xl'>
            <DeskCard className='p-3.5'>
              <h3 className='text-sm font-bold text-rd-text mb-3 flex items-center gap-1.5'>
                <svg className='w-4 h-4 text-teal-600' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4'
                  />
                </svg>
                General
              </h3>
              <div className='space-y-3'>
                <div>
                  <label className='text-[10px] font-bold uppercase tracking-wider text-teal-700 mb-1 block'>
                    Platform Display Name
                  </label>
                  <input
                    value={systemName}
                    onChange={(e) => setSystemName(e.target.value)}
                    disabled={saving}
                    className='w-full px-3 py-2 border border-rd-border rounded-lg bg-white text-rd-text focus:border-teal-500 outline-none text-sm'
                  />
                </div>
                <div className='flex items-center justify-between gap-3 p-2.5 bg-slate-50 rounded-lg border border-rd-border'>
                  <div>
                    <p className='text-xs font-bold text-rd-text'>Email Notifications</p>
                    <p className='text-[10px] text-rd-muted'>Global system alerts</p>
                  </div>
                  <Toggle
                    on={emailNotifications}
                    onToggle={() => setEmailNotifications((v) => !v)}
                  />
                </div>
              </div>
            </DeskCard>

            <DeskCard className='p-3.5 border-rose-100'>
              <h3 className='text-sm font-bold text-rose-700 mb-3 flex items-center gap-1.5'>
                <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z'
                  />
                </svg>
                Danger Zone
              </h3>
              <div className='space-y-3'>
                <div className='flex items-center justify-between gap-3 p-2.5 bg-rose-50 rounded-lg border border-rose-100'>
                  <div>
                    <p className='text-xs font-bold text-rose-800'>Maintenance Mode</p>
                    <p className='text-[10px] text-rose-500'>Block non-admin access</p>
                  </div>
                  <Toggle
                    on={maintenanceMode}
                    onToggle={() => setMaintenanceMode((v) => !v)}
                    onColor='bg-rose-600'
                  />
                </div>
                <div>
                  <label className='text-[10px] font-bold uppercase tracking-wider text-rose-600 mb-1 block'>
                    Audit Log Retention (Days)
                  </label>
                  <input
                    type='number'
                    min={1}
                    max={3650}
                    value={auditLogRetention}
                    onChange={(e) => setAuditLogRetention(e.target.value)}
                    disabled={saving}
                    className='w-full px-3 py-2 border border-rose-100 rounded-lg bg-white text-rd-text focus:border-rose-500 outline-none text-sm'
                  />
                </div>
              </div>
            </DeskCard>
          </div>

          <div className='flex justify-end'>
            <button
              type='button'
              onClick={handleSave}
              disabled={saving}
              className='px-5 py-2 bg-slate-900 text-white font-bold rounded-lg text-xs disabled:opacity-60'
            >
              {saving ? 'Saving…' : 'Update Platform Config'}
            </button>
          </div>
        </>
      )}
    </DeskPage>
  )
}

export default SystemSettings
