/* pure helpers for the informational content of a tab - no DOM access, so this stays testable */

const RGB_COLOR = /^rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)$/
const SAFE_ICON_PROTOCOL = /^(https?|data|file|min):/i
const MAX_LABEL_LENGTH = 60

function abbreviateDomain (domain) {
  if (!domain) {
    return ''
  }
  let result = String(domain).toLowerCase()
  if (result.startsWith('www.') && result.split('.').length > 2) {
    result = result.replace('www.', '')
  }
  return result.substring(0, MAX_LABEL_LENGTH)
}

/*
The label is the shortest meaningful description of the page:
LLM abbreviation > registrable domain > page title > default label
*/
function getTabLabel ({ abbreviation, domain, title, isNewTab, defaultLabel }) {
  if (isNewTab) {
    return defaultLabel
  }
  if (abbreviation && String(abbreviation).trim()) {
    return String(abbreviation).trim().substring(0, MAX_LABEL_LENGTH)
  }
  if (domain) {
    return abbreviateDomain(domain)
  }
  if (title && String(title).trim()) {
    return String(title).trim().substring(0, MAX_LABEL_LENGTH)
  }
  return defaultLabel
}

/* page-provided colors are untrusted, so only exact rgb() values are allowed into a style property */
function getAccentColor (tabData) {
  if (!tabData) {
    return null
  }
  const candidates = [tabData.themeColor, tabData.backgroundColor]
  for (const candidate of candidates) {
    if (candidate && typeof candidate.color === 'string' && RGB_COLOR.test(candidate.color)) {
      return candidate.color
    }
  }
  return null
}

function getFaviconURL (tabData) {
  if (tabData && tabData.favicon && typeof tabData.favicon.url === 'string' && SAFE_ICON_PROTOCOL.test(tabData.favicon.url)) {
    return tabData.favicon.url
  }
  return null
}

module.exports = {
  abbreviateDomain,
  getTabLabel,
  getAccentColor,
  getFaviconURL
}
