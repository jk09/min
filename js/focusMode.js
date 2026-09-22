var isFocusMode = false

window.min.app.onCommand('enterFocusMode', function () {
  isFocusMode = true
  document.body.classList.add('is-focus-mode')
})

window.min.app.onCommand('exitFocusMode', function () {
  isFocusMode = false
  document.body.classList.remove('is-focus-mode')
})

module.exports = {
  enabled: function () {
    return isFocusMode
  },
  warn: function () {
    window.min.app.showFocusModeDialog()
  }
}
