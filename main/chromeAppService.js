/*
Main-owned services for the remaining browser-chrome privileges: application
actions, main-to-renderer commands, permission grants, cross-window tab state,
and the two file reads/writes the chrome renderer used to perform itself.

Every handler validates that its sender is the owning chrome WebContents, and
all filesystem paths are built here so the renderer never submits one.
*/

const fs = require('fs')
const path = require('path')
const { app, ipcMain: ipc, dialog, session } = require('electron')
const { windows, getWindowWebContents } = require('./windowManagement')
const { getChromeWindow } = require('./chromeCapabilities')

const BOOKMARKS_BACKUP_FILE = 'bookmarksBackup.html'
const HOSTS_FILE_LIMIT = 128 * 1024
const IGNORED_HOSTS = ['255.255.255.255', 'broadcasthost']

function getHostsFilePath (platform = process.platform) {
  return platform === 'win32'
    ? 'C:/Windows/System32/drivers/etc/hosts'
    : '/etc/hosts'
}

/* the hosts file is only used for hostname autocompletion, so a truncated read is enough */
function parseHostsFile (data) {
  const lines = data.length > HOSTS_FILE_LIMIT
    ? data.substring(0, HOSTS_FILE_LIMIT).split('\n').slice(0, -1)
    : data.split('\n')

  const seen = new Set()

  lines.forEach(function (line) {
    if (line.startsWith('#')) {
      return
    }
    line.split(/\s/g).forEach(function (host) {
      if (host.length > 0 && !IGNORED_HOSTS.includes(host)) {
        seen.add(host)
      }
    })
  })

  return Array.from(seen)
}

function createChromeAppService ({ userDataPath, fileSystem = fs, platform = process.platform }) {
  return {
    readHosts: function () {
      return new Promise(function (resolve) {
        fileSystem.readFile(getHostsFilePath(platform), 'utf8', function (err, data) {
          if (err) {
            console.warn('error retrieving hosts file', err)
            resolve([])
            return
          }
          resolve(parseHostsFile(data))
        })
      })
    },
    writeBookmarksBackup: function (html) {
      if (typeof html !== 'string' || html.length === 0) {
        throw new TypeError('bookmarks backup must be a non-empty string')
      }

      return new Promise(function (resolve, reject) {
        fileSystem.writeFile(path.join(userDataPath, BOOKMARKS_BACKUP_FILE), html, { encoding: 'utf-8' }, function (err) {
          if (err) {
            reject(err)
          } else {
            resolve()
          }
        })
      })
    }
  }
}

function requireCoordinate (value, name) {
  if (!Number.isFinite(value)) {
    throw new TypeError(name + ' must be a finite number')
  }
  return Math.round(value)
}

function registerChromeAppCapabilities (userDataPath, { showSecondaryMenu } = {}) {
  const appService = createChromeAppService({ userDataPath })

  ipc.handle('chrome:app:quit', function (event) {
    getChromeWindow(event)
    app.quit()
  })

  ipc.handle('chrome:app:set-window-title', function (event, title) {
    if (typeof title !== 'string') {
      throw new TypeError('window title must be a string')
    }
    getChromeWindow(event).title = title
  })

  ipc.handle('chrome:app:show-secondary-menu', function (event, data) {
    getChromeWindow(event)
    if (!data || typeof data !== 'object') {
      throw new TypeError('menu position is required')
    }
    showSecondaryMenu({
      x: requireCoordinate(data.x, 'menu x'),
      y: requireCoordinate(data.y, 'menu y')
    })
  })

  ipc.handle('chrome:app:show-save-dialog', async function (event, defaultPath) {
    const window = getChromeWindow(event)
    if (typeof defaultPath !== 'string') {
      throw new TypeError('default path must be a string')
    }
    /* only a file name is accepted; the directory is chosen by the user in the dialog */
    const result = await dialog.showSaveDialog(window, { defaultPath: path.basename(defaultPath) })
    return result.filePath
  })

  ipc.handle('chrome:app:add-word-to-dictionary', function (event, word) {
    getChromeWindow(event)
    if (typeof word !== 'string' || word.length === 0) {
      throw new TypeError('word must be a non-empty string')
    }
    session.fromPartition('persist:webcontent').addWordToSpellCheckerDictionary(word)
  })

  ipc.handle('chrome:app:update-handoff', function (event, url) {
    getChromeWindow(event)
    if (typeof url !== 'string') {
      throw new TypeError('handoff url must be a string')
    }
    if (app.setUserActivity && url.startsWith('http')) {
      app.setUserActivity('NSUserActivityTypeBrowsingWeb', {}, url)
    } else if (app.invalidateCurrentActivity) {
      app.invalidateCurrentActivity()
    }
  })

  ipc.handle('chrome:app:hosts', function (event) {
    getChromeWindow(event)
    return appService.readHosts()
  })

  ipc.handle('chrome:app:write-bookmarks-backup', function (event, html) {
    getChromeWindow(event)
    return appService.writeBookmarksBackup(html)
  })

  ipc.on('chrome:tab-state:change', function (event, events) {
    getChromeWindow(event)
    if (!Array.isArray(events)) {
      throw new TypeError('tab state events must be an array')
    }
    const sourceWindowId = windows.windowFromContents(event.sender)?.id
    if (!sourceWindowId) {
      console.warn('warning: received tab state update from window after destruction, ignoring')
      return
    }
    windows.getAll().forEach(function (window) {
      if (getWindowWebContents(window).id !== event.sender.id) {
        getWindowWebContents(window).send('chrome:tab-state:receive', { sourceWindowId, events })
      }
    })
  })

  ipc.handle('chrome:tab-state:request', function (event) {
    getChromeWindow(event)
    const otherWindow = windows.getAll().find(w => getWindowWebContents(w).id !== event.sender.id)
    if (!otherWindow) {
      throw new Error('secondary window doesn\'t exist as source for tab state')
    }
    const sourceContents = getWindowWebContents(otherWindow)
    return new Promise(function (resolve) {
      const listener = function (returnEvent, data) {
        /* only the window that was asked may answer, so a view cannot forge the state */
        if (returnEvent.sender !== sourceContents) {
          return
        }
        ipc.removeListener('chrome:tab-state:return', listener)
        resolve(data)
      }
      ipc.on('chrome:tab-state:return', listener)
      sourceContents.send('chrome:tab-state:read')
    })
  })
}

module.exports = {
  createChromeAppService,
  getHostsFilePath,
  parseHostsFile,
  registerChromeAppCapabilities
}
