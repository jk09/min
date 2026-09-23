var settings = require('util/settings/settings.js')

function initialize () {
  if (settings.get('useSeparateTitlebar') === true) {
    document.body.classList.add('separate-titlebar')
  }

  var windowIsMaximized = false
  var windowIsFullscreen = false

  var captionMinimize =
  document.querySelector('.windows-caption-buttons .caption-minimise, body.linux .titlebar-linux .caption-minimise')

  var captionMaximize =
  document.querySelector('.windows-caption-buttons .caption-maximize, body.linux .titlebar-linux .caption-maximize')

  var captionRestore =
  document.querySelector('.windows-caption-buttons .caption-restore, body.linux .titlebar-linux .caption-restore')

  var captionClose =
  document.querySelector('.windows-caption-buttons .caption-close, body.linux .titlebar-linux .caption-close')

  var linuxClose = document.querySelector('#linux-control-buttons #close-button')
  var linuxMinimize = document.querySelector('#linux-control-buttons #minimize-button')
  var linuxMaximize = document.querySelector('#linux-control-buttons #maximize-button')

  function updateCaptionButtons () {
    if (window.platformType === 'windows') {
      if (windowIsMaximized || windowIsFullscreen) {
        captionMaximize.hidden = true
        captionRestore.hidden = false
      } else {
        captionMaximize.hidden = false
        captionRestore.hidden = true
      }
    }
  }

  if (window.platformType === 'windows') {
    updateCaptionButtons()

    captionMinimize.addEventListener('click', function (e) {
      window.min.window.minimize()
    })

    captionMaximize.addEventListener('click', function (e) {
      window.min.window.maximize()
    })

    captionRestore.addEventListener('click', function (e) {
      if (windowIsFullscreen) {
        window.min.window.setFullScreen(false)
      } else {
        window.min.window.unmaximize()
      }
    })

    captionClose.addEventListener('click', function (e) {
      window.min.window.close()
    })
  }

  window.min.window.onStateChange(function (state) {
    if (state === 'maximize') {
      windowIsMaximized = true
    } else if (state === 'unmaximize') {
      windowIsMaximized = false
    } else if (state === 'enter-full-screen') {
      windowIsFullscreen = true
    } else if (state === 'leave-full-screen') {
      windowIsFullscreen = false
    }
    updateCaptionButtons()
  })

  if (window.platformType === 'linux') {
    linuxClose.addEventListener('click', function (e) {
      window.min.window.close()
    })
    linuxMaximize.addEventListener('click', function (e) {
      if (windowIsFullscreen) {
        window.min.window.setFullScreen(false)
      } else if (windowIsMaximized) {
        window.min.window.unmaximize()
      } else {
        window.min.window.maximize()
      }
    })
    linuxMinimize.addEventListener('click', function (e) {
      window.min.window.minimize()
    })
  }
}

module.exports = { initialize }
