const MAX_DIGEST_LENGTH = 8000

function canonicalizeURL (value) {
  try {
    const url = new URL(value)
    url.hash = ''
    url.username = ''
    url.password = ''
    return url.toString()
  } catch {
    return value
  }
}

function createContentDigest (text) {
  return (text || '').replace(/\s+/g, ' ').trim().slice(0, MAX_DIGEST_LENGTH)
}

function calculateHistoryRelevance (item, query, now) {
  const searchText = [item.url, item.canonicalURL, item.title, item.contentDigest, item.notesText].filter(Boolean).join(' ').toLowerCase()
  const normalizedQuery = (query || '').trim().toLowerCase()
  const textScore = normalizedQuery && searchText.includes(normalizedQuery) ? 100 : 0
  const visits = Math.log2((item.visitCount || 0) + 1) * 8
  const dwell = Math.log2((item.activeDwellTime || 0) + 1) * 2
  const attention = (item.attentionScore || 0) * 10
  const age = Math.max(0, (now - (item.lastVisit || 0)) / (24 * 60 * 60 * 1000))
  const recency = 30 / (1 + age)

  return textScore + visits + dwell + attention + recency
}

const historyGraph = {
  MAX_DIGEST_LENGTH,
  canonicalizeURL,
  createContentDigest,
  calculateHistoryRelevance
}

if (typeof window !== 'undefined') {
  window.historyGraph = historyGraph
}

if (typeof module !== 'undefined') {
  module.exports = historyGraph
}
