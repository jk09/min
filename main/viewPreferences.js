/*
Validation for the two things the chrome renderer is allowed to say about a
view showing untrusted web content. Kept apart from viewManager.js so it can be
tested without loading the Electron-dependent half of the main process.
*/

/*
Methods and properties the chrome renderer may reach on a view's webContents.
The chrome preload allowlists these too; repeating it here means a renderer
cannot call an arbitrary webContents method by reaching the channel directly.
*/
const ALLOWED_VIEW_METHODS = Object.freeze([
  'canGoToOffset', 'copy', 'copyImageAt', 'downloadURL', 'executeJavaScript',
  'findInPage', 'focus', 'getZoomFactor', 'goBack', 'goForward', 'goToIndex',
  'goToOffset', 'inspectElement', 'paste', 'pasteAndMatchStyle', 'reload',
  'reloadIgnoringCache', 'replaceMisspelling', 'savePage', 'send', 'sendToFrame',
  'setAudioMuted', 'setVisualZoomLevelLimits', 'stop', 'stopFindInPage',
  'toggleDevTools', 'zoomFactor'
])

/*
Web preferences that may arrive from the renderer. Everything else - node
integration, the preload, sandboxing, context isolation - is decided by the
main process, so a renderer cannot merge a privileged setting into a view
showing untrusted web content.
*/
function sanitizeViewWebPreferences (webPreferences) {
  const partition = webPreferences && typeof webPreferences === 'object' ? webPreferences.partition : null

  // either the shared web-content session, or a private tab's own session,
  // which webviews.js names after the numeric tab id
  if (typeof partition !== 'string' || !(partition === 'persist:webcontent' || /^\d+$/.test(partition))) {
    throw new Error('view partition is not allowed')
  }

  return { partition }
}

module.exports = { ALLOWED_VIEW_METHODS, sanitizeViewWebPreferences }
