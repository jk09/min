export const CHROME_BRIDGE_CAPABILITIES = Object.freeze({
  bootstrap: Object.freeze(['appVersion', 'developmentMode', 'platform', 'windowId']),
  window: Object.freeze(['close', 'maximize', 'minimize', 'setFullScreen', 'unmaximize']),
  clipboard: Object.freeze(['readText', 'writeText']),
  views: Object.freeze(['callMethod', 'create', 'destroy', 'focus', 'getNavigationHistory', 'hideCurrent', 'loadURL', 'setBounds']),
  settings: Object.freeze(['get', 'set']),
  session: Object.freeze(['read', 'write']),
  downloads: Object.freeze(['cancel', 'showInFolder', 'startFileDrag']),
  files: Object.freeze(['choose', 'save']),
  userscripts: Object.freeze(['list', 'openDirectory']),
  passwordManager: Object.freeze(['checkTool', 'copyTool', 'import', 'export']),
  prompt: Object.freeze(['complete', 'onProgress'])
})

export type ChromeBridgeCapability = keyof typeof CHROME_BRIDGE_CAPABILITIES

module.exports = { CHROME_BRIDGE_CAPABILITIES }
