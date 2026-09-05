const electron = require('electron')
const path = require('path')

const {
  app, // Module to control application life.
  session,
  ipcMain: ipc,
  Menu,
  crashReporter,
  BrowserWindow
} = electron

const appState = require('./appState')
const settings = require('../js/util/settings/settingsMain')
const { windows } = require('./windowManagement')
const { registerBundleProtocol } = require('./minInternalProtocol')
const { registryInstaller } = require('./registryConfig')
const { buildAppMenu, createDockMenu } = require('./menu')
const {
  createWindow,
  sendIPCToWindow,
  handleCommandLineArguments,
  getWindowWebContents
} = require('./windowUtils')

crashReporter.start({
  submitURL: 'https://minbrowser.org/',
  uploadToServer: false,
  compress: true
})

if (process.argv.some(arg => arg === '-v' || arg === '--version')) {
  console.log('Min: ' + app.getVersion())
  console.log('Chromium: ' + process.versions.chrome)
  process.exit()
}

let isInstallerRunning = false

if (process.platform === 'win32') {
  (async function () {
    var squirrelCommand = process.argv[1]
    if (squirrelCommand === '--squirrel-install' || squirrelCommand === '--squirrel-updated') {
      isInstallerRunning = true
      await registryInstaller.install()
    }
    if (squirrelCommand === '--squirrel-uninstall') {
      isInstallerRunning = true
      await registryInstaller.uninstall()
    }
    if (require('electron-squirrel-startup')) {
      app.quit()
    }
  })()
}

// workaround for flicker when focusing app (https://github.com/electron/electron/issues/17942)
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows', 'true')

settings.initialize(appState.userDataPath)

if (settings.get('userSelectedLanguage')) {
  app.commandLine.appendSwitch('lang', settings.get('userSelectedLanguage'))
}

var mainMenu = null
var secondaryMenu = null
var appIsReady = false

const isFirstInstance = app.requestSingleInstanceLock()

if (!isFirstInstance) {
  app.quit()
  return
}

// side-effect only modules: each registers its own ipc/app/session handlers on require,
// mirroring the load order that used to be defined by scripts/buildMain.js
require('./filtering')
require('./viewManager')
require('./download')
require('./UASwitcher')
require('./permissionManager')
require('./prompt')
require('./remoteMenu')
require('./remoteActions')
require('./llmEngine')
require('./keychainService')
require('./historyService')
require('../js/util/proxy')
require('./themeMain')

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
app.on('ready', function () {
  settings.set('restartNow', false)
  appIsReady = true

  /* the installer launches the app to install registry items and shortcuts,
  but if that's happening, we shouldn't display anything */
  if (isInstallerRunning) {
    return
  }

  registerBundleProtocol(session.defaultSession)

  const newWin = createWindow()

  getWindowWebContents(newWin).on('did-finish-load', function () {
    // if a URL was passed as a command line argument (probably because Min is set as the default browser on Linux), open it.
    handleCommandLineArguments(process.argv)

    // there is a URL from an "open-url" event (on Mac)
    if (global.URLToOpen) {
      // if there is a previously set URL to open (probably from opening a link on macOS), open it
      sendIPCToWindow(newWin, 'addTab', {
        url: global.URLToOpen
      })
      global.URLToOpen = null
    }
  })

  mainMenu = buildAppMenu()
  Menu.setApplicationMenu(mainMenu)
  createDockMenu()
})

app.on('open-url', function (e, url) {
  if (appIsReady) {
    sendIPCToWindow(windows.getCurrent(), 'addTab', {
      url: url
    })
  } else {
    global.URLToOpen = url // this will be handled later in the createWindow callback
  }
})

// handoff support for macOS
app.on('continue-activity', function (e, type, userInfo, details) {
  if (type === 'NSUserActivityTypeBrowsingWeb' && details.webpageURL) {
    e.preventDefault()
    sendIPCToWindow(windows.getCurrent(), 'addTab', {
      url: details.webpageURL
    })
  }
})

