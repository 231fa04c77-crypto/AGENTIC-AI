import React, { Suspense, lazy } from 'react'
import Navbar from './components/Navbar'
import { Routes, Route } from 'react-router-dom'
import Footer from './components/Footer'
import ScrollToTop from './components/ScrollToTop'
import BackToTopButton from './components/BackToTopButton'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'

const Home = lazy(() => import('./pages/Home'))
const Doctors = lazy(() => import('./pages/Doctors'))
const DoctorProfile = lazy(() => import('./pages/DoctorProfile'))
const Login = lazy(() => import('./pages/Login'))
const About = lazy(() => import('./pages/About'))
const Contact = lazy(() => import('./pages/Contact'))
const Appointment = lazy(() => import('./pages/Appointment'))
const MyAppointments = lazy(() => import('./pages/MyAppointments'))
const MyCareJourney = lazy(() => import('./pages/MyCareJourney'))
const MyProfile = lazy(() => import('./pages/MyProfile'))
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'))
const DataSecurity = lazy(() => import('./pages/DataSecurity'))
const Careers = lazy(() => import('./pages/Careers'))
const Verify = lazy(() => import('./pages/Verify'))
const VerifyAppointment = lazy(() => import('./pages/VerifyAppointment'))
const Emergency = lazy(() => import('./pages/Emergency'))
const CollaboratedHospitals = lazy(() => import('./pages/CollaboratedHospitals'))
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'))
const HospitalDetails = lazy(() => import('./pages/HospitalDetails'))
const AllDoctorsList = lazy(() => import('./pages/AllDoctorsList'))
const AppointmentConfirmation = lazy(() => import('./pages/AppointmentConfirmation'))
const Labs = lazy(() => import('./pages/Labs'))
const MyLabs = lazy(() => import('./pages/MyLabs'))
const BookService = lazy(() => import('./pages/BookService'))
const VideoConsult = lazy(() => import('./pages/VideoConsult'))

const Fallback = () => (
  <div className='py-20 text-center text-sm text-slate-500'>Loading…</div>
)

const App = () => {
  const paddingClass = 'pt-[72px] sm:pt-[80px]'

  return (
    <div className='min-h-screen flex flex-col overflow-x-hidden'>
      <ToastContainer
        position="top-center"
        autoClose={3000}
        hideProgressBar={true}
        newestOnTop={false}
        closeOnClick={true}
        rtl={false}
        pauseOnFocusLoss={false}
        draggable={false}
        pauseOnHover={false}
        theme="colored"
        limit={1}
      />
      <div className='relative z-[100]'>
        <Navbar />
      </div>
      <ScrollToTop />
      <main className={`relative flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 ${paddingClass}`}>
        <Suspense fallback={<Fallback />}>
          <Routes>
            <Route path='/' element={<Home />} />
            <Route path='/doctors' element={<Doctors />} />
            <Route path='/doctors/:speciality' element={<Doctors />} />
            <Route path='/hospitals' element={<CollaboratedHospitals />} />
            <Route path='/all-doctors' element={<AllDoctorsList />} />
            <Route path='/doctor/:docId' element={<DoctorProfile />} />
            <Route path='/login' element={<Login />} />
            <Route path='/forgot-password' element={<ForgotPassword />} />
            <Route path='/about' element={<About />} />
            <Route path='/contact' element={<Contact />} />
            <Route path='/appointment/:docId' element={<Appointment />} />
            <Route path='/my-appointments' element={<MyAppointments />} />
            <Route path='/my-care-journey' element={<MyCareJourney />} />
            <Route path='/my-profile' element={<MyProfile />} />
            <Route path='/privacy-policy' element={<PrivacyPolicy />} />
            <Route path='/data-security' element={<DataSecurity />} />
            <Route path='/verify' element={<Verify />} />
            <Route path='/verify-appointment' element={<VerifyAppointment />} />
            <Route path='/emergency' element={<Emergency />} />
            <Route path='/careers' element={<Careers />} />
            <Route path='/hospital/:id' element={<HospitalDetails />} />
            <Route path='/appointment-confirmation' element={<AppointmentConfirmation />} />
            <Route path='/labs' element={<Labs />} />
            <Route path='/my-labs' element={<MyLabs />} />
            <Route path='/book-service' element={<BookService />} />
            <Route path='/video-consult' element={<VideoConsult />} />
          </Routes>
        </Suspense>
      </main>
      <Footer />
      <BackToTopButton />
    </div>
  )
}

export default App
