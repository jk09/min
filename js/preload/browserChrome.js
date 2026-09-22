const { contextBridge, ipcRenderer } = require('electron')
const { webUtils } = require('electron')

const VIEW_METHODS = Object.freeze([
  'canGoToOffset', 'copy', 'copyImageAt', 'downloadURL', 'executeJavaScript',
  'findInPage', 'focus', 'getZoomFactor', 'goBack', 'goForward', 'goToIndex',
  'goToOffset', 'inspectElement', 'paste', 'pasteAndMatchStyle', 'reload',
  'reloadIgnoringCache', 'replaceMisspelling', 'savePage', 'send', 'sendToFrame',
  'setAudioMuted', 'setVisualZoomLevelLimits', 'stop', 'stopFindInPage',
  'toggleDevTools', 'zoomFactor'
])

/* main-process commands the chrome renderer is allowed to listen for */
const APP_COMMANDS = Object.freeze([
  'addPrivateTab', 'addTab', 'enterFocusMode', 'exitFocusMode', 'findInPage',
  'goBack', 'goForward', 'inspectPage', 'openPDF', 'print', 'saveCurrentPage',
  'set-file-view', 'zoomIn', 'zoomOut', 'zoomReset'
])

function getArgument (name) {
  const prefix = '--' + name + '='
  const argument = process.argv.find(value => value.startsWith(prefix))
  return argument ? argument.slice(prefix.length) : ''
}

