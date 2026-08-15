const TaskList = require('tabState/task.js')

function initialize () {
  window.tasks = new TaskList()
  const taskId = tasks.add()
  tasks.setSelected(taskId)
  window.tabs = tasks.getSelected().tabs
}

module.exports = { initialize }
