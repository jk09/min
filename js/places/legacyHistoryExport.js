/* global indexedDB */

const { ipcRenderer } = require('electron')

async function exportLegacyHistory () {
  if (!indexedDB.databases) {
    return
  }
  const databases = await indexedDB.databases()
  if (!databases.some(database => database.name === 'browsingData2')) {
    return
  }

  const Dexie = require('dexie')
  const db = new Dexie('browsingData2')
  db.version(1).stores({
    places: '++id, &url, title, color, visitCount, lastVisit, pageHTML, extractedText, *searchIndex, isBookmarked, *tags, metadata',
    readingList: 'url, time, visitCount, pageHTML, article, extraData'
  })
  db.version(2).stores({
    places: '++id, &url, canonicalURL, title, color, visitCount, firstVisit, lastVisit, activeDwellTime, attentionScore, pageHTML, extractedText, contentDigest, *searchIndex, isBookmarked, *tags, metadata',
    readingList: 'url, time, visitCount, pageHTML, article, extraData',
    visits: '++id, placeId, visitedAt, tabId, sourcePlaceId',
    navigationEdges: '++id, sourcePlaceId, destinationPlaceId, visitedAt, [sourcePlaceId+destinationPlaceId]',
    notes: '++id, placeId, updatedAt'
  })
  await db.open()
  await ipcRenderer.invoke('history:request', {
    action: 'importLegacyHistory',
    legacy: {
      places: await db.places.toArray(),
      visits: db.visits ? await db.visits.toArray() : [],
      navigationEdges: db.navigationEdges ? await db.navigationEdges.toArray() : [],
      notes: db.notes ? await db.notes.toArray() : []
    }
  })
  db.close()
  ipcRenderer.send('history:legacyMigrationComplete')
}

exportLegacyHistory().catch(function (error) {
  console.warn('history migration failed', error)
})
