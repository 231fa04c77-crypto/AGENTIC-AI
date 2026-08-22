/**
 * SHAMS Vite + React – MEDCLUES Emergency Integration Library
 *
 * File path in SHAMS Client project:
 *   src/utils/medclues.js   (or src/lib/medclues.js)
 *
 * Configured for React + Vite.
 */

const MEDCLUES_BASE_URL =
  import.meta.env.VITE_MEDCLUES_BASE_URL ||
  'http://localhost:8000';

const MEDCLUES_API_KEY =
  import.meta.env.VITE_MEDCLUES_API_KEY || '';

const ACTIVE_CASE_KEY = 'medclues_active_case';

function buildHeaders() {
  return {
    'Content-Type': 'application/json',
    'X-Api-Key': MEDCLUES_API_KEY,
    'X-Timestamp': String(Math.floor(Date.now() / 1000)),
    'X-Signature': 'sandbox_placeholder',
    'X-Sandbox-Bypass': 'true',
  };
}

export async function triggerEmergency({
  patientName,
  patientPhone,
  latitude,
  longitude,
  locationText,
  additionalInfo = {},
}) {
  const requestId = `SHAMS-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

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
    // Points to SHAMS local backend Express server (default port 5000)
    webhook_url: 'http://localhost:5000/api/medclues/webhook',
  };

  const response = await fetch(`${MEDCLUES_BASE_URL}/api/partner/emergency/cases`, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify(body),
  });

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.detail || data.message || `HTTP ${response.status}`);
  }

  if (typeof window !== 'undefined') {
    localStorage.setItem(ACTIVE_CASE_KEY, JSON.stringify({
      caseId: data.data.case_id,
      requestId,
      createdAt: new Date().toISOString(),
    }));
  }

  return data.data;
}

export async function getEmergencyStatus(caseId) {
  const response = await fetch(
    `${MEDCLUES_BASE_URL}/api/partner/emergency/cases/${caseId}`,
    { headers: buildHeaders() }
  );
  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.detail || data.message || `HTTP ${response.status}`);
  }
  return data.data;
}

export async function cancelEmergency(caseId, reason = 'Cancelled by user') {
  const response = await fetch(
    `${MEDCLUES_BASE_URL}/api/partner/emergency/cases/${caseId}/cancel`,
    {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify({ reason }),
    }
  );
  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.detail || data.message || `HTTP ${response.status}`);
  }

  if (typeof window !== 'undefined') {
    localStorage.removeItem(ACTIVE_CASE_KEY);
  }

  return data.data;
}

export function getActiveCase() {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(ACTIVE_CASE_KEY);
  return raw ? JSON.parse(raw) : null;
}

export function clearActiveCase() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(ACTIVE_CASE_KEY);
  }
}
