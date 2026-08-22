import React, { useContext, useEffect, Suspense, lazy } from 'react'
import { DoctorContext } from './context/DoctorContext';
import { AdminContext } from './context/AdminContext';
import { DeanContext } from './context/DeanContext';
import { ReceptionContext } from './context/ReceptionContext';
import { AppContext } from './context/AppContext';
import { Route, Routes, useLocation, Navigate } from 'react-router-dom'
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Navbar from './components/Navbar'
import Sidebar from './components/Sidebar'
import ScrollToTop from './components/ScrollToTop'

const Dashboard = lazy(() => import('./pages/Admin/Dashboard'))
const HospitalTieUps = lazy(() => import('./pages/Admin/HospitalTieUps'))
const ManageDeans = lazy(() => import('./pages/Admin/ManageDeans'))
const ManageLabs = lazy(() => import('./pages/Admin/ManageLabs'))
const ManageBloodBanks = lazy(() => import('./pages/Admin/ManageBloodBanks'))
const ManageUsers = lazy(() => import('./pages/Admin/ManageUsers'))
const ManageAdmins = lazy(() => import('./pages/Admin/ManageAdmins'))
const ManagePartners = lazy(() => import('./pages/Admin/ManagePartners'))
const SystemSettings = lazy(() => import('./pages/Admin/SystemSettings'))
const HomeBanners = lazy(() => import('./pages/Admin/HomeBanners'))
const SloDashboard = lazy(() => import('./pages/Admin/SloDashboard'))
const AllAppointments = lazy(() => import('./pages/Admin/AllAppointments'))
const DoctorsList = lazy(() => import('./pages/Admin/DoctorsList'))
const RevenueAnalytics = lazy(() => import('./pages/Admin/RevenueAnalytics'))
const RefundManagement = lazy(() => import('./pages/Admin/RefundManagement'))
const AdminManageReceptionists = lazy(() => import('./pages/Admin/ManageReceptionists'))
const HospitalWizard = lazy(() => import('./pages/Admin/HospitalWizard'))
const ErDispatchTab = lazy(() => import('./pages/Dean/ErDispatchTab'))
const AmbulanceDashboard = lazy(() => import('./pages/Ambulance/AmbulanceDashboard'))
const DriverTripPage = lazy(() => import('./pages/Driver/DriverTripPage'))
const GreenCorridorPage = lazy(() => import('./pages/Driver/GreenCorridorPage'))
const PartnerDashboard = lazy(() => import('./pages/Partner/PartnerDashboard'))
const PharmacyMasterCatalog = lazy(() => import('./pages/Admin/PharmacyMasterCatalog'))
const HospitalPharmacyCounter = lazy(() => import('./pages/Partner/HospitalPharmacyCounter'))
const DoctorAppointments = lazy(() => import('./pages/Doctor/DoctorAppointments'))
const DoctorDashboard = lazy(() => import('./pages/Doctor/DoctorDashboard'))
const DoctorCommunity = lazy(() => import('./pages/Doctor/DoctorCommunity'))
const CommunityModeration = lazy(() => import('./pages/Admin/CommunityModeration'))
const DeanCommunity = lazy(() => import('./pages/Dean/DeanCommunity'))
const DoctorProfile = lazy(() => import('./pages/Doctor/DoctorProfile'))
const DoctorInQueue = lazy(() => import('./pages/Doctor/DoctorInQueue'))
const DoctorConsultation = lazy(() => import('./pages/Doctor/DoctorConsultation'))
const DoctorVideoConsult = lazy(() => import('./pages/Doctor/DoctorVideoConsult'))
const DoctorVideoCalls = lazy(() => import('./pages/Doctor/DoctorVideoCalls'))
const PatientsSearch = lazy(() => import('./pages/Doctor/PatientsSearch'))
const DoctorPatientJourney = lazy(() => import('./pages/Doctor/DoctorPatientJourney'))
const IncomingVideoCallModal = lazy(() => import('./components/IncomingVideoCallModal'))
const DoctorStatusListener = lazy(() => import('./components/DoctorStatusListener'))
const DeanDashboard = lazy(() => import('./pages/Dean/DeanDashboard'))
const DeanDoctors = lazy(() => import('./pages/Dean/DeanDoctors'))
const DeanAddDoctor = lazy(() => import('./pages/Dean/DeanAddDoctor'))
const DeanPatients = lazy(() => import('./pages/Dean/DeanPatients'))
const DeanAppointments = lazy(() => import('./pages/Dean/DeanAppointments'))
const DeanHospital = lazy(() => import('./pages/Dean/DeanHospital'))
const DeanManageReceptionists = lazy(() => import('./pages/Dean/ManageReceptionists'))
const DeanAmbulances = lazy(() => import('./pages/Dean/DeanAmbulances'))
const DeanPharmacies = lazy(() => import('./pages/Dean/DeanPharmacies'))
const ReceptionDashboard = lazy(() => import('./pages/Reception/ReceptionDashboard'))
const WalkInRegistration = lazy(() => import('./pages/Reception/WalkInRegistration'))
const QRCheckIn = lazy(() => import('./pages/Reception/QRCheckIn'))
const TodaysOperations = lazy(() => import('./pages/Reception/TodaysOperations'))
const ConsultationSummary = lazy(() => import('./pages/Reception/ConsultationSummary'))
const ReceptionPatients = lazy(() => import('./pages/Reception/Patients'))
const ReceptionFollowUps = lazy(() => import('./pages/Reception/FollowUps'))
const ReceptionPayments = lazy(() => import('./pages/Reception/Payments'))
const ReceptionRefunds = lazy(() => import('./pages/Reception/RefundRequests'))
const ReceptionNoShows = lazy(() => import('./pages/Reception/NoShows'))
const ReceptionGraceRequests = lazy(() => import('./pages/Reception/GraceRequests'))
const ReceptionReports = lazy(() => import('./pages/Reception/Reports'))
const ReceptionSettings = lazy(() => import('./pages/Reception/Settings'))
const LabQueue = lazy(() => import('./pages/Reception/LabQueue'))
const ReferralsQueue = lazy(() => import('./pages/Reception/ReferralsQueue'))
const FollowupQueue = lazy(() => import('./pages/Reception/FollowupQueue'))
const PharmacyQueue = lazy(() => import('./pages/Reception/PharmacyQueue'))
const Login = lazy(() => import('./pages/Login'))
const DoctorForgotPassword = lazy(() => import('./pages/DoctorForgotPassword'))

