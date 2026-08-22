import React, { useContext, useEffect, useState, useCallback } from 'react'

import { useNavigate } from 'react-router-dom'

import axios from 'axios'

import { toast } from 'react-toastify'

import { AppContext } from '../context/AppContext'
import { fetchDoctorSlots, invalidateDoctorSlots } from '../utils/slotCache'



const STEPS = [

  ['registration', 'Registration'],

  ['problem', 'Problem reported'],

  ['doctor_accepted', 'Doctor accepted'],

  ['consultation', 'Consultation'],

  ['investigation', 'Investigation'],

  ['report', 'Lab report'],

  ['doctor_review', 'Doctor review'],

  ['pharmacy', 'Pharmacy'],

  ['referral', 'Referral'],

  ['specialist_appointment', 'Specialist appointment'],

  ['followup', 'Follow-up'],

]



const statusDot = (tone) => ({ ok: '🟢', warn: '🟡', danger: '🔴', muted: '⚪' }[tone] || '⚪')

const journeyBanner = (status) => {
  const s = String(status || '').toUpperCase()
  if (s === 'ON_TRACK') return { text: '🟢 ON TRACK', cls: 'bg-emerald-50 border-emerald-100 text-emerald-800' }
  if (s === 'UPCOMING') return { text: '🟡 UPCOMING', cls: 'bg-amber-50 border-amber-100 text-amber-800' }
  if (s === 'OVERDUE') return { text: '🔴 OVERDUE', cls: 'bg-rose-50 border-rose-100 text-rose-800' }
  return { text: '🟡 ACTION NEEDED', cls: 'bg-amber-50 border-amber-100 text-amber-800' }
}



const reportUrl = (backendUrl, id, token, download = false) => {

  const q = new URLSearchParams({ token })

  if (download) q.set('download', '1')

  return `${backendUrl}/api/investigations/${id}/report?${q.toString()}`

}