app.on('second-instance', function (e, argv, workingDir) {
  if (windows.getCurrent()) {
    if (windows.getCurrent().isMinimized()) {
      windows.getCurrent().restore()
    }
    windows.getCurrent().focus()
    // add a tab with the new URL
    handleCommandLineArguments(argv)
  }
})

/**
 * Emitted when the application is activated, which usually happens when clicks on the applications's dock icon
 * https://github.com/electron/electron/blob/master/docs/api/app.md#event-activate-os-x
 *
 * Opens a new tab when all tabs are closed, and min is still open by clicking on the application dock icon
 */
app.on('activate', function (/* e, hasVisibleWindows */) {
  if (!windows.getCurrent() && appIsReady) { // sometimes, the event will be triggered before the app is ready, and creating new windows will fail
    createWindow()
  }
})

ipc.on('focusMainWebContents', function () {
  getWindowWebContents(windows.getCurrent()).focus()
})

ipc.on('showSecondaryMenu', function (event, data) {
  if (!secondaryMenu) {
    secondaryMenu = buildAppMenu({ secondary: true })
  }
  secondaryMenu.popup({
    x: data.x,
    y: data.y
  })
})

ipc.on('handoffUpdate', function (e, data) {
  if (app.setUserActivity && data.url && data.url.startsWith('http')) {
    app.setUserActivity('NSUserActivityTypeBrowsingWeb', {}, data.url)
  } else if (app.invalidateCurrentActivity) {
    app.invalidateCurrentActivity()
  }
})

ipc.on('quit', function () {
  app.quit()
})

ipc.on('tab-state-change', function (e, events) {
  const sourceWindowId = windows.windowFromContents(e.sender)?.id
  if (!sourceWindowId) {
    console.warn('warning: received tab state update from window after destruction, ignoring')
    return
  }
  windows.getAll().forEach(function (window) {
    if (getWindowWebContents(window).id !== e.sender.id) {
      getWindowWebContents(window).send('tab-state-change-receive', {
        sourceWindowId,
        events
      })
    }
  })
})

ipc.on('request-tab-state', function (e) {
  const otherWindow = windows.getAll().find(w => getWindowWebContents(w).id !== e.sender.id)
  if (!otherWindow) {
    throw new Error('secondary window doesn\'t exist as source for tab state')
  }
  ipc.once('return-tab-state', function (e2, data) {
    e.returnValue = data
  })
  getWindowWebContents(otherWindow).send('read-tab-state')
})

/* places service */

const legacyHistoryExportPage = 'file://' + path.join(appState.appRoot, 'js/places/legacyHistoryExport.html')

app.once('ready', function () {
  const legacyHistoryExportWindow = new BrowserWindow({
    show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  })
  legacyHistoryExportWindow.loadURL(legacyHistoryExportPage)
  ipc.once('history:legacyMigrationComplete', function () {
    if (!legacyHistoryExportWindow.isDestroyed()) {
      legacyHistoryExportWindow.close()
    }
  })
  legacyHistoryExportWindow.webContents.once('did-finish-load', function () {
    setTimeout(function () {
      legacyHistoryExportWindow.close()
    }, 30000)
  })
})

/* translate service */

const translatePage = 'min://app/pages/translateService/index.html'
const translatePreload = path.join(appState.appRoot, 'pages/translateService/translateServicePreload.js')

app.on('ready', function () {
  ipc.on('page-translation-session-create', function (e) {
    let translateWindow = new BrowserWindow({
      width: 300,
      height: 300,
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: translatePreload
      }
    })

    translateWindow.loadURL(translatePage)
    // translateWindow.webContents.openDevTools({mode: 'detach'})

    translateWindow.webContents.once('did-finish-load', function () {
      translateWindow.webContents.postMessage('page-translation-session-create', null, e.ports)
    })
  })
})

