/*
Wraps APIs that are only available in the main process in IPC messages, so that the BrowserWindow can use them
*/

const { app, ipcMain: ipc, dialog, shell } = require('electron')
const { getChromeWindow } = require('./chromeCapabilities')
const { l } = require('./localizationMain')

function registerChromeWindowAction (name, action) {
  ipc.handle('chrome:window:' + name, function (event, value) {
    action(getChromeWindow(event), value)
  })
}

registerChromeWindowAction('minimize', function (window) {
  window.minimize()
})
registerChromeWindowAction('maximize', function (window) {
  window.maximize()
})
registerChromeWindowAction('unmaximize', function (window) {
  window.unmaximize()
})
registerChromeWindowAction('close', function (window) {
  window.close()
})
registerChromeWindowAction('set-full-screen', function (window, enabled) {
  if (typeof enabled !== 'boolean') {
    throw new Error('fullscreen state must be a boolean')
  }
  window.setFullScreen(enabled)
})

ipc.handle('chrome:clipboard:write-text', function (event, text) {
  if (typeof text !== 'string') {
    throw new Error('clipboard text must be a string')
  }
  getChromeWindow(event)
  require('electron').clipboard.writeText(text)
})

ipc.handle('chrome:clipboard:write-bookmark', function (event, data) {
  if (!data || typeof data !== 'object') {
    throw new Error('bookmark data is required')
  }
  if (typeof data.text !== 'string' || typeof data.html !== 'string') {
    throw new Error('bookmark text and html must be strings')
  }
  getChromeWindow(event)
  require('electron').clipboard.write({
    text: data.text,
    bookmark: typeof data.bookmark === 'string' ? data.bookmark : '',
    html: data.html
  })
})

function requireDownloadPath (event, path) {
  if (typeof path !== 'string' || path.length === 0) {
    throw new Error('download path must be a non-empty string')
  }
  getChromeWindow(event)
}

ipc.handle('chrome:downloads:open', function (event, path) {
  requireDownloadPath(event, path)
  return shell.openPath(path)
})

ipc.handle('chrome:downloads:show-in-folder', function (event, path) {
  requireDownloadPath(event, path)
  shell.showItemInFolder(path)
})

ipc.handle('chrome:downloads:start-file-drag', function (event, path) {
  requireDownloadPath(event, path)
  return app.getFileIcon(path, {}).then(function (icon) {
    event.sender.startDrag({ file: path, icon })
  })
})

function showFocusModeDialog1() {
  dialog.showMessageBox({
    type: 'info',
    buttons: [l('closeDialog')],
    message: l('isFocusMode'),
    detail: l('focusModeExplanation1') + ' ' + l('focusModeExplanation2')
  })
}

function showFocusModeDialog2() {
  dialog.showMessageBox({
    type: 'info',
    buttons: [l('closeDialog')],
    message: l('isFocusMode'),
    detail: l('focusModeExplanation2')
  })
}

ipc.handle('chrome:app:show-focus-mode-dialog', function (event) {
  getChromeWindow(event)
  showFocusModeDialog2()
})

module.exports = { showFocusModeDialog1, showFocusModeDialog2 }
