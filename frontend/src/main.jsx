import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { BrowserRouter } from 'react-router-dom'
import AppContextProvider from './context/AppContext.jsx'

// Filter out browser extension errors from console (optional)
if (import.meta.env.DEV) {
  const originalError = console.error
  console.error = (...args) => {
    const errorMessage = args[0]?.toString() || ''
    // Filter out common extension errors
    if (
      errorMessage.includes('extensions.aitopia.ai') ||
      errorMessage.includes('ERR_HTTP2_PROTOCOL_ERROR') ||
      errorMessage.includes('net::ERR_')
    ) {
      return // Suppress extension errors
    }
    originalError.apply(console, args)
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <AppContextProvider>
      <App />
    </AppContextProvider>
  </BrowserRouter>,
)
