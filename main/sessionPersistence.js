const path = require('path')
const fs = require('fs')
const writeFileAtomic = require('write-file-atomic')
const { ipcMain: ipc } = require('electron')
const { getChromeWindow } = require('./chromeCapabilities')

function parseSessionData (data) {
  if (typeof data !== 'string') {
    throw new TypeError('session data must be a string')
  }

  let parsed
  try {
    parsed = JSON.parse(data)
  } catch {
    throw new Error('session data must be valid JSON')
  }

  if (!parsed || parsed.version !== 2 || !parsed.state || !Array.isArray(parsed.state.tasks) || !Number.isFinite(parsed.saveTime)) {
    throw new Error('session data has an invalid shape')
  }

  return data
}

function createSessionPersistence ({ userDataPath, fileSystem = fs, atomicWrite = writeFileAtomic }) {
  const sessionPath = path.join(userDataPath, 'sessionRestore.json')

  return {
    read: function () {
      return fileSystem.promises.readFile(sessionPath, 'utf-8').catch(function (error) {
        if (error.code === 'ENOENT') {
          return null
        }
        throw error
      })
    },
    write: function (data) {
      return new Promise(function (resolve, reject) {
        atomicWrite(sessionPath, parseSessionData(data), {}, function (error) {
          if (error) {
            reject(error)
          } else {
            resolve()
          }
        })
      })
    },
    backup: function (data) {
      return new Promise(function (resolve, reject) {
        const backupPath = path.join(userDataPath, 'sessionRestoreBackup-' + Date.now() + '.json')
        atomicWrite(backupPath, parseSessionData(data), {}, function (error) {
          if (error) {
            reject(error)
          } else {
            resolve(backupPath)
          }
        })
      })
    }
  }
}

function registerSessionPersistenceCapabilities (userDataPath) {
  const sessionPersistence = createSessionPersistence({ userDataPath })

  ipc.handle('chrome:session:read', function (event) {
    getChromeWindow(event)
    return sessionPersistence.read()
  })
  ipc.handle('chrome:session:write', function (event, data) {
    getChromeWindow(event)
    return sessionPersistence.write(data)
  })
  ipc.handle('chrome:session:backup', function (event, data) {
    getChromeWindow(event)
    return sessionPersistence.backup(data)
  })
}

module.exports = { createSessionPersistence, parseSessionData, registerSessionPersistenceCapabilities }
