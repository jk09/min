const fs = require('fs')
const writeFileAtomic = require('write-file-atomic')
const { ipcMain: ipc } = require('electron')
const { windows, getWindowWebContents } = require('../../../main/windowManagement')
const { getChromeWindow } = require('../../../main/chromeCapabilities')

function isSerializableSettingValue (value) {
  if (value === undefined || value === null || typeof value === 'string' || typeof value === 'boolean') {
    return true
  }
  if (typeof value === 'number') {
    return Number.isFinite(value)
  }
  if (Array.isArray(value)) {
    return value.every(isSerializableSettingValue)
  }
  if (Object.getPrototypeOf(value) === Object.prototype) {
    return Object.values(value).every(isSerializableSettingValue)
  }
  return false
}

var settings = {
  filePath: null,
  fileWritePromise: null,
  list: {},
  onChangeCallbacks: [],
  writeFile: function () {
    /*
      Writing to the settings file from multiple places simultaneously causes data corruption, so to avoid that:
      * We forward data from the renderer process to the main process, and only write from there
      * In the main process, we put multiple save requests in a queue (by chaining them to a promise) so they execute individually
      * https://github.com/minbrowser/min/issues/1520
      */

    /* eslint-disable no-inner-declarations */
    function newFileWrite () {
      return new Promise(function (resolve, reject) {
        writeFileAtomic(settings.filePath, JSON.stringify(settings.list), {}, function (err) {
          if (err) {
            reject(err)
          } else {
            resolve()
          }
        })
      })
    }

    function ongoingFileWrite () {
      return settings.fileWritePromise || Promise.resolve()
    }
    /* eslint-enable no-inner-declarations */

    // eslint-disable-next-line no-return-assign
    settings.fileWritePromise = ongoingFileWrite().then(newFileWrite).then(() => settings.fileWritePromise = null)
  },
  runChangeCallbacks (key) {
    settings.onChangeCallbacks.forEach(function (listener) {
      if (!key || !listener.key || listener.key === key) {
        if (listener.key) {
          listener.cb(settings.list[listener.key])
        } else {
          listener.cb(key)
        }
      }
    })
  },
  get: function (key) {
    return settings.list[key]
  },
  listen: function (key, cb) {
    if (key && cb) {
      cb(settings.get(key))
      settings.onChangeCallbacks.push({ key, cb })
    } else if (key) {
      // global listener
      settings.onChangeCallbacks.push({ cb: key })
    }
  },
  set: function (key, value) {
    settings.list[key] = value
    settings.writeFile()
    settings.runChangeCallbacks(key)

    windows.getAll().forEach(function (win) {
      getWindowWebContents(win).send('settingChanged', [key, value])
    })
  },
  initialize: function (userDataPath) {
    settings.filePath = userDataPath + (process.platform === 'win32' ? '\\' : '/') + 'settings.json'

    try {
      const fileData = fs.readFileSync(settings.filePath, 'utf-8')
      if (fileData) {
        settings.list = JSON.parse(fileData)
      }
    } catch (e) {
      if (e.code !== 'ENOENT') {
        console.warn('Error reading settings file:', e)
      }
    }

    ipc.on('settingChanged', function (e, key, value) {
      settings.list[key] = value
      settings.writeFile()
      settings.runChangeCallbacks(key)

      windows.getAll().forEach(function (win) {
        if (getWindowWebContents(win).id !== e.sender.id) {
          getWindowWebContents(win).send('settingChanged', [key, value])
        }
      })
    })

    ipc.handle('chrome:settings:read', function (event) {
      getChromeWindow(event)
      return JSON.parse(JSON.stringify(settings.list))
    })
    ipc.handle('chrome:settings:set', function (event, key, value) {
      getChromeWindow(event)
      if (typeof key !== 'string' || key.length === 0 || !isSerializableSettingValue(value)) {
        throw new Error('invalid setting update')
      }
      settings.set(key, value)
    })
  }
}

module.exports = { ...settings, isSerializableSettingValue }
