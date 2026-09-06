const { contextBridge } = require('electron')

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
  }
})
