var webviews = require('webviews.js')

function splitBounds (bounds, columns, rows) {
    const cellWidth = bounds.width / columns
    const cellHeight = bounds.height / rows
    const frames = []

    for (let row = 0; row < rows; row++) {
        for (let column = 0; column < columns; column++) {
            frames.push({
                x: Math.round(bounds.x + column * cellWidth),
                y: Math.round(bounds.y + row * cellHeight),
                width: Math.round(column === columns - 1 ? bounds.width - cellWidth * column : cellWidth),
                height: Math.round(row === rows - 1 ? bounds.height - cellHeight * row : cellHeight)
            })
        }
    }

    return frames
}

function getTileFrames (count) {
    const bounds = webviews.getContentBounds()

    if (count <= 1) {
        return [bounds]
    }

    if (count === 2) {
        return splitBounds(bounds, 2, 1)
    }

    if (count === 3) {
        const topRowHeight = Math.round(bounds.height * 0.55)
        const bottomRowHeight = bounds.height - topRowHeight

        return [
            {
                x: bounds.x,
                y: bounds.y,
                width: bounds.width,
                height: topRowHeight
            },
            {
                x: bounds.x,
                y: bounds.y + topRowHeight,
                width: Math.round(bounds.width / 2),
                height: bottomRowHeight
            },
            {
                x: bounds.x + Math.round(bounds.width / 2),
                y: bounds.y + topRowHeight,
                width: bounds.width - Math.round(bounds.width / 2),
                height: bottomRowHeight
            }
        ]
    }

    if (count === 4) {
        return splitBounds(bounds, 2, 2)
    }

    const columns = 3
    const rows = Math.ceil(count / columns)
    return splitBounds(bounds, columns, rows)
}

function getTileBounds (count, index) {
    return getTileFrames(count)[index]
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
