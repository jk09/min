const { windows, getWindowWebContents } = require('./windowManagement')

function getChromeWindow (event, windowRegistry = windows, getContents = getWindowWebContents) {
  const windowState = windowRegistry.windowFromContents(event.sender)

  if (!windowState || getContents(windowState.win) !== event.sender) {
    throw new Error('chrome capability request rejected for non-chrome sender')
  }

  return windowState.win
}

module.exports = { getChromeWindow }
