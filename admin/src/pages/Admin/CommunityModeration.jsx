import React, { useContext, useEffect, useState } from 'react'
import axios from 'axios'
import { toast } from 'react-toastify'
import { AdminContext } from '../../context/AdminContext'

const CommunityModeration = () => {
  const { aToken, backendUrl } = useContext(AdminContext)
  const [items, setItems] = useState([])
  const [aiLogs, setAiLogs] = useState([])
  const [loading, setLoading] = useState(true)

  const headers = { aToken }

  const load = async () => {
    setLoading(true)
    try {
      const { data } = await axios.get(`${backendUrl}/api/admin/community/moderation`, { headers })
      if (data.success) {
        setItems(data.data || [])
        setAiLogs(data.aiLogs || [])
      }
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to load queue')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (aToken) load()
  }, [aToken])

  const act = async (id, action) => {
    try {
      const { data } = await axios.post(
        `${backendUrl}/api/admin/community/questions/${id}/${action}`,
        {},
        { headers },
      )
      if (data.success) {
        toast.success(data.message || 'Done')
        load()
      } else toast.error(data.message || 'Failed')
    } catch (err) {
      toast.error(err?.response?.data?.detail || err.message)
    }
  }

  const runArchive = async () => {
    try {
      const { data } = await axios.post(
        `${backendUrl}/api/admin/community/archive-job`,
        { days: 90 },
        { headers },
      )
      if (data.success) toast.success(`Archived ${data.archived} questions`)
    } catch (err) {
      toast.error(err?.response?.data?.detail || err.message)
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-black text-slate-800 mb-1">Community Moderation</h1>
          <p className="text-sm text-slate-500">Pending reviews, reports, and AI detection logs</p>
        </div>
        <button onClick={runArchive} className="px-4 py-2 rounded-xl bg-slate-800 text-white text-sm font-bold">
          Run Archive Job
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden mb-6">
        {loading ? (
          <div className="py-16 flex justify-center">
            <div className="animate-spin h-10 w-10 border-4 border-slate-100 border-t-slate-700 rounded-full" />
          </div>
        ) : items.length === 0 ? (
          <p className="py-14 text-center text-slate-400">No items in moderation queue</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-400">
              <tr>
                <th className="px-4 py-3">Question</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Reports</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((q) => (
                <tr key={q.id} className="border-t border-slate-100">
                  <td className="px-4 py-3">
                    <p className="font-bold text-slate-800">{q.title}</p>
                    <p className="text-xs text-slate-400 line-clamp-2 mt-0.5">{q.body}</p>
                  </td>
                  <td className="px-4 py-3 text-xs font-bold uppercase text-slate-500">
                    {q.moderationStatus} / {q.status}
                  </td>
                  <td className="px-4 py-3">{q.openReports || 0}</td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button onClick={() => act(q.id, 'publish')} className="text-xs font-bold text-emerald-600">Publish</button>
                    <button onClick={() => act(q.id, 'reject')} className="text-xs font-bold text-amber-600">Reject</button>
                    <button onClick={() => act(q.id, 'soft-delete')} className="text-xs font-bold text-rose-600">Hide</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <h2 className="text-sm font-black text-slate-700 mb-2 uppercase tracking-wide">AI Detection Logs</h2>
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        {aiLogs.length === 0 ? (
          <p className="py-8 text-center text-slate-400 text-sm">No moderation logs yet</p>
        ) : (
          <ul className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
            {aiLogs.map((l) => (
              <li key={l.id} className="px-4 py-3 text-sm flex justify-between gap-3">
                <div>
                  <span className={`text-xs font-bold uppercase ${
                    l.decision === 'dangerous' ? 'text-rose-600'
                      : l.decision === 'suspicious' ? 'text-amber-600' : 'text-emerald-600'
                  }`}>{l.decision}</span>
                  <span className="text-slate-400 text-xs ml-2">{l.engine}</span>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {(Array.isArray(l.reasons) ? l.reasons : []).join(', ') || '—'}
                  </p>
                </div>
                <span className="text-[11px] text-slate-400 whitespace-nowrap">{l.createdAt?.slice(0, 19)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

export default CommunityModeration