const formatSlotDay = (slotDate) => {

  const parts = String(slotDate || '').split('_')

  if (parts.length !== 3) return slotDate

  const [d, m, y] = parts

  return new Date(`${y}-${m}-${d}`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

}



const SpecialistReferralBooking = ({ referral, backendUrl, token, onBooked }) => {

  const [slots, setSlots] = useState([])

  const [loadingSlots, setLoadingSlots] = useState(false)

  const [booking, setBooking] = useState(false)



  useEffect(() => {

    if (!referral?.specialist_id || !referral.bookable) return

    let cancelled = false

    const load = async () => {

      setLoadingSlots(true)

      try {

        const data = await fetchDoctorSlots(backendUrl, referral.specialist_id, 'offline')

        if (cancelled) return

        const flat = []

        for (const day of data?.days || []) {

          for (const block of day.blocks || []) {

            if (block.bookable !== false && (block.available_count ?? 1) > 0) {

              flat.push({

                slotDate: day.slotDate,

                slotTime: block.display,

                slotId: block.slot_id || block.representative_slot_id,

                dayLabel: formatSlotDay(day.slotDate),

              })

            }

          }

        }

        setSlots(flat.slice(0, 12))

      } catch (e) {

        console.warn('Could not load specialist slots', e)

      } finally {

        if (!cancelled) setLoadingSlots(false)

      }

    }

    load()

    return () => { cancelled = true }

  }, [referral?.specialist_id, referral?.bookable, backendUrl])



  const bookSlot = async (slot) => {

    setBooking(true)

    try {

      const { data } = await axios.post(

        `${backendUrl}/api/referrals/${referral.id}/book`,

        {

          slotDate: slot.slotDate,

          slotTime: slot.slotTime,

          slotId: slot.slotId,

          paymentMethod: 'payOnVisit',

        },

        { headers: { token } }

      )

      if (data.success) {

        toast.success('Specialist appointment booked')

        invalidateDoctorSlots(referral.specialist_id)

        onBooked?.()

      } else {

        toast.error(data.message || 'Booking failed')

      }

    } catch (e) {

      toast.error(e.response?.data?.detail || e.message || 'Booking failed')

    } finally {

      setBooking(false)

    }

  }



  if (!referral.bookable) return null



  return (

    <div className="mt-3 pt-3 border-t border-slate-100">

      <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Available appointments</p>

      {loadingSlots ? (

        <p className="text-xs text-slate-400 mt-2">Loading slots…</p>

      ) : slots.length === 0 ? (

        <p className="text-xs text-slate-400 mt-2">No slots available yet — check back soon.</p>

      ) : (

        <div className="flex flex-wrap gap-2 mt-2">

          {slots.map((s) => (

            <button

              key={`${s.slotDate}-${s.slotTime}`}

              type="button"

              disabled={booking}

              onClick={() => bookSlot(s)}

              className="px-3 py-1.5 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-800 text-xs font-bold hover:bg-indigo-100 disabled:opacity-50"

            >

              {s.dayLabel} · {s.slotTime}

            </button>

          ))}

        </div>

      )}

    </div>

  )

}



const MyCareJourney = () => {

  const { token, backendUrl } = useContext(AppContext)

  const navigate = useNavigate()

  const [data, setData] = useState(null)

  const [loading, setLoading] = useState(true)

  const [error, setError] = useState(null)



  const load = useCallback(async () => {

    if (!token) return

    try {

      const { data: res } = await axios.get(`${backendUrl}/api/ai/my-care-journey`, {

        headers: { token },

      })

      if (res.success === false) {

        setError(res.message || 'Could not load your care journey')

      } else {

        setData(res)

        setError(null)

      }

    } catch (e) {

      setError(e.response?.data?.detail || e.message || 'Could not load your care journey')

    } finally {

      setLoading(false)

    }

  }, [token, backendUrl])



  useEffect(() => {

    if (!token) {

      navigate('/login?mode=login')

      return

    }

    load()

    const onFocus = () => load()

    window.addEventListener('focus', onFocus)

    return () => window.removeEventListener('focus', onFocus)

  }, [token, backendUrl, navigate, load])



  const care = data?.care || {}
  const careTones = data?.care_tones || {}
  const banner = journeyBanner(data?.journey_status)
  const referrals = data?.referrals || []



  return (

    <div className="py-8 max-w-3xl mx-auto">

      <h1 className="text-2xl font-extrabold text-slate-900">My Care Journey</h1>

      <p className="text-sm text-slate-500 mt-1">A simple view of your hospital visit, tests, referrals, and follow-up.</p>



      {loading ? (

        <p className="mt-8 text-sm text-slate-400">Loading your journey…</p>

      ) : error ? (

        <p className="mt-6 text-sm text-rose-600 font-semibold">{error}</p>

      ) : (

        <>

          <div className={`mt-6 rounded-2xl border px-4 py-3 font-bold ${banner.cls}`}>
            JOURNEY: {banner.text}
          </div>

          <div className="mt-6 bg-white rounded-2xl border border-slate-200 divide-y">
            {STEPS.map(([key, label]) => (
              <div key={key} className="flex items-center justify-between px-4 py-3">
                <span className="text-sm font-semibold text-slate-700">{label}</span>
                <span className="text-sm font-bold text-slate-800 text-right max-w-[60%]">
                  {statusDot(careTones[key])} {care[key] || '— Not yet created'}
                </span>
              </div>
            ))}
          </div>



          {referrals.length > 0 && (

            <div className="mt-6">

              <h2 className="text-sm font-black uppercase tracking-wide text-slate-500">Specialist referrals</h2>

              <ul className="mt-2 space-y-3">

                {referrals.map((ref) => (

                  <li key={ref.id} className="rounded-xl border border-sky-100 bg-sky-50/50 px-4 py-3">

                    <div className="flex justify-between gap-2">

                      <div>

                        <p className="text-sm font-bold text-slate-800">{ref.to_dept}</p>

                        <p className="text-xs text-slate-600 mt-0.5">

                          {ref.specialist_name ? `Dr. ${ref.specialist_name}` : 'Specialist pending'}

                          {ref.referring_doctor_name ? ` · Referred by ${ref.referring_doctor_name}` : ''}

                        </p>

                        {ref.reason && <p className="text-xs text-slate-500 mt-1">{ref.reason}</p>}

                      </div>

                      <span className="text-xs font-bold text-sky-700 shrink-0">

                        {String(ref.status || '').replaceAll('_', ' ')}

                      </span>

                    </div>

                    <SpecialistReferralBooking

                      referral={ref}

                      backendUrl={backendUrl}

                      token={token}

                      onBooked={load}

                    />

                  </li>

                ))}

              </ul>

            </div>

          )}



          {(data?.reports || []).length > 0 && (

            <div className="mt-6">

              <h2 className="text-sm font-black uppercase tracking-wide text-slate-500">Lab reports</h2>

              <ul className="mt-2 space-y-2">

                {data.reports.map((r) => {

                  const published = ['REPORT_AVAILABLE', 'REVIEWED'].includes(String(r.status || '').toUpperCase())

                  return (

                    <li key={r.id} className="rounded-xl border border-slate-100 bg-white px-3 py-2 flex flex-wrap justify-between gap-2 items-center">

                      <span className="text-sm font-semibold text-slate-800">{r.test_name}</span>

                      {published && r.id ? (

                        <span className="flex gap-2">

                          <a href={reportUrl(backendUrl, r.id, token)} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-indigo-600">

                            View report

                          </a>

                          <a href={reportUrl(backendUrl, r.id, token, true)} download={`${r.test_name || 'report'}.pdf`} className="text-xs font-bold text-indigo-600">

                            Download PDF

                          </a>

                        </span>

                      ) : (

                        <span className="text-xs text-slate-400">{String(r.status || 'Pending').replaceAll('_', ' ')}</span>

                      )}

                    </li>

                  )

                })}

              </ul>

            </div>

          )}



          <div className="mt-6">

            <h2 className="text-sm font-black uppercase tracking-wide text-slate-500">Notifications</h2>

            {(data?.notifications || []).length === 0 ? (

              <p className="text-sm text-slate-400 mt-2">No recent notifications.</p>

            ) : (

              <ul className="mt-2 space-y-2">

                {data.notifications.map((n) => (

                  <li key={n.id} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">

                    <p className="text-sm font-semibold text-slate-800">{n.title}</p>

                    <p className="text-xs text-slate-500">{n.body}</p>

                  </li>

                ))}

              </ul>

            )}

          </div>

        </>

      )}

    </div>

  )

}



export default MyCareJourney

