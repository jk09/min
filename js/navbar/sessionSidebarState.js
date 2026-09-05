const MAX_DESCRIPTION_LENGTH = 120

function truncate (value) {
  return value.length > MAX_DESCRIPTION_LENGTH
    ? value.substring(0, MAX_DESCRIPTION_LENGTH - 1) + '\u2026'
    : value
}

function getSessionDescription (tab) {
  const title = String(tab ? tab.title || '' : '').trim()
  if (title) {
    return truncate(title)
  }

  const url = String(tab ? tab.url || '' : '').trim()
  var domain = ''
  try {
    domain = new URL(url).hostname
  } catch (e) {}
  return truncate(domain || url || 'New tab')
}

function getSessionItems (tabs, selectedTabId) {
  return (tabs || []).map(function (tab) {
    return {
      id: tab.id,
      description: getSessionDescription(tab),
      selected: tab.id === selectedTabId
    }
  })
}

module.exports = {
  MAX_DESCRIPTION_LENGTH,
  getSessionDescription,
  getSessionItems
}
