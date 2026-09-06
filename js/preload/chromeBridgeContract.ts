export const CHROME_BRIDGE_CAPABILITIES = Object.freeze({
  bootstrap: Object.freeze(['appVersion', 'developmentMode', 'platform', 'windowId']),
  window: Object.freeze(['close', 'maximize', 'minimize', 'setFullScreen', 'unmaximize']),
  clipboard: Object.freeze(['readText', 'writeText']),
  views: Object.freeze(['callMethod', 'capture', 'create', 'destroy', 'focus', 'focusMain', 'getNavigationHistory', 'hideCurrent', 'loadURL', 'onAsyncCallResult', 'onCapture', 'onEvent', 'setBounds', 'setCurrent']),
  menu: Object.freeze(['onItemSelected', 'onWillClose', 'open']),
  settings: Object.freeze(['onChanged', 'read', 'set']),
  session: Object.freeze(['backup', 'read', 'write']),
  downloads: Object.freeze(['cancel', 'onInfo', 'open', 'showInFolder', 'startFileDrag']),
  files: Object.freeze(['choose', 'save']),
  userscripts: Object.freeze(['list', 'openDirectory']),
  passwordManager: Object.freeze(['checkTool', 'copyTool', 'import', 'export']),
  prompt: Object.freeze(['cancel', 'complete', 'getStatus', 'onProgress'])
})

export type ChromeBridgeCapability = keyof typeof CHROME_BRIDGE_CAPABILITIES

module.exports = { CHROME_BRIDGE_CAPABILITIES }