const RouteFallback = () => (
  <div className='flex items-center justify-center min-h-[40vh] text-rd-muted text-sm'>
    Loading…
  </div>
)

const App = () => {
  const { dToken } = useContext(DoctorContext)
  const { aToken } = useContext(AdminContext)
  const { deanToken } = useContext(DeanContext)
  const { recToken } = useContext(ReceptionContext)
  const { sidebarOpen, setSidebarOpen, darkMode } = useContext(AppContext)
  const location = useLocation()

  const isAuthenticated = dToken || aToken || deanToken || recToken

  useEffect(() => {
    const root = document.documentElement
    if (!isAuthenticated) {
      root.classList.remove('dark')
      root.classList.add('login-light')
      return () => root.classList.remove('login-light')
    }
    root.classList.remove('login-light')
    root.classList.toggle('dark', darkMode)
  }, [isAuthenticated, darkMode])

  useEffect(() => {
    const root = document.documentElement
    const desk = Boolean(aToken || dToken || deanToken || recToken)
    root.classList.toggle('medclues-desk', desk)
    root.classList.toggle('reception-desk', Boolean(recToken))
    root.classList.toggle('admin-desk', Boolean(aToken))
    root.classList.toggle('dean-desk', Boolean(deanToken))
    root.classList.toggle('doctor-desk', Boolean(dToken))
    return () => {
      root.classList.remove('medclues-desk', 'reception-desk', 'admin-desk', 'dean-desk', 'doctor-desk')
    }
  }, [aToken, dToken, deanToken, recToken])

  const publicRoutes = (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path='/ambulance-dashboard' element={<AmbulanceDashboard />} />
        <Route path='/driver-trip' element={<DriverTripPage />} />
        <Route path='/live-track/:caseId' element={<GreenCorridorPage />} />
        {isAuthenticated ? null : <Route path='*' element={<Login />} />}
      </Routes>
    </Suspense>
  )

  const location2 = window.location.pathname
  if (
    location2 === '/ambulance-dashboard' ||
    location2.startsWith('/driver-trip') ||
    location2.startsWith('/live-track')
  ) {
    return <><ToastContainer />{publicRoutes}</>
  }

  return isAuthenticated ? (
    <div className='relative w-full h-screen h-dvh medical-bg text-rd-text font-rd flex overflow-hidden'>
      <ToastContainer />
      <Suspense fallback={null}>
        <DoctorStatusListener />
      </Suspense>
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className='fixed inset-0 bg-black/40 backdrop-blur-sm z-20 lg:hidden transition-opacity'
        />
      )}
      <Sidebar />
      <div className='flex flex-col flex-1 min-w-0 min-h-0 overflow-hidden relative z-10'>
        <Navbar />
        <div
          key={location.pathname}
          className='flex-1 min-h-0 overflow-y-auto overflow-x-hidden main-content-area animate-route-in bg-rd-canvas'
        >
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path='/' element={
                aToken ? <Navigate to='/admin-dashboard' /> :
                  dToken ? <Navigate to='/doctor-dashboard' /> :
                    deanToken ? <Navigate to='/dean-dashboard' /> :
                      recToken ? <Navigate to='/reception-dashboard' /> :
                        <Navigate to='/login' />
              } />
              <Route path='/admin-dashboard' element={<Dashboard />} />
              <Route path='/hospital-tieups' element={<HospitalTieUps />} />
              <Route path='/hospital-wizard' element={<HospitalWizard />} />
              <Route path='/manage-deans' element={<ManageDeans />} />
              <Route path='/manage-labs' element={<ManageLabs />} />
              <Route path='/manage-blood-banks' element={<ManageBloodBanks />} />
              <Route path='/manage-users' element={<ManageUsers />} />
              <Route path='/manage-admins' element={<ManageAdmins />} />
              <Route path='/system-settings' element={<SystemSettings />} />
              <Route path='/home-banners' element={<HomeBanners />} />
              <Route path='/slo-health' element={<SloDashboard />} />
              <Route path='/all-appointments' element={<AllAppointments />} />
              <Route path='/doctor-list' element={<DoctorsList />} />
              <Route path='/revenue-analytics' element={<RevenueAnalytics />} />
              <Route path='/manage-receptionists' element={<AdminManageReceptionists />} />
              <Route path='/refund-management' element={<RefundManagement />} />
              <Route path='/partner-integrations' element={<ManagePartners />} />
              <Route path='/partner-analytics' element={<PartnerDashboard />} />
              <Route path='/pharmacy-master-catalog' element={<PharmacyMasterCatalog />} />
              <Route path='/hospital-pharmacy-counter' element={<HospitalPharmacyCounter />} />
              <Route path='/community-moderation' element={<CommunityModeration />} />
              <Route path='/doctor-dashboard' element={<DoctorDashboard />} />
              <Route path='/doctor-community' element={<DoctorCommunity />} />
              <Route path='/doctor-appointments' element={<DoctorAppointments />} />
              <Route path='/doctor-in-queue' element={<DoctorInQueue />} />
              <Route path='/doctor-consultation/:appointmentId' element={<DoctorConsultation />} />
              <Route path='/doctor-video-calls' element={<DoctorVideoCalls />} />
              <Route path='/doctor-profile' element={<DoctorProfile />} />
              <Route path='/queue-management' element={<Navigate to='/doctor-in-queue' replace />} />
              <Route path='/doctor-video/:appointmentId' element={<DoctorVideoConsult />} />
              <Route path='/doctor-patients' element={<PatientsSearch />} />
              <Route path='/doctor-patient-journey' element={<DoctorPatientJourney />} />
              <Route path='/dean-dashboard' element={<DeanDashboard />} />
              <Route path='/dean-add-doctor' element={<DeanAddDoctor />} />
              <Route path='/dean-doctors' element={<DeanDoctors />} />
              <Route path='/dean-appointments' element={<DeanAppointments />} />
              <Route path='/dean-patients' element={<DeanPatients />} />
              <Route path='/dean-hospital' element={<DeanHospital />} />
              <Route path='/dean-receptionists' element={<DeanManageReceptionists />} />
              <Route path='/dean-ambulances' element={<DeanAmbulances />} />
              <Route path='/dean-pharmacies' element={<DeanPharmacies />} />
              <Route path='/dean-community' element={<DeanCommunity />} />
              <Route path='/dean-er-dispatch' element={<ErDispatchTab />} />
              <Route path='/reception-dashboard' element={<ReceptionDashboard />} />
              <Route path='/reception-today' element={<TodaysOperations />} />
              <Route path='/reception-checkin' element={<QRCheckIn />} />
              <Route path='/reception-walkin' element={<WalkInRegistration />} />
              <Route path='/reception-queue' element={<TodaysOperations defaultTab='queue' />} />
              <Route path='/reception-online' element={<TodaysOperations defaultTab='bookings' />} />
              <Route path='/reception-summary/:appointmentId' element={<ConsultationSummary />} />
              <Route path='/reception-patients' element={<ReceptionPatients />} />
              <Route path='/reception-followups' element={<ReceptionFollowUps />} />
              <Route path='/reception-payments' element={<ReceptionPayments />} />
              <Route path='/reception-refunds' element={<ReceptionRefunds />} />
              <Route path='/reception-noshows' element={<ReceptionNoShows />} />
              <Route path='/reception-grace' element={<ReceptionGraceRequests />} />
              <Route path='/reception-reports' element={<ReceptionReports />} />
              <Route path='/reception-settings' element={<ReceptionSettings />} />
              <Route path='/reception-lab' element={<LabQueue />} />
              <Route path='/reception-referrals' element={<ReferralsQueue />} />
              <Route path='/reception-followup-queue' element={<FollowupQueue />} />
              <Route path='/reception-pharmacy-queue' element={<PharmacyQueue />} />
              <Route path='/reception-er-dispatch' element={<ErDispatchTab />} />
              <Route path='*' element={<Navigate to='/' />} />
            </Routes>
          </Suspense>
        </div>
      </div>
      <ScrollToTop />
      {dToken ? (
        <Suspense fallback={null}>
          <IncomingVideoCallModal />
        </Suspense>
      ) : null}
      <style>{`@keyframes pan {0%{background-position:0% 0%}50%{background-position:100% 100%}100%{background-position:0% 0%}}
      @keyframes routeIn {0%{opacity:0; transform: translateY(12px) scale(.98)} 100%{opacity:1; transform: translateY(0) scale(1)}}
      .animate-route-in{animation: routeIn .5s ease forwards}
      `}</style>
    </div>
  ) : (
    <>
      <ToastContainer />
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path='/' element={<Login />} />
          <Route path='/login' element={<Login />} />
          <Route path='/doctor-forgot-password' element={<DoctorForgotPassword />} />
          <Route path='*' element={<Navigate to='/' />} />
        </Routes>
      </Suspense>
    </>
  )
}

export default App
