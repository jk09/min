/*
Window creation and messaging helpers shared across main-process modules.
Previously these lived at the top of main/main.js and were available to every
other main-process file only because everything was concatenated into one
global scope (main.build.js).
*/

const fs = require('fs')
const path = require('path')
const electron = require('electron')

const settings = require('../js/util/settings/settingsMain')
const appState = require('./appState')
const windowManagement = require('./windowManagement')
// touchbar.js also depends on this module (for sendIPCToWindow), so this require is
// part of a load-time circular pair. Access it as `touchbar.buildTouchBar(...)` (never
// destructured) and only inside function bodies, so it is safe regardless of require order.
const touchbar = require('./touchbar')

const browserPage = 'min://app/index.html'
const pendingIPCMessages = new WeakMap()

function clamp (n, min, max) {
  return Math.max(Math.min(n, max), min)
}

function startupDiagnosticsLog (...args) {
  if (!appState.isStartupDiagnosticsEnabled) {
    return
  }
  console.log('[startup-diagnostics]', ...args)
}

function getWindowWebContents (win) {
  return windowManagement.getWindowWebContents(win)
}

/*
Reports whether the chrome renderer really is Chromium-only. Nothing in the
regular test suite loads the bundle in a browser, so without this a renderer
that had regained Node access - or one that crashed on startup - would still
look healthy. Runs only under --startup-diagnostics; test/rendererTrustBoundary
asserts on the result.
*/
function probeRendererTrustBoundary (webContents, windowId, securityPreferences) {
  if (!appState.isStartupDiagnosticsEnabled) {
    return
  }

  const probe = `(function () {
    var absent = function (name) { return typeof globalThis[name] === 'undefined' }
    var bridge = globalThis.min

    /*
    The renderer initializes asynchronously, so wait for the tab state that
    js/tabState.js publishes. A bundle that throws on startup still leaves the
    preload bridge intact, so without this the probe would call a dead renderer
    healthy - which is how a broken renderer survived several migration stages.
    */
    var waitForInitialization = function (remainingMs) {
      // checked through a method rather than with typeof, because index.html has an
      // element with id="tabs" and the browser exposes element ids on window, so a
      // plain existence check is satisfied by the DOM node even in a dead renderer
      var tabs = globalThis.tabs
      if (tabs && typeof tabs.get === 'function') {
        return Promise.resolve(true)
      }
      if (remainingMs <= 0) {
        return Promise.resolve(false)
      }
      return new Promise(function (resolve) {
        setTimeout(function () { resolve(waitForInitialization(remainingMs - 100)) }, 100)
      })
    }

    return waitForInitialization(10000).then(function (rendererInitialized) { return {
      rendererInitialized: rendererInitialized,
      require: absent('require'),
      process: absent('process'),
      Buffer: absent('Buffer'),
      module: absent('module'),
      global: typeof globalThis.global,
      electron: absent('electron'),
      fs: absent('fs'),
      ipc: absent('ipc'),
      EventEmitter: absent('EventEmitter'),
      globalArgs: absent('globalArgs'),
      bridgeGroups: bridge ? Object.keys(bridge).sort() : [],
      bridgeLeaks: bridge ? Object.keys(bridge).filter(function (key) {
        return ['ipcRenderer', 'send', 'invoke', 'require', 'shell', 'webUtils'].indexOf(key) !== -1
      }) : ['missing'],
      windowId: bridge && bridge.bootstrap ? bridge.bootstrap.windowId : null,
      platform: bridge && bridge.bootstrap ? bridge.bootstrap.platform : null,
      appVersion: bridge && bridge.bootstrap ? bridge.bootstrap.appVersion : null
    } })
  })()`

  webContents.executeJavaScript(probe, true)
    .then(function (result) {
      console.log('[renderer-trust-boundary]', JSON.stringify(Object.assign({ windowId, securityPreferences }, result)))
    })
    .catch(function (error) {
      console.log('[renderer-trust-boundary]', JSON.stringify({ windowId, error: String(error) }))
    })
}

