/*
Hostnames from the system hosts file, used to recognize local hostnames while
parsing URLs. The file is read and parsed in the main process; this array is
filled in asynchronously, exactly as it was when the renderer read the file
itself.
*/

var hosts = []

window.min.app.getHosts()
  .then(function (data) {
    hosts.push(...data)
  })
  .catch(function (err) {
    console.warn('error retrieving hosts file', err)
  })

module.exports = hosts
