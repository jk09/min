var webviews = require('webviews.js')

function getGridDimensions(count) {
    if (count <= 1) {
        return { columns: 1, rows: 1 }
    }

    if (count === 2) {
        return { columns: 2, rows: 1 }
    }

    if (count <= 4) {
        return { columns: 2, rows: 2 }
    }

    return {
        columns: 3,
        rows: Math.ceil(count / 3)
    }
}

function getTileBounds(count, index) {
    const bounds = webviews.getContentBounds()
    const grid = getGridDimensions(count)
    const column = index % grid.columns
    const row = Math.floor(index / grid.columns)
    const tileWidth = bounds.width / grid.columns
    const tileHeight = bounds.height / grid.rows

    return {
        x: Math.round(bounds.x + column * tileWidth),
        y: Math.round(bounds.y + row * tileHeight),
        width: Math.round(column === grid.columns - 1 ? bounds.width - tileWidth * column : tileWidth),
        height: Math.round(row === grid.rows - 1 ? bounds.height - tileHeight * row : tileHeight)
    }
}

function getTaskLabel(task) {
    if (!task) {
        return ''
    }

    return task.name || l('defaultTaskName').replace('%n', tasks.getIndex(task.id) + 1)
}

function updateTaskIndicator() {
    const indicator = document.getElementById('task-layout-indicator')
    const detail = document.getElementById('task-layout-indicator-detail')
    const task = tasks.getSelected()

    if (!indicator || !detail || !task) {
        const title = document.getElementById('task-layout-indicator-title')
        if (title) {
            title.textContent = ''
        }
        if (detail) {
            detail.textContent = ''
        }
        return
    }

    const activeTab = task.tabs.get(task.tabs.getSelected()) || task.tabs.getAtIndex(0)
    const tileCount = task.tabs.count()

    const title = indicator.querySelector('#task-layout-indicator-title')
    if (title) {
        title.textContent = getTaskLabel(task)
    }
    detail.textContent = tileCount + (tileCount === 1 ? ' tile' : ' tiles') + (activeTab && activeTab.title ? ' · ' + activeTab.title : '')
}

function syncTaskViews(task) {
    if (!task) {
        return
    }

    const visibleTabIds = task.tabs.get().map(tab => tab.id)
    const activeTabId = task.tabs.getSelected() || (task.tabs.getAtIndex(0) && task.tabs.getAtIndex(0).id)

    tasks.forEach(function (otherTask) {
        otherTask.tabs.get().forEach(function (tab) {
            if (!visibleTabIds.includes(tab.id)) {
                webviews.hide(tab.id)
            }
        })
    })

    task.tabs.get().forEach(function (tab, index) {
        webviews.show(tab.id)
        webviews.setBounds(tab.id, getTileBounds(task.tabs.count(), index))
    })

    if (activeTabId) {
        webviews.setSelected(activeTabId, { focus: true })
    }

    updateTaskIndicator()
}

function syncActiveTaskLayout() {
    syncTaskViews(tasks.getSelected())
}

function initialize() {
    updateTaskIndicator()

    const indicator = document.getElementById('task-layout-indicator')
    if (indicator) {
        indicator.addEventListener('click', function () {
            require('taskOverlay/taskOverlay.js').show()
        })
    }

    window.addEventListener('resize', function () {
        syncActiveTaskLayout()
    })

    tasks.on('task-selected', function () {
        syncActiveTaskLayout()
    })

    tasks.on('task-added', function () {
        updateTaskIndicator()
    })

    tasks.on('task-updated', function (id, key) {
        if (key === 'name' || key === 'collapsed') {
            updateTaskIndicator()
        }
    })

    tasks.on('tab-added', function (tabId, tab, options, taskId) {
        if (tasks.getSelected() && taskId === tasks.getSelected().id) {
            syncActiveTaskLayout()
        } else {
            updateTaskIndicator()
        }
    })

    tasks.on('tab-destroyed', function (tabId, taskId) {
        const task = tasks.get(taskId)
        if (task && taskId === tasks.getSelected().id) {
            syncActiveTaskLayout()
        } else {
            updateTaskIndicator()
        }
    })

    tasks.on('tab-splice', function (taskId) {
        if (tasks.getSelected() && taskId === tasks.getSelected().id) {
            syncActiveTaskLayout()
        }
    })

    tasks.on('tab-selected', function () {
        updateTaskIndicator()
    })
}

module.exports = {
    initialize,
    syncActiveTaskLayout,
    updateTaskIndicator,
    getTileBounds
}
