const { contextBridge, ipcRenderer } = require('electron')

function getArgument (name) {
  const prefix = '--' + name + '='
  const argument = process.argv.find(value => value.startsWith(prefix))
  return argument ? argument.slice(prefix.length) : ''
}

contextBridge.exposeInMainWorld('min', {
  bootstrap: {
    appVersion: getArgument('app-version'),
    developmentMode: process.argv.includes('--development-mode'),
    platform: process.platform,
    windowId: getArgument('window-id')
  },
  window: {
    close: () => ipcRenderer.invoke('chrome:window:close'),
    maximize: () => ipcRenderer.invoke('chrome:window:maximize'),
    minimize: () => ipcRenderer.invoke('chrome:window:minimize'),
    setFullScreen: enabled => ipcRenderer.invoke('chrome:window:set-full-screen', enabled),
    unmaximize: () => ipcRenderer.invoke('chrome:window:unmaximize'),
    onStateChange: callback => {
      const states = ['maximize', 'unmaximize', 'enter-full-screen', 'leave-full-screen']
      const listeners = states.map(function (state) {
        const listener = function () {
          callback(state)
        }
        ipcRenderer.on(state, listener)
        return [state, listener]
      })
      return () => {
        listeners.forEach(function ([state, listener]) {
          ipcRenderer.removeListener(state, listener)
        })
      }
    }
  },
  clipboard: {
    writeText: text => ipcRenderer.invoke('chrome:clipboard:write-text', text)
  }
})
