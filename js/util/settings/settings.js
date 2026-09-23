var settings = {
  list: {},
  onChangeCallbacks: [],
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
    window.min.settings.set(key, value).catch(function (error) {
      console.warn('failed to save setting', error)
    })
    settings.runChangeCallbacks(key)
  },
  initialize: function () {
    return window.min.settings.read().then(function (list) {
      settings.list = list || {}
      settings.runChangeCallbacks()
    }).catch(function (error) {
      console.warn('failed to load settings', error)
      settings.runChangeCallbacks()
    }).then(function () {
      window.min.settings.onChanged(function (data) {
        var key = data[0]
        var value = data[1]
        settings.list[key] = value
        settings.runChangeCallbacks(key)
      })
    })
  }
}

module.exports = settings
