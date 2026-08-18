const TouchBar = require('electron').TouchBar
const nativeImage = require('electron').nativeImage
const { TouchBarButton, TouchBarSpacer } = TouchBar

const { l } = require('./localizationMain')
const { windows } = require('./windowManagement')
// windowUtils.js also depends on this module (for buildTouchBar), so this require is
// part of a load-time circular pair. Access it as `windowUtils.sendIPCToWindow(...)`
// (never destructured) and only inside function bodies, so it is safe regardless of require order.
const windowUtils = require('./windowUtils')

function buildTouchBar () {
  if (process.platform !== 'darwin') {
    return null
  }

  function getTouchBarIcon (name) {
    // the icons created by nativeImage are too big by default, shrink them to the correct size for the touchbar
    var image = nativeImage.createFromNamedImage(name, [-1, 0, 1])
    var size = image.getSize()
    return image.resize({
      width: Math.round(size.width * 0.65),
      height: Math.round(size.height * 0.65)
    })
  }
  return new TouchBar({
    items: [
      new TouchBarButton({
        accessibilityLabel: l('goBack'),
        icon: getTouchBarIcon('NSImageNameTouchBarGoBackTemplate'),
        click: function () {
          windowUtils.sendIPCToWindow(windows.getCurrent(), 'goBack')
        }
      }),
      new TouchBarButton({
        accessibilityLabel: l('goForward'),
        icon: getTouchBarIcon('NSImageNameTouchBarGoForwardTemplate'),
        click: function () {
          windowUtils.sendIPCToWindow(windows.getCurrent(), 'goForward')
        }
      }),
      new TouchBarSpacer({ size: 'flexible' }),
      new TouchBarButton({
        icon: getTouchBarIcon('NSImageNameTouchBarAdd'),
        accessibilityLabel: l('newTabAction'),
        click: function () {
          windowUtils.sendIPCToWindow(windows.getCurrent(), 'addTab')
        }
      })
    ]
  })
}

// mutate the shared exports object in place (rather than reassigning module.exports)
// since windowUtils.js may have already captured a reference to it as part of the
// load-time circular require between these two modules
module.exports.buildTouchBar = buildTouchBar
