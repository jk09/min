document.title = 'History graph | Min'

const searchInput = document.getElementById('history-search')
const summary = document.getElementById('history-summary')
const emptyState = document.getElementById('history-empty')
const resultsContainer = document.getElementById('history-results')
let requestId = 0
let searchTimer = null

function formatDate (time) {
  return time ? new Date(time).toLocaleString() : 'Unknown visit'
}

function createResult (place) {
  const article = document.createElement('article')
  article.className = 'history-entry'

  const openButton = document.createElement('button')
  openButton.className = 'history-open'
  openButton.type = 'button'
  openButton.textContent = place.title || place.url
  openButton.title = place.url
  openButton.addEventListener('click', function () {
    postMessage({ message: 'historyGraphRequest', action: 'open', url: place.url })
  })

  const url = document.createElement('p')
  url.className = 'history-url'
  url.textContent = place.url

  const details = document.createElement('p')
  details.className = 'history-details'
  details.textContent = `${place.visitCount || 0} visits | ${formatDate(place.lastVisit)} | ${place.relationshipCount || 0} connections`

  const digest = document.createElement('p')
  digest.className = 'history-digest'
  digest.textContent = place.contentDigest || 'No page digest captured.'

  const note = document.createElement('textarea')
  note.className = 'history-note'
  note.rows = 2
  note.placeholder = 'Personal note'
  note.value = (place.notes || []).map(item => item.text).join('\n')
  note.addEventListener('change', function () {
    postMessage({ message: 'historyGraphRequest', action: 'saveNote', url: place.url, text: note.value })
  })

  article.append(openButton, url, details, digest, note)
  return article
}

function renderResults (places) {
  resultsContainer.replaceChildren()
  emptyState.hidden = places.length > 0
  summary.textContent = `${places.length} local ${places.length === 1 ? 'page' : 'pages'}`
  places.forEach(function (place) {
    resultsContainer.appendChild(createResult(place))
  })
}

function requestSearch () {
  requestId++
  postMessage({ message: 'historyGraphRequest', action: 'search', query: searchInput.value, requestId: requestId })
}

window.addEventListener('message', function (event) {
  if (!event.data || event.data.message !== 'receiveHistoryGraphData') {
    return
  }
  const data = event.data.data
  if (data.action === 'search' && data.requestId === requestId) {
    renderResults(data.results || [])
  }
  if (data.action === 'saveNote') {
    requestSearch()
  }
})

searchInput.addEventListener('input', function () {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(requestSearch, 150)
})

requestSearch()