window.addEventListener('message', function (e) {
  if (!e.origin.startsWith('min://')) {
    return
  }

  if (e.data && e.data.message && e.data.message === 'getLlmDebugData') {
    ipc.send('getLlmDebugData')
  }
})

ipc.on('receiveLlmDebugData', function (e, data) {
  if (window.location.toString().startsWith('min://')) { // probably redundant, but might as well check
    window.postMessage({ message: 'receiveLlmDebugData', record: data }, window.location.toString())
  }
})
