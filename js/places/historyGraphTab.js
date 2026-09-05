const browserUI = require('browserUI.js')

const HISTORY_GRAPH_URL = 'min://app/pages/historyGraph/index.html'

function open () {
  const existingTab = tabs.get().find(tab => tab.url && tab.url.startsWith(HISTORY_GRAPH_URL))
  if (existingTab) {
    browserUI.switchToTab(existingTab.id)
    return
  }

  const tabId = tabs.add({ url: HISTORY_GRAPH_URL })
  browserUI.addTab(tabId, { openPrompt: false, openInBackground: false })
}

module.exports = { open, HISTORY_GRAPH_URL }