function sendPendingIPCMessages (webContents) {
  const messages = pendingIPCMessages.get(webContents)
  pendingIPCMessages.delete(webContents)

  messages.forEach(function ({ action, data }) {
    webContents.send(action, data)
  })
}

function queueIPCMessage (webContents, action, data) {
  const messages = pendingIPCMessages.get(webContents)

  if (messages) {
    messages.push({ action, data })
    return
  }

  pendingIPCMessages.set(webContents, [{ action, data }])
  webContents.once('did-finish-load', function () {
    sendPendingIPCMessages(webContents)
  })
}

function sendIPCToWindow (window, action, data) {
  if (window && window.isDestroyed()) {
    console.warn('ignoring message ' + action + ' sent to destroyed window')
    return
  }

  if (window && getWindowWebContents(window).isLoadingMainFrame()) {
    // immediately after a did-finish-load event, isLoading can still be true,
    // so wait a bit to confirm that the page is really loading
    setTimeout(function () {
      if (getWindowWebContents(window).isLoadingMainFrame()) {
        queueIPCMessage(getWindowWebContents(window), action, data || {})
      } else {
        getWindowWebContents(window).send(action, data || {})
      }
    }, 0)
  } else if (window) {
    getWindowWebContents(window).send(action, data || {})
  } else {
    var newWindow = createWindow()
    getWindowWebContents(newWindow).once('did-finish-load', function () {
      getWindowWebContents(newWindow).send(action, data || {})
    })
  }
}

function openTabInWindow (url) {
  sendIPCToWindow(windowManagement.windows.getCurrent(), 'addTab', {
    url: url
  })
}

function saveWindowBounds () {
  if (windowManagement.windows.getCurrent()) {
    var bounds = Object.assign(windowManagement.windows.getCurrent().getBounds(), {
      maximized: windowManagement.windows.getCurrent().isMaximized()
    })
    fs.writeFileSync(path.join(appState.userDataPath, 'windowBounds.json'), JSON.stringify(bounds))
  }
}

function handleCommandLineArguments (argv) {
  // the "ready" event must occur before this function can be used
  if (argv) {
    argv.forEach(function (arg, idx) {
      if (arg && arg.toLowerCase() !== appState.appRoot.toLowerCase()) {
        // URL
        if (arg.indexOf('://') !== -1) {
          sendIPCToWindow(windowManagement.windows.getCurrent(), 'addTab', {
            url: arg
          })
        } else if (idx > 0 && argv[idx - 1] === '-s') {
          // search
          sendIPCToWindow(windowManagement.windows.getCurrent(), 'addTab', {
            url: arg
          })
        } else if (/\.(m?ht(ml)?|pdf)$/.test(arg) && fs.existsSync(arg)) {
          // local files (.html, .mht, mhtml, .pdf)
          sendIPCToWindow(windowManagement.windows.getCurrent(), 'addTab', {
            url: 'file://' + path.resolve(arg)
          })
        }
      }
    })
  }
}

function createWindow (customArgs = {}) {
  var bounds

  try {
    var data = fs.readFileSync(path.join(appState.userDataPath, 'windowBounds.json'), 'utf-8')
    bounds = JSON.parse(data)
  } catch (e) { }

  if (!bounds) { // there was an error, probably because the file doesn't exist
    var size = electron.screen.getPrimaryDisplay().workAreaSize
    bounds = {
      x: 0,
      y: 0,
      width: size.width,
      height: size.height,
      maximized: true
    }
  }

  // make the bounds fit inside a currently-active screen
  // (since the screen Min was previously open on could have been removed)
  // see: https://github.com/minbrowser/min/issues/904
  var containingRect = electron.screen.getDisplayMatching(bounds).workArea

  bounds = {
    x: clamp(bounds.x, containingRect.x, (containingRect.x + containingRect.width) - bounds.width),
    y: clamp(bounds.y, containingRect.y, (containingRect.y + containingRect.height) - bounds.height),
    width: clamp(bounds.width, 0, containingRect.width),
    height: clamp(bounds.height, 0, containingRect.height),
    maximized: bounds.maximized
  }

  return createWindowWithBounds(bounds, customArgs)
}

