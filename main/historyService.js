const path = require('path')
const { ipcMain: ipc } = require('electron')
const appState = require('./appState')
const { HistoryRepository } = require('./historyRepository')

const repository = HistoryRepository.open(path.join(appState.userDataPath, 'history.sqlite'))

ipc.handle('history:request', async function (event, request) {
  return (await repository).request(request)
})

module.exports = { repository }
