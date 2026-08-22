import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { setupAuthInterceptor } from './services/authInterceptor.js'

setupAuthInterceptor()
import { BrowserRouter } from 'react-router-dom'
import AdminContextProvider from './context/AdminContext.jsx'
import DoctorContextProvider from './context/DoctorContext.jsx'
import AppContextProvider from './context/AppContext.jsx'
import DeanContextProvider from './context/DeanContext.jsx'
import ReceptionContextProvider from './context/ReceptionContext.jsx'
import { SocketProvider } from './context/SocketContext.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <SocketProvider>
      <AdminContextProvider>
        <DoctorContextProvider>
          <AppContextProvider>
            <DeanContextProvider>
              <ReceptionContextProvider>
                <App />
              </ReceptionContextProvider>
            </DeanContextProvider>
          </AppContextProvider>
        </DoctorContextProvider>
      </AdminContextProvider>
    </SocketProvider>
  </BrowserRouter>,
)
