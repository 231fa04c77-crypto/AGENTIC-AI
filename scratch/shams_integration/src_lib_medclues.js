/**
 * SHAMS – MEDCLUES Emergency Integration
 *
 * This single file contains:
 *  1. medcluesService   — Calls MEDCLUES Partner API from SHAMS frontend
 *  2. API response types
 *  3. LocalStorage-based case tracker for the SHAMS app
 *
 * Deployment:
 *  - Copy to your SHAMS project: src/lib/medclues.js
 *  - Set env vars in Vercel: NEXT_PUBLIC_MEDCLUES_API_KEY, NEXT_PUBLIC_MEDCLUES_BASE_URL
 *
 * Usage:
 *  import { triggerEmergency, getEmergencyStatus, cancelEmergency } from '@/lib/medclues'
 */

// ─── Configuration ────────────────────────────────────────────────────────────

const MEDCLUES_BASE_URL =
  process.env.NEXT_PUBLIC_MEDCLUES_BASE_URL ||
  'https://medclues-api.onrender.com'

const MEDCLUES_API_KEY =
  process.env.NEXT_PUBLIC_MEDCLUES_API_KEY || ''

const ACTIVE_CASE_KEY = 'medclues_active_case'

// ─── Headers builder (sandbox mode: no HMAC) ─────────────────────────────────

function buildHeaders() {
  return {
    'Content-Type': 'application/json',
    'X-Api-Key': MEDCLUES_API_KEY,
    'X-Timestamp': String(Math.floor(Date.now() / 1000)),
    'X-Signature': 'sandbox_placeholder',  // replace with real HMAC in production
    'X-Sandbox-Bypass': 'true',            // remove in production
  }
}

// ─── Core API calls ───────────────────────────────────────────────────────────

/**
 * triggerEmergency
 *  Call this when a SHAMS user taps the SOS button.
 *
 * @param {Object} params
 * @param {string} params.patientName      User's full name
 * @param {string} params.patientPhone     User's phone number (with country code)
 * @param {number} params.latitude         GPS latitude
 * @param {number} params.longitude        GPS longitude
 * @param {string} [params.locationText]   Human-readable location string
 * @param {Object} [params.additionalInfo] Extra context (trip_id, vehicle, etc.)
 * @returns {Promise<Object>}              MEDCLUES case data
 */
export async function triggerEmergency({
  patientName,
  patientPhone,
  latitude,
  longitude,
  locationText,
  additionalInfo = {},
}) {
  const requestId = `SHAMS-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`

  const body = {
    request_id: requestId,
    patient_name: patientName,
    patient_phone: patientPhone,
    latitude,
    longitude,
    location_text: locationText || null,
    emergency_type: 'MEDICAL_EMERGENCY',
    additional_info: {
      source: 'shams_app',
      ...additionalInfo,
    },
    partner_metadata: { request_id: requestId },
    // Webhook URL — set in Vercel env or hardcode your Next.js API route
    webhook_url:
      process.env.NEXT_PUBLIC_MEDCLUES_WEBHOOK_URL ||
      `${typeof window !== 'undefined' ? window.location.origin : ''}/api/medclues/webhook`,
  }

  const response = await fetch(`${MEDCLUES_BASE_URL}/api/partner/emergency/cases`, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify(body),
  })

  const data = await response.json()

  if (!response.ok || !data.success) {
    throw new Error(data.detail || data.message || `HTTP ${response.status}`)
  }

  // Persist the active case in localStorage for status polling
  if (typeof window !== 'undefined') {
    localStorage.setItem(ACTIVE_CASE_KEY, JSON.stringify({
      caseId: data.data.case_id,
      requestId,
      createdAt: new Date().toISOString(),
    }))
  }

  return data.data
}

/**
 * getEmergencyStatus
 *  Poll the status of an active MEDCLUES case.
 *
 * @param {string} caseId   MEDCLUES case public ID (e.g. MED-EMG-20260711-00001)
 * @returns {Promise<Object>}
 */
export async function getEmergencyStatus(caseId) {
  const response = await fetch(
    `${MEDCLUES_BASE_URL}/api/partner/emergency/cases/${caseId}`,
    { headers: buildHeaders() }
  )
  const data = await response.json()
  if (!response.ok || !data.success) {
    throw new Error(data.detail || data.message || `HTTP ${response.status}`)
  }
  return data.data
}

/**
 * cancelEmergency
 *  Cancel an active case (e.g. user recovered, false alarm).
 *
 * @param {string} caseId   MEDCLUES case public ID
 * @param {string} [reason] Cancellation reason
 * @returns {Promise<Object>}
 */
export async function cancelEmergency(caseId, reason = 'Cancelled by user') {
  const response = await fetch(
    `${MEDCLUES_BASE_URL}/api/partner/emergency/cases/${caseId}/cancel`,
    {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify({ reason }),
    }
  )
  const data = await response.json()
  if (!response.ok || !data.success) {
    throw new Error(data.detail || data.message || `HTTP ${response.status}`)
  }

  // Clear the stored active case
  if (typeof window !== 'undefined') {
    localStorage.removeItem(ACTIVE_CASE_KEY)
  }

  return data.data
}

// ─── Local state helpers ──────────────────────────────────────────────────────

/** Return the stored active case (if any) from localStorage. */
export function getActiveCase() {
  if (typeof window === 'undefined') return null
  const raw = localStorage.getItem(ACTIVE_CASE_KEY)
  return raw ? JSON.parse(raw) : null
}

/** Clear the stored active case (after completion). */
export function clearActiveCase() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(ACTIVE_CASE_KEY)
  }
}
