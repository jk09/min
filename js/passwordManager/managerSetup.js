var webviews = require('webviews.js')
var settings = require('util/settings/settings.js')
var browserUI = require('browserUI.js')
var modalMode = require('modalMode.js')
var dialog = document.getElementById('manager-setup-dialog')

var primaryInstructions = document.getElementById('manager-setup-instructions-primary')
var secondaryInstructions = document.getElementById('manager-setup-instructions-secondary')
var dragBox = document.getElementById('manager-setup-drop-box')

const setupDialog = {
  manager: null,
  setupMode: null,
  installerCompletionTimeout: null,
  show: function (manager) {
    setupDialog.manager = manager
    setupDialog.setupMode = manager.getSetupMode()

    document.getElementById('manager-setup-heading').textContent = l('passwordManagerSetupHeading').replace('%p', manager.name)
    document.getElementById('password-manager-setup-link').textContent = l('passwordManagerSetupLink').replace('%p', manager.name)
    document.getElementById('password-manager-setup-link-installer').textContent = l('passwordManagerSetupLinkInstaller').replace('%p', manager.name)

    dragBox.textContent = l('passwordManagerSetupDragBox')

    if (setupDialog.setupMode === 'installer') {
      primaryInstructions.hidden = true
      secondaryInstructions.hidden = false

      setupDialog.installerCompletionTimeout = setTimeout(waitForInstallerComplete, 2000)
    } else {
      primaryInstructions.hidden = false
      secondaryInstructions.hidden = true
    }

    modalMode.toggle(true, {
      onDismiss: function () {
        settings.set('passwordManager', null)
        setupDialog.hide()
      }
    })

    dialog.hidden = false
    webviews.requestPlaceholder('managerSetup')
  },
  hide: function () {
    setupDialog.manager = null
    setupDialog.setupMode = null
    clearTimeout(setupDialog.installerCompletionTimeout)
    setupDialog.installerCompletionTimeout = null

    modalMode.toggle(false)
    dialog.hidden = true
    webviews.hidePlaceholder('managerSetup')
  },
  initialize: function () {
    document.getElementById('manager-setup-disable').addEventListener('click', function () {
      settings.set('passwordManager', null)
      setupDialog.hide()
    })

    document.getElementById('manager-setup-close').addEventListener('click', function () {
      settings.set('passwordManager', null)
      setupDialog.hide()
    })

    document.getElementById('password-manager-setup-link').addEventListener('click', function () {
      browserUI.addTab(tabs.add({
        url: setupDialog.manager.getDownloadLink()
      }), { openInBackground: true })
    })

    document.getElementById('password-manager-setup-link-installer').addEventListener('click', function () {
      browserUI.addTab(tabs.add({
        url: setupDialog.manager.getDownloadLink()
      }), { openInBackground: true })
    })

    dragBox.ondragover = () => {
      return false
    }

    dragBox.ondragleave = () => {
      return false
    }

    dragBox.ondragend = () => {
      return false
    }

    dragBox.ondrop = (e) => {
      e.preventDefault()

      if (e.dataTransfer.files.length === 0) {
        return
      }

      dragBox.innerHTML = l('passwordManagerSetupInstalling')

      const file = e.dataTransfer.files[0]

      // try to filter out anything that isn't an executable (note: not 100% accurate)
      if (file.type !== '' && !file.name.endsWith('.exe')) {
        dragBox.innerHTML = l('passwordManagerSetupRetry')
        return
      }

      if (setupDialog.setupMode === 'installer') {
        window.min.passwordManager.launchInstaller('onepassword', file)
      } else {
        window.min.passwordManager.installTool(getManagerId(), file).then(afterInstall)
      }

      return false
    }
  }
}

function waitForInstallerComplete () {
  setupDialog.manager.checkIfConfigured().then(function (configured) {
    if (configured) {
      afterInstall()
      setupDialog.installerCompletionTimeout = null
    } else {
      setupDialog.installerCompletionTimeout = setTimeout(waitForInstallerComplete, 2000)
    }
  })
}

function getManagerId () {
  return setupDialog.manager.name === 'Bitwarden' ? 'bitwarden' : 'onepassword'
}

function afterInstall () {
  setupDialog.manager.signInAndSave()
    .then(() => {
      setupDialog.hide()
    })
    .catch(function (e) {
      console.warn(e)
      if (setupDialog.setupMode === 'installer') {
        // show the dialog again
        afterInstall()
      } else {
        // Cleanup after we failed.
        const message = (e.error || '').replace(/\n$/gm, '')
        dragBox.innerHTML = l('passwordManagerSetupUnlockError') + message + ' ' + l('passwordManagerSetupRetry')
      }
    })
}

setupDialog.initialize()

module.exports = setupDialog
