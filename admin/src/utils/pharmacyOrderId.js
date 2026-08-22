/** Extract pharmacy order public IDs (PHO…) from QR payloads. */

const PHO_RE = /^PHO[A-Z0-9]{8,}$/i
const PHO_FIND = /PHO[0-9]{8,}/i

export function normalizePharmacyOrderId(value) {
  return String(value || '').trim().toUpperCase()
}

export function isValidPharmacyOrderId(value) {
  const t = normalizePharmacyOrderId(value)
  return PHO_RE.test(t) || /^PHO\d{8,}$/i.test(t)
}

/**
 * Pull PHO…… from bare code, URL, or JSON.
 * @returns {string|null}
 */
export function extractPharmacyOrderId(raw) {
  const text = String(raw || '').trim()
  if (!text) return null

  const direct = normalizePharmacyOrderId(text)
  if (isValidPharmacyOrderId(direct)) return direct

  if (text.startsWith('{') || text.startsWith('[')) {
    try {
      const data = JSON.parse(text)
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        for (const key of ['publicId', 'public_id', 'orderId', 'order_id', 'token', 'code', 'id']) {
          if (data[key] != null) {
            const found = extractPharmacyOrderId(String(data[key]))
            if (found) return found
          }
        }
      }
    } catch {
      /* fall through */
    }
  }

  const match = text.match(PHO_FIND)
  return match ? match[0].toUpperCase() : null
}
