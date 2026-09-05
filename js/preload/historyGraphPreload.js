/* global ipc */

window.addEventListener('message', function (event) {
  if (!event.origin.startsWith('min://') || !event.data || event.data.message !== 'historyGraphRequest') {
    return
  }
  ipc.send('historyGraphRequest', event.data)
})

ipc.on('receiveHistoryGraphData', function (event, data) {
  if (window.location.toString().startsWith('min://')) {
    window.postMessage({ message: 'receiveHistoryGraphData', data: data }, window.location.toString())
  }
})
