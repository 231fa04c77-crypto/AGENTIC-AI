import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import Header from '../components/Header'
import SpecialityMenu from '../components/SpecialityMenu'
import TopDoctors from '../components/TopDoctors'
import HospitalTieUps from '../components/HospitalTieUps'
import ContactLocation from '../components/ContactLocation'
import AIChatbot from '../components/AIChatbot'
import { useAppContext } from '../context/AppContext'

const Home = () => {
  const [showChatbot, setShowChatbot] = useState(false)
  const { token } = useAppContext()

  return (
    <div>
      <Header />
      {token && (
        <div className="my-6 rounded-2xl border border-cyan-100 bg-gradient-to-r from-cyan-50 to-blue-50 px-5 py-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-black text-slate-800">My Care Journey</p>
            <p className="text-xs text-slate-500">See consultation, tests, reports, referrals, and follow-up in one place.</p>
          </div>
          <Link to="/my-care-journey" className="shrink-0 px-4 py-2 rounded-xl bg-cyan-600 text-white text-xs font-bold">
            Open
          </Link>
        </div>
      )}
      <SpecialityMenu />
      <TopDoctors />
      <HospitalTieUps />
      <ContactLocation />

      {/* AI Chatbot */}
      {showChatbot ? (
        <AIChatbot onClose={() => setShowChatbot(false)} />
      ) : (
        <button
          onClick={() => setShowChatbot(true)}
          className="fixed bottom-16 sm:bottom-20 right-4 sm:right-6 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-full p-3 sm:p-3.5 shadow-lg hover:shadow-xl transition-all group hover:scale-110 z-[999999]"
          title="Chat with AI Assistant"
        >
          <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>

          <span className="absolute -top-0.5 -right-0.5 sm:-top-1 sm:-right-1 w-2.5 h-2.5 sm:w-3 sm:h-3 bg-red-500 rounded-full animate-pulse"></span>
        </button>
      )}
    </div>
  )
}

export default Home