contextBridge.exposeInMainWorld('min', {
  bootstrap: {
    appName: getArgument('app-name'),
    appVersion: getArgument('app-version'),
    developmentMode: process.argv.includes('--development-mode'),
    initialTask: getArgument('initial-task') || null,
    initialWindow: process.argv.includes('--initial-window'),
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
      const states = ['maximize', 'unmaximize', 'enter-full-screen', 'leave-full-screen', 'focus', 'blur']
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
    writeText: text => ipcRenderer.invoke('chrome:clipboard:write-text', text),
    writeBookmark: data => ipcRenderer.invoke('chrome:clipboard:write-bookmark', data)
  },
  app: {
    quit: () => ipcRenderer.invoke('chrome:app:quit'),
    setWindowTitle: title => ipcRenderer.invoke('chrome:app:set-window-title', title),
    showSecondaryMenu: position => ipcRenderer.invoke('chrome:app:show-secondary-menu', position),
    showSaveDialog: defaultPath => ipcRenderer.invoke('chrome:app:show-save-dialog', defaultPath),
    showFocusModeDialog: () => ipcRenderer.invoke('chrome:app:show-focus-mode-dialog'),
    addWordToDictionary: word => ipcRenderer.invoke('chrome:app:add-word-to-dictionary', word),
    updateHandoff: url => ipcRenderer.invoke('chrome:app:update-handoff', url),
    getHosts: () => ipcRenderer.invoke('chrome:app:hosts'),
    writeBookmarksBackup: html => ipcRenderer.invoke('chrome:app:write-bookmarks-backup', html),
    onCommand: (command, callback) => {
      if (!APP_COMMANDS.includes(command)) {
        throw new Error('app command is not allowed')
      }
      return subscribe(command, callback)
    },
    onBeforeInputEvent: callback => subscribe('before-input-event', callback)
  },
  permissions: {
    grant: permissionId => ipcRenderer.invoke('chrome:permissions:grant', permissionId),
    onChange: callback => subscribe('updatePermissions', callback)
  },
  tabState: {
    requestSync: () => ipcRenderer.invoke('chrome:tab-state:request'),
    sendChanges: events => ipcRenderer.send('chrome:tab-state:change', events),
    returnState: state => ipcRenderer.send('chrome:tab-state:return', state),
    onChanges: callback => subscribe('chrome:tab-state:receive', callback),
    onReadRequest: callback => subscribe('chrome:tab-state:read', callback)
  },
  history: {
    request: data => ipcRenderer.invoke('chrome:history:request', data)
  },
  settings: {
    read: () => ipcRenderer.invoke('chrome:settings:read'),
    set: (key, value) => ipcRenderer.invoke('chrome:settings:set', key, value),
    onChanged: callback => subscribe('settingChanged', callback)
  },
  session: {
    backup: data => ipcRenderer.invoke('chrome:session:backup', data),
    read: () => ipcRenderer.invoke('chrome:session:read'),
    write: data => ipcRenderer.invoke('chrome:session:write', data)
  },
  views: {
    callMethod: data => {
      if (!data || !VIEW_METHODS.includes(data.method)) {
        return Promise.reject(new Error('view method is not allowed'))
      }
      return ipcRenderer.send('callViewMethod', data)
    },
    capture: data => ipcRenderer.send('getCapture', data),
    create: data => ipcRenderer.send('createView', data),
    destroy: id => ipcRenderer.send('destroyView', id),
    focus: id => ipcRenderer.send('focusView', id),
    focusMain: () => ipcRenderer.send('focusMainWebContents'),
    getNavigationHistory: id => ipcRenderer.invoke('getNavigationHistory', id),
    hideCurrent: () => ipcRenderer.send('hideCurrentView'),
    loadURL: data => ipcRenderer.send('loadURLInView', data),
    setBounds: data => ipcRenderer.send('setBounds', data),
    setCurrent: data => ipcRenderer.send('setView', data),
    onAsyncCallResult: callback => subscribe('async-call-result', callback),
    onCapture: callback => subscribe('captureData', callback),
    onEvent: callback => subscribe('view-event', callback),
    onIPC: callback => subscribe('view-ipc', callback),
    onWindowFocus: callback => subscribe('windowFocus', callback)
  },
  menu: {
    onItemSelected: callback => subscribe('context-menu-item-selected', callback),
    onWillClose: callback => subscribe('context-menu-will-close', callback),
    open: data => ipcRenderer.send('chrome:menu:open', data)
  },
  downloads: {
    cancel: path => ipcRenderer.send('chrome:downloads:cancel', path),
    onInfo: callback => subscribe('download-info', callback),
    open: path => ipcRenderer.invoke('chrome:downloads:open', path),
    showInFolder: path => ipcRenderer.invoke('chrome:downloads:show-in-folder', path),
    startFileDrag: path => ipcRenderer.invoke('chrome:downloads:start-file-drag', path)
  },
  files: {
    toFileURL: file => {
      if (!file || typeof file !== 'object') {
        return null
      }
      const filePath = webUtils.getPathForFile(file)
      return filePath ? 'file://' + filePath.replace(/\\/g, '/') : null
    }
  },
  userscripts: {
    list: () => ipcRenderer.invoke('chrome:userscripts:list'),
    openDirectory: () => ipcRenderer.invoke('chrome:userscripts:open-directory'),
    watch: () => ipcRenderer.invoke('chrome:userscripts:watch'),
    unwatch: () => ipcRenderer.invoke('chrome:userscripts:unwatch'),
    onChanged: callback => subscribe('chrome:userscripts:changed', callback)
  },
  passwordManager: {
    checkTool: manager => ipcRenderer.invoke('chrome:password-manager:check-tool', manager),
    bitwarden: (operation, data) => ipcRenderer.invoke('chrome:password-manager:bitwarden', operation, data),
    onePassword: (operation, data) => ipcRenderer.invoke('chrome:password-manager:onepassword', operation, data),
    installTool: (manager, file) => ipcRenderer.invoke('chrome:password-manager:install-tool', manager, getFilePath(file)),
    launchInstaller: (manager, file) => ipcRenderer.invoke('chrome:password-manager:launch-installer', manager, getFilePath(file)),
    readImport: () => ipcRenderer.invoke('chrome:password-manager:read-import'),
    prompt: options => ipcRenderer.sendSync('chrome:password-manager:prompt', options),
    credentials: {
      delete: account => ipcRenderer.invoke('credentialStoreDeletePassword', account),
      getAll: () => ipcRenderer.invoke('credentialStoreGetCredentials'),
      set: account => ipcRenderer.invoke('credentialStoreSetPassword', account),
      setAll: accounts => ipcRenderer.invoke('credentialStoreSetPasswordBulk', accounts)
    }
  },
  prompt: {
    cancel: requestId => ipcRenderer.invoke('chrome:prompt:cancel', { requestId }),
    complete: request => ipcRenderer.invoke('chrome:prompt:complete', request),
    getStatus: () => ipcRenderer.invoke('chrome:prompt:get-status'),
    onProgress: (requestId, callback) => subscribe('llmEngine:progress:' + requestId, callback)
  }
})

function subscribe (channel, callback) {
  if (typeof callback !== 'function') {
    throw new TypeError('listener must be a function')
  }
  const listener = function (_event, data) {
    callback(data)
  }
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

function getFilePath (file) {
  if (!file || typeof file !== 'object') {
    throw new TypeError('file is required')
  }
  return webUtils.getPathForFile(file)
}
