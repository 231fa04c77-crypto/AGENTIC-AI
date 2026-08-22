import React, { useContext, useEffect, useState } from 'react'
import axios from 'axios'
import { toast } from 'react-toastify'
import { DeanContext } from '../../context/DeanContext'

const DeanCommunity = () => {
  const { deanToken } = useContext(DeanContext)
  const backendUrl = import.meta.env.VITE_BACKEND_URL
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const headers = { deantoken: deanToken }

  const load = async () => {
    setLoading(true)
    try {
      const { data } = await axios.get(`${backendUrl}/api/dean/community/moderation`, { headers })
      if (data.success) setItems(data.data || [])
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (deanToken) load()
  }, [deanToken])

  const act = async (id, action) => {
    try {
      const { data } = await axios.post(
        `${backendUrl}/api/dean/community/questions/${id}/${action}`,
        {},
        { headers },
      )
      if (data.success) {
        toast.success(data.message || 'Done')
        load()
      }
    } catch (err) {
      toast.error(err?.response?.data?.detail || err.message)
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <h1 className="text-2xl font-black text-slate-800 mb-1">Community Moderation</h1>
      <p className="text-sm text-slate-500 mb-6">Hospital-scoped reviews for Health Community</p>
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        {loading ? (
          <div className="py-16 flex justify-center">
            <div className="animate-spin h-10 w-10 border-4 border-teal-100 border-t-teal-600 rounded-full" />
          </div>
        ) : items.length === 0 ? (
          <p className="py-14 text-center text-slate-400">No items to review</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {items.map((q) => (
              <li key={q.id} className="p-4 flex flex-wrap gap-3 justify-between">
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-slate-800">{q.title}</p>
                  <p className="text-xs text-slate-500 line-clamp-2 mt-1">{q.body}</p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    {q.moderationStatus} · reports {q.openReports || 0}
                  </p>
                </div>
                <div className="flex gap-2 items-start">
                  <button onClick={() => act(q.id, 'publish')} className="text-xs font-bold text-emerald-600">Publish</button>
                  <button onClick={() => act(q.id, 'reject')} className="text-xs font-bold text-amber-600">Reject</button>
                  <button onClick={() => act(q.id, 'soft-delete')} className="text-xs font-bold text-rose-600">Hide</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

export default DeanCommunity
