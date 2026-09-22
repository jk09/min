const path = require('path')
const { ipcMain: ipc } = require('electron')
const appState = require('./appState')
const { HistoryRepository } = require('./historyRepository')
const { getChromeWindow } = require('./chromeCapabilities')

const repository = HistoryRepository.open(path.join(appState.userDataPath, 'history.sqlite'))

ipc.handle('history:request', async function (event, request) {
  return (await repository).request(request)
})

/* the chrome renderer uses a sender-validated channel; the legacy one stays for the migration window */
ipc.handle('chrome:history:request', async function (event, request) {
  getChromeWindow(event)
  if (!request || typeof request !== 'object' || typeof request.action !== 'string') {
    throw new TypeError('history request must name an action')
  }
  return (await repository).request(request)
})

module.exports = { repository }
