import axios from 'axios'

/**
 * Submit human-in-the-loop review for an AI coordination finding.
 * @returns {Promise<object>} API response data
 */
export async function submitFindingReview(backendUrl, authHeaders, findingId, decision, note = '', modifications = {}) {
  const { data } = await axios.post(
    `${backendUrl}/api/ai/findings/${findingId}/review`,
    { decision, note, modifications },
    { headers: authHeaders }
  )
  return data
}