function createWindowWithBounds (bounds, customArgs) {
  const { app, BaseWindow, WebContentsView } = electron
  const windows = windowManagement.windows

  const startupWindowId = windows.nextId

  const newWin = new BaseWindow({
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    minWidth: (process.platform === 'win32' ? 400 : 320), // controls take up more horizontal space on Windows
    minHeight: 350,
    titleBarStyle: settings.get('useSeparateTitlebar') ? 'default' : 'hidden',
    trafficLightPosition: { x: 12, y: 10 },
    icon: path.join(appState.appRoot, 'icons/icon256.png'),
    frame: settings.get('useSeparateTitlebar'),
    alwaysOnTop: settings.get('windowAlwaysOnTop'),
    backgroundColor: '#fff' // the value of this is ignored, but setting it seems to work around https://github.com/electron/electron/issues/10559
  })

  // windows and linux always use a menu button in the upper-left corner instead
  // if frame: false is set, this won't have any effect, but it does apply on Linux if "use separate titlebar" is enabled
  if (process.platform !== 'darwin') {
    newWin.setMenuBarVisibility(false)
  }

  // the chrome renderer is Chromium-only: every privileged operation goes through
  // the named window.min capabilities in dist/preload-chrome.js. These four settings
  // are the trust boundary, so they are reported to the startup probe as well.
  const chromeSecurityPreferences = {
    nodeIntegration: false,
    nodeIntegrationInWorker: false,
    contextIsolation: true,
    sandbox: true
  }

  const mainView = new WebContentsView({
    webPreferences: {
      ...chromeSecurityPreferences,
      preload: path.join(appState.appRoot, 'dist/preload-chrome.js'),
      additionalArguments: [
        '--app-version=' + app.getVersion(),
        '--app-name=' + app.getName(),
        ...((appState.isDevelopmentMode ? ['--development-mode'] : [])),
        '--window-id=' + windows.nextId,
        ...((windows.getAll().length === 0 ? ['--initial-window'] : [])),
        ...(windows.hasEverCreatedWindow ? [] : ['--launch-window']),
        ...(customArgs.initialTask ? ['--initial-task=' + customArgs.initialTask] : [])
      ]
    }
  })

  startupDiagnosticsLog('creating window', {
    windowId: startupWindowId,
    bounds,
    developmentMode: appState.isDevelopmentMode
  })

  mainView.webContents.loadURL(browserPage)

  mainView.webContents.on('did-start-loading', function () {
    startupDiagnosticsLog('main view did-start-loading', {
      windowId: startupWindowId,
      url: mainView.webContents.getURL()
    })
  })

  mainView.webContents.on('did-finish-load', function () {
    startupDiagnosticsLog('main view did-finish-load', {
      windowId: startupWindowId,
      url: mainView.webContents.getURL()
    })
    probeRendererTrustBoundary(mainView.webContents, startupWindowId, chromeSecurityPreferences)
  })

  mainView.webContents.on('did-fail-load', function (event, errorCode, errorDescription, validatedURL, isMainFrame) {
    if (!isMainFrame) {
      return
    }

    startupDiagnosticsLog('main view did-fail-load', {
      windowId: startupWindowId,
      errorCode,
      errorDescription,
      validatedURL
    })
  })

  mainView.webContents.on('render-process-gone', function (event, details) {
    startupDiagnosticsLog('main view render-process-gone', {
      windowId: startupWindowId,
      details
    })
  })

  if (bounds.maximized) {
    newWin.maximize()

    mainView.webContents.once('did-finish-load', function () {
      sendIPCToWindow(newWin, 'maximize')
    })
  }

  const winBounds = newWin.getContentBounds()

  mainView.setBounds({ x: 0, y: 0, width: winBounds.width, height: winBounds.height })
  newWin.contentView.addChildView(mainView)

  // sometimes getContentBounds doesn't provide correct bounds until after the window has finished loading
  mainView.webContents.once('did-finish-load', function () {
    const winBounds = newWin.getContentBounds()
    mainView.setBounds({ x: 0, y: 0, width: winBounds.width, height: winBounds.height })
  })

  newWin.on('resize', function () {
    // The result of getContentBounds doesn't update until the next tick
    setTimeout(function () {
      const winBounds = newWin.getContentBounds()
      mainView.setBounds({ x: 0, y: 0, width: winBounds.width, height: winBounds.height })
    }, 0)
  })

  newWin.on('close', function () {
    // save the window size for the next launch of the app
    saveWindowBounds()
  })

  newWin.on('unresponsive', function () {
    startupDiagnosticsLog('window unresponsive', { windowId: startupWindowId })
  })

  newWin.on('responsive', function () {
    startupDiagnosticsLog('window responsive', { windowId: startupWindowId })
  })

  newWin.on('focus', function () {
    if (!windows.getState(newWin).isMinimized) {
      sendIPCToWindow(newWin, 'windowFocus')
    }
  })

  newWin.on('minimize', function () {
    sendIPCToWindow(newWin, 'minimize')
    windows.getState(newWin).isMinimized = true
  })

  newWin.on('restore', function () {
    windows.getState(newWin).isMinimized = false
  })

  newWin.on('maximize', function () {
    sendIPCToWindow(newWin, 'maximize')
  })

  newWin.on('unmaximize', function () {
    sendIPCToWindow(newWin, 'unmaximize')
  })

  newWin.on('focus', function () {
    sendIPCToWindow(newWin, 'focus')
  })

  newWin.on('blur', function () {
    // if the devtools for this window are focused, this check will be false, and we keep the focused class on the window
    if (BaseWindow.getFocusedWindow() !== newWin) {
      sendIPCToWindow(newWin, 'blur')
    }
  })

  newWin.on('enter-full-screen', function () {
    sendIPCToWindow(newWin, 'enter-full-screen')
  })

  newWin.on('leave-full-screen', function () {
    sendIPCToWindow(newWin, 'leave-full-screen')
    // https://github.com/minbrowser/min/issues/1093
    newWin.setMenuBarVisibility(false)
  })

  newWin.on('enter-html-full-screen', function () {
    sendIPCToWindow(newWin, 'enter-html-full-screen')
  })

  newWin.on('leave-html-full-screen', function () {
    sendIPCToWindow(newWin, 'leave-html-full-screen')
    // https://github.com/minbrowser/min/issues/952
    newWin.setMenuBarVisibility(false)
  })

  /*
  Handles events from mouse buttons
  Unsupported on macOS, and on Linux, there is a default handler already,
  so registering a handler causes events to happen twice.
  See: https://github.com/electron/electron/issues/18322
  */
  if (process.platform === 'win32') {
    newWin.on('app-command', function (e, command) {
      if (command === 'browser-backward') {
        sendIPCToWindow(newWin, 'goBack')
      } else if (command === 'browser-forward') {
        sendIPCToWindow(newWin, 'goForward')
      }
    })
  }

  // prevent remote pages from being loaded using drag-and-drop, since they would have node access
  mainView.webContents.on('will-navigate', function (e, url) {
    if (url !== browserPage) {
      e.preventDefault()
    }
  })

  mainView.webContents.on('before-input-event', function (e, input) {
    sendIPCToWindow(newWin, 'before-input-event', input)
  })

  newWin.setTouchBar(touchbar.buildTouchBar())

  windows.addWindow(newWin)

  return newWin
}

// mutate the shared exports object in place (rather than reassigning module.exports)
// since touchbar.js may have already captured a reference to it as part of the
// load-time circular require between these two modules
Object.assign(module.exports, {
  browserPage,
  getWindowWebContents,
  sendIPCToWindow,
  openTabInWindow,
  saveWindowBounds,
  handleCommandLineArguments,
  createWindow,
  createWindowWithBounds
})
