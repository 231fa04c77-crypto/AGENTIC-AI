import React, { useContext, useEffect, useState } from 'react'
import axios from 'axios'
import { toast } from 'react-toastify'
import { DoctorContext } from '../../context/DoctorContext'
import { AppContext } from '../../context/AppContext'

const modes = [
  { id: 'unanswered', label: 'Unanswered' },
  { id: 'specialty', label: 'My Specialty' },
  { id: 'general', label: 'General' },
  { id: 'all', label: 'All' },
  { id: 'resolved', label: 'Resolved' },
]

const DoctorCommunity = () => {
  const { dToken } = useContext(DoctorContext)
  const { backendUrl } = useContext(AppContext)
  const [mode, setMode] = useState('unanswered')
  const [items, setItems] = useState([])
  const [selected, setSelected] = useState(null)
  const [answers, setAnswers] = useState([])
  const [answerText, setAnswerText] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState('feed')
  const [myAnswers, setMyAnswers] = useState([])
  const [stats, setStats] = useState(null)

  const headers = { dtoken: dToken }

  const loadFeed = async () => {
    setLoading(true)
    try {
      const { data } = await axios.get(`${backendUrl}/api/doctor/community/feed`, {
        headers,
        params: { mode },
      })
      if (data.success) setItems(data.data || [])
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to load feed')
    } finally {
      setLoading(false)
    }
  }

  const loadMyAnswers = async () => {
    try {
      const { data } = await axios.get(`${backendUrl}/api/doctor/community/my-answers`, { headers })
      if (data.success) setMyAnswers(data.data || [])
    } catch (_) { /* ignore */ }
  }

  const loadStats = async () => {
    try {
      const { data } = await axios.get(`${backendUrl}/api/doctor/community/stats`, { headers })
      if (data.success) setStats(data.data)
    } catch (_) { /* ignore */ }
  }

  useEffect(() => {
    if (!dToken) return
    loadStats()
    if (tab === 'feed') loadFeed()
    else loadMyAnswers()
  }, [dToken, mode, tab])

  const openQuestion = async (q) => {
    setSelected(q)
    setAnswerText('')
    try {
      const { data } = await axios.get(`${backendUrl}/api/doctor/community/questions/${q.id}`, { headers })
      if (data.success) {
        setSelected(data.data.question)
        setAnswers(data.data.answers || [])
      }
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to load question')
    }
  }

  const submitAnswer = async () => {
    if (!selected || answerText.trim().length < 20) {
      return toast.error('Answer must be at least 20 characters')
    }
    setSaving(true)
    try {
      const { data } = await axios.post(
        `${backendUrl}/api/doctor/community/questions/${selected.id}/answers`,
        { body: answerText },
        { headers },
      )
      if (data.success) {
        toast.success('Answer posted')
        openQuestion(selected)
        setAnswerText('')
        loadFeed()
      } else toast.error(data.message || 'Failed')
    } catch (err) {
      toast.error(err?.response?.data?.detail || err.message)
    } finally {
      setSaving(false)
    }
  }

  const resolve = async () => {
    if (!selected) return
    try {
      const { data } = await axios.post(
        `${backendUrl}/api/doctor/community/questions/${selected.id}/resolve`,
        {},
        { headers },
      )
      if (data.success) {
        toast.success('Marked resolved')
        openQuestion(selected)
        loadFeed()
      }
    } catch (err) {
      toast.error(err?.response?.data?.detail || err.message)
    }
  }

  const recommend = async (type) => {
    if (!selected) return
    try {
      const { data } = await axios.post(
        `${backendUrl}/api/doctor/community/questions/${selected.id}/recommend`,
        { type },
        { headers },
      )
      if (data.success) {
        toast.success(type === 'emergency' ? 'Emergency guidance posted' : 'Consultation recommendation posted')
        openQuestion(selected)
      }
    } catch (err) {
      toast.error(err?.response?.data?.detail || err.message)
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-slate-800">Health Community</h1>
        <p className="text-sm text-slate-500 mt-1">
          Answer patient questions. Educational only — not a substitute for consultation.
        </p>
        {stats && (
          <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
            <span className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700">Answers {stats.answersGiven}</span>
            <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700">Resolved {stats.questionsResolved}</span>
            <span className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700">Helpful {stats.helpfulAnswers}</span>
            <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600">Reputation {stats.score}</span>
          </div>
        )}
      </div>

      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setTab('feed')}
          className={`px-4 py-2 rounded-xl text-sm font-bold ${tab === 'feed' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}
        >
          Questions Feed
        </button>
        <button
          onClick={() => setTab('mine')}
          className={`px-4 py-2 rounded-xl text-sm font-bold ${tab === 'mine' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}
        >
          My Answers
        </button>
      </div>

      {tab === 'feed' && (
        <div className="flex flex-wrap gap-2 mb-4">
          {modes.map((m) => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold ${mode === m.id ? 'bg-slate-800 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}
            >
              {m.label}
            </button>
          ))}
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden min-h-[420px]">
          {loading ? (
            <div className="py-20 flex justify-center">
              <div className="animate-spin h-10 w-10 border-4 border-indigo-100 border-t-indigo-600 rounded-full" />
            </div>
          ) : tab === 'mine' ? (
            myAnswers.length === 0 ? (
              <p className="p-8 text-center text-slate-400">No answers yet</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {myAnswers.map((a) => (
                  <li key={a.id} className="p-4">
                    <p className="text-xs font-bold text-indigo-600 mb-1">{a.questionTitle}</p>
                    <p className="text-sm text-slate-700 line-clamp-3">{a.body}</p>
                  </li>
                ))}
              </ul>
            )
          ) : items.length === 0 ? (
            <p className="p-8 text-center text-slate-400">No questions in this feed</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {items.map((q) => (
                <li key={q.id}>
                  <button
                    type="button"
                    onClick={() => openQuestion(q)}
                    className={`w-full text-left p-4 hover:bg-slate-50 ${selected?.id === q.id ? 'bg-indigo-50' : ''}`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] uppercase font-bold text-slate-400">{q.specialty}</span>
                      <span className="text-[10px] uppercase font-bold text-emerald-600">{q.status}</span>
                    </div>
                    <p className="font-bold text-slate-800 text-sm">{q.title}</p>
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2">{q.body}</p>
                    <p className="text-[11px] text-slate-400 mt-2">{q.answerCount} answers · {q.viewCount} views</p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 p-5 min-h-[420px]">
          {!selected ? (
            <p className="text-slate-400 text-center py-20">Select a question to answer</p>
          ) : (
            <>
              <h2 className="text-lg font-black text-slate-800">{selected.title}</h2>
              <p className="text-sm text-slate-600 mt-2 whitespace-pre-wrap">{selected.body}</p>
              <p className="text-[11px] text-amber-700 bg-amber-50 rounded-lg p-2 mt-3">
                This information is for general educational purposes and should not replace a professional medical consultation.
              </p>

              <div className="mt-4 space-y-3 max-h-48 overflow-y-auto">
                {answers.map((a) => (
                  <div key={a.id} className="rounded-xl bg-slate-50 p-3">
                    <p className="text-[10px] font-bold uppercase text-slate-400 mb-1">
                      {a.authorRole === 'doctor' ? (a.doctor?.name || 'Doctor') : 'Patient follow-up'}
                    </p>
                    <p className="text-sm text-slate-700 whitespace-pre-wrap">{a.body}</p>
                  </div>
                ))}
              </div>

              <textarea
                className="mt-4 w-full rounded-xl border border-slate-200 p-3 text-sm min-h-[100px]"
                placeholder="Write a careful, educational answer…"
                value={answerText}
                onChange={(e) => setAnswerText(e.target.value)}
              />
              <div className="flex flex-wrap gap-2 mt-3">
                <button
                  disabled={saving}
                  onClick={submitAnswer}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold disabled:opacity-50"
                >
                  {saving ? 'Posting…' : 'Post Answer'}
                </button>
                <button onClick={() => recommend('appointment')} className="px-3 py-2 bg-teal-50 text-teal-700 rounded-xl text-xs font-bold">
                  Recommend Appointment
                </button>
                <button onClick={() => recommend('emergency')} className="px-3 py-2 bg-rose-50 text-rose-700 rounded-xl text-xs font-bold">
                  Recommend Emergency
                </button>
                {selected.status !== 'resolved' && (
                  <button onClick={resolve} className="px-3 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold">
                    Mark Resolved
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default DoctorCommunity
