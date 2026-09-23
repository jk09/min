const fs = require('fs')
const path = require('path')
const chokidar = require('chokidar')
const { ipcMain: ipc, shell } = require('electron')
const { getChromeWindow } = require('./chromeCapabilities')

function isUserscriptName (name) {
  return typeof name === 'string' && name.endsWith('.js') && !name.includes('/') && !name.includes('\\')
}

function createUserscriptService (userDataPath, dependencies = {}) {
  const fileSystem = dependencies.fs || fs.promises
  const watch = dependencies.watch || chokidar.watch
  const scriptDir = path.join(userDataPath, 'userscripts')
  let watcher = null
  const subscribers = new Set()

  async function ensureDirectory () {
    await fileSystem.mkdir(scriptDir, { recursive: true })
  }

  async function list () {
    await ensureDirectory()
    const entries = await fileSystem.readdir(scriptDir, { withFileTypes: true })
    const scripts = await Promise.all(entries
      .filter(entry => entry.isFile() && isUserscriptName(entry.name))
      .map(async entry => ({
        name: entry.name,
        content: await fileSystem.readFile(path.join(scriptDir, entry.name), 'utf8')
      })))
    return scripts
  }

  function notifyChanged () {
    subscribers.forEach(function (contents) {
      if (!contents.isDestroyed()) {
        contents.send('chrome:userscripts:changed')
      }
    })
  }

  function startWatching (contents) {
    subscribers.add(contents)
    if (!watcher) {
      watcher = watch(scriptDir, {
        ignoreInitial: true,
        disableGlobbing: true,
        awaitWriteFinish: { stabilityThreshold: 500, pollInterval: 100 }
      })
      watcher.on('all', notifyChanged)
    }
  }

  async function stopWatching (contents) {
    subscribers.delete(contents)
    if (subscribers.size === 0 && watcher) {
      await watcher.close()
      watcher = null
    }
  }

  return { scriptDir, list, startWatching, stopWatching }
}

function registerUserscriptCapabilities (userDataPath) {
  const service = createUserscriptService(userDataPath)

  ipc.handle('chrome:userscripts:list', async function (event) {
    getChromeWindow(event)
    return service.list()
  })

  ipc.handle('chrome:userscripts:open-directory', function (event) {
    getChromeWindow(event)
    return shell.openPath(service.scriptDir)
  })

  ipc.handle('chrome:userscripts:watch', async function (event) {
    getChromeWindow(event)
    await fs.promises.mkdir(service.scriptDir, { recursive: true })
    service.startWatching(event.sender)
    event.sender.once('destroyed', () => service.stopWatching(event.sender))
  })

  ipc.handle('chrome:userscripts:unwatch', function (event) {
    getChromeWindow(event)
    return service.stopWatching(event.sender)
  })
}

module.exports = { createUserscriptService, isUserscriptName, registerUserscriptCapabilities }
