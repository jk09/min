/*
Publishes /b debug records to a dedicated internal tab (min:llmPromptDebug).
Reuses an already-open debug tab instead of opening a new one each run.
*/

const browserUI = require('browserUI.js')
const urlParser = require('util/urlParser.js')

const DEBUG_PAGE_URL = 'min://app/pages/llmPromptDebug/index.html'

let latestRecord = null

function findDebugTab () {
    return tabs.get().find(tab => tab.url && tab.url.startsWith(DEBUG_PAGE_URL)) || null
}

function openDebugTab () {
    const tabId = tabs.add({ url: DEBUG_PAGE_URL })
    browserUI.addTab(tabId, { enterEditMode: false, openInBackground: false })
    return tabId
}

/* record: see planningSkill.buildDebugRecord */
function publish (record) {
    latestRecord = record

    const existingTab = findDebugTab()

    if (existingTab) {
        webviews.callAsync(existingTab.id, 'send', ['receiveLlmDebugData', latestRecord])
    } else {
        openDebugTab()
    }
}

webviews.bindIPC('getLlmDebugData', function (tabId) {
    if (!urlParser.isInternalURL(tabs.get(tabId).url)) {
        throw new Error()
    }
    webviews.callAsync(tabId, 'send', ['receiveLlmDebugData', latestRecord])
})

module.exports = { publish }
