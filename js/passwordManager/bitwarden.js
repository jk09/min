// Bitwarden password manager. Requires session key to unlock the vault.
class Bitwarden {
  constructor () {
    this.sessionKey = null
    this.lastCallList = {}
    this.name = 'Bitwarden'
  }

  getDownloadLink () {
    switch (window.platformType) {
      case 'mac':
        return 'https://vault.bitwarden.com/download/?app=cli&platform=macos'
      case 'windows':
        return 'https://vault.bitwarden.com/download/?app=cli&platform=windows'
      case 'linux':
        return 'https://vault.bitwarden.com/download/?app=cli&platform=linux'
    }
  }

  getSetupMode () {
    return 'dragdrop'
  }

  // Returns a Bitwarden-CLI tool path by checking possible locations.
  // First it checks if the tool was installed for Min specifically
  // by checking the settings value. If that is not set or doesn't point
  // to a valid executable, it checks if 'bw' is available globally.
  async _getToolPath () {
    return (await window.min.passwordManager.checkTool('bitwarden')) ? 'configured' : null
  }

  // Checks if Bitwarden integration is configured properly by trying to
  // obtain a valid Bitwarden-CLI tool path.
  async checkIfConfigured () {
    this.path = await this._getToolPath()
    return this.path != null
  }

  // Returns current Bitwarden-CLI status. If we have a session key, then
  // password store is considered unlocked.
  isUnlocked () {
    return this.sessionKey != null
  }

  // Tries to get a list of credential suggestions for a given domain name.
  async getSuggestions (domain) {
    if (this.lastCallList[domain] != null) {
      return this.lastCallList[domain]
    }

    if (!this.path) {
      return Promise.resolve([])
    }

    if (!this.isUnlocked()) {
      throw new Error()
    }

    this.lastCallList[domain] = this.loadSuggestions(domain).then(suggestions => {
      this.lastCallList[domain] = null
      return suggestions
    }).catch(ex => {
      this.lastCallList[domain] = null
    })

    return this.lastCallList[domain]
  }

  // Loads credential suggestions for given domain name.
  async loadSuggestions (domain) {
    try {
      const data = await window.min.passwordManager.bitwarden('suggestions', { domain: this.sanitize(domain), sessionKey: this.sessionKey })

      const matches = JSON.parse(data)
      const credentials = matches.map(match => {
        const { login: { username, password } } = match
        return { username, password, manager: 'Bitwarden' }
      })

      return credentials
    } catch (ex) {
      const { error, data } = ex
      console.error('Error accessing Bitwarden CLI. STDOUT: ' + data + '. STDERR: ' + error)
      return []
    }
  }

  async forceSync () {
    try {
      await window.min.passwordManager.bitwarden('sync', { sessionKey: this.sessionKey })
    } catch (ex) {
      const { error, data } = ex
      console.error('Error accessing Bitwarden CLI. STDOUT: ' + data + '. STDERR: ' + error)
    }
  }

  // Tries to unlock the password store with given master password.
  async unlockStore (password) {
    try {
      const result = await window.min.passwordManager.bitwarden('unlock', { password })

      if (!result) {
        throw new Error()
      }

      this.sessionKey = result
      await this.forceSync()

      return true
    } catch (ex) {
      const { error, data } = ex

      console.error('Error accessing Bitwarden CLI. STDOUT: ' + data + '. STDERR: ' + error)

      if (error.includes('not logged in')) {
        await this.signInAndSave()
        return await this.unlockStore(password)
      }

      throw ex
    }
  }

  async signInAndSave () {
    // It's possible to be already logged in
    try {
      await window.min.passwordManager.bitwarden('logout', {})
    } catch (e) {
      console.warn(e)
    }

    // show credentials dialog

    var signInFields = [
      { placeholder: 'Client ID', id: 'clientID', type: 'password' },
      { placeholder: 'Client Secret', id: 'clientSecret', type: 'password' }
    ]

    const credentials = window.min.passwordManager.prompt({
      text: l('passwordManagerBitwardenSignIn'),
      values: signInFields,
      ok: l('dialogConfirmButton'),
      cancel: l('dialogSkipButton'),
      width: 500,
      height: 260
    })

    for (const key in credentials) {
      if (credentials[key] === '') {
        throw new Error('no credentials entered')
      }
    }

    await window.min.passwordManager.bitwarden('sign-in', credentials)

    return true
  }

  // Basic domain name cleanup. Removes any non-ASCII symbols.
  sanitize (domain) {
    return domain.replace(/[^a-zA-Z0-9.-]/g, '')
  }
}

module.exports = Bitwarden
