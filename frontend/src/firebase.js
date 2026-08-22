import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider, OAuthProvider, FacebookAuthProvider } from 'firebase/auth'

// Firebase configuration
// These values are used from environment variables or fallback to defaults
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || ""
}

// Validate Firebase configuration
const validateFirebaseConfig = () => {
  const requiredFields = ['apiKey', 'authDomain', 'projectId', 'messagingSenderId', 'appId']
  
  // Check for placeholder values
  const placeholderPatterns = [
    'YOUR_',
    'your-',
    'your_',
    'placeholder',
    'example',
    'demo'
  ]
  
  const isPlaceholder = (value) => {
    if (!value || value.trim() === '') return true
    return placeholderPatterns.some(pattern => 
      value.toUpperCase().includes(pattern.toUpperCase())
    )
  }
  
  const missingFields = requiredFields.filter(field => {
    const value = firebaseConfig[field]
    return !value || isPlaceholder(value)
  })
  
  if (missingFields.length > 0) {
    console.warn('⚠️ Firebase configuration incomplete. Missing or invalid:', missingFields)
    console.warn('Please set environment variables in .env file with valid Firebase credentials')
    return false
  }
  
  return true
}

// Initialize Firebase
let app = null
let auth = null
let googleProvider = null
let appleProvider = null
let facebookProvider = null

// Only initialize if configuration is valid
const isValid = validateFirebaseConfig()

if (isValid) {
  try {
    app = initializeApp(firebaseConfig)
    auth = getAuth(app)
    
    // Configure Google Auth Provider
    googleProvider = new GoogleAuthProvider()
    // Profile and email scopes are included by default
    // Set additional parameters if needed
    googleProvider.setCustomParameters({
      prompt: 'select_account'
    })
    
    // Configure Apple Auth Provider
    appleProvider = new OAuthProvider('apple.com')
    
    // Configure Facebook Auth Provider
    facebookProvider = new FacebookAuthProvider()
    facebookProvider.addScope('email')
    facebookProvider.addScope('public_profile')
    
    console.log('✅ Firebase initialized successfully')
  } catch (error) {
    console.error('❌ Firebase initialization error:', error)
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      config: {
        apiKey: firebaseConfig.apiKey ? 'Set' : 'Missing',
        authDomain: firebaseConfig.authDomain ? 'Set' : 'Missing',
        projectId: firebaseConfig.projectId ? 'Set' : 'Missing'
      }
    })
    
    // Reset to null on error
    app = null
    auth = null
    googleProvider = null
    appleProvider = null
    facebookProvider = null
    
    console.warn('⚠️ Firebase not initialized. Social login will not work until configured.')
  }
} else {
  console.warn('⚠️ Firebase not initialized due to invalid configuration.')
  console.warn('⚠️ Social login features will be disabled until Firebase is properly configured.')
  console.warn('📝 To enable Firebase:')
  console.warn('   1. Create a .env file in the frontend/ directory')
  console.warn('   2. Add your Firebase configuration values')
  console.warn('   3. Restart the development server')
}

export { auth, googleProvider, appleProvider, facebookProvider }
export default app

