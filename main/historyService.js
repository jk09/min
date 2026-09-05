const path = require('path')
const { ipcMain: ipc } = require('electron')
const appState = require('./appState')
const { HistoryRepository } = require('./historyRepository')

const repository = new HistoryRepository(path.join(appState.userDataPath, 'history.sqlite'))

ipc.handle('history:request', function (event, request) {
  return repository.request(request)
})

module.exports = { repository }
