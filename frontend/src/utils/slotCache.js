import axios from 'axios'

const CACHE_TTL_MS = 90_000
const memory = new Map()

function cacheKey(docId, mode) {
  return `${docId}:${(mode || 'offline').toLowerCase()}`
}

function readStorage(key) {
  try {
    const raw = sessionStorage.getItem(`mc_slots:${key}`)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed?.ts || Date.now() - parsed.ts > CACHE_TTL_MS) {
      sessionStorage.removeItem(`mc_slots:${key}`)
      return null
    }
    return parsed.data
  } catch {
    return null
  }
}

function writeStorage(key, data) {
  try {
    sessionStorage.setItem(`mc_slots:${key}`, JSON.stringify({ ts: Date.now(), data }))
  } catch {
    /* quota / private mode */
  }
}

/** Fetch doctor schedule slots with in-memory + sessionStorage cache. */
export async function fetchDoctorSlots(backendUrl, docId, mode = 'offline', { force = false } = {}) {
  const key = cacheKey(docId, mode)
  if (!force) {
    const mem = memory.get(key)
    if (mem && Date.now() - mem.ts < CACHE_TTL_MS) return mem.data
    const stored = readStorage(key)
    if (stored) {
      memory.set(key, { ts: Date.now(), data: stored })
      return stored
    }
  }

  const { data } = await axios.get(`${backendUrl}/api/doctor/${docId}/slots`, {
    params: { mode: mode || 'offline' },
  })
  memory.set(key, { ts: Date.now(), data })
  writeStorage(key, data)
  return data
}

export function invalidateDoctorSlots(docId, mode) {
  if (mode) {
    const key = cacheKey(docId, mode)
    memory.delete(key)
    try {
      sessionStorage.removeItem(`mc_slots:${key}`)
    } catch {
      /* ignore */
    }
    return
  }
  const prefix = `${docId}:`
  for (const key of memory.keys()) {
    if (key.startsWith(prefix)) memory.delete(key)
  }
  try {
    for (let i = sessionStorage.length - 1; i >= 0; i -= 1) {
      const k = sessionStorage.key(i)
      if (k?.startsWith(`mc_slots:${prefix}`)) sessionStorage.removeItem(k)
    }
  } catch {
    /* ignore */
  }
}
