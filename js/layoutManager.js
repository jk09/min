var webviews = require('webviews.js')

function splitBounds(bounds, columns, rows) {
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

function getTileFrames(count) {
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

function getTileBounds(count, index) {
    return getTileFrames(count)[index]
}

function getBrowserUI() {
    return require('browserUI.js')
}

function getTaskLabel(task) {
    if (!task) {
        return ''
    }

    return task.name || l('defaultTaskName').replace('%n', tasks.getIndex(task.id) + 1)
}

function getActiveTileIndex(task) {
    if (!task || task.tabs.count() === 0) {
        return -1
    }

    const selectedId = task.tabs.getSelected()
    if (!selectedId) {
        return 0
    }

    const selectedIndex = task.tabs.getIndex(selectedId)
    return selectedIndex < 0 ? 0 : selectedIndex
}

function getActiveTile(task) {
    if (!task || task.tabs.count() === 0) {
        return null
    }

    return task.tabs.get(task.tabs.getSelected()) || task.tabs.getAtIndex(0)
}

function getTileLabel(tab, index) {
    const title = tab.title || l('newTabLabel')
    return (index + 1) + '. ' + title
}

function renderTaskSummary(task) {
    const title = document.getElementById('task-layout-indicator-title')
    const detail = document.getElementById('task-layout-indicator-detail')

    if (!title || !detail) {
        return
    }

    if (!task) {
        title.textContent = ''
        detail.textContent = ''
        return
    }

    const activeTile = getActiveTile(task)
    const activeIndex = getActiveTileIndex(task)
    const tileCount = task.tabs.count()

    title.textContent = getTaskLabel(task)
    detail.textContent = (activeIndex + 1) + ' / ' + tileCount + ' tiles' + (activeTile && activeTile.title ? ' · ' + activeTile.title : '')
}

function renderTileStrip(task) {
    const strip = document.getElementById('task-tile-strip')

    if (!strip) {
        return
    }

    empty(strip)

    if (!task) {
        return
    }

    const activeId = task.tabs.getSelected() || (task.tabs.getAtIndex(0) && task.tabs.getAtIndex(0).id)

    task.tabs.get().forEach(function (tab, index) {
        const chip = document.createElement('button')
        chip.className = 'task-tile-chip'
        chip.textContent = String(index + 1)
        chip.title = getTileLabel(tab, index)
        chip.setAttribute('aria-label', getTileLabel(tab, index))
        chip.setAttribute('role', 'tab')
        chip.setAttribute('aria-selected', tab.id === activeId ? 'true' : 'false')

        if (tab.id === activeId) {
            chip.classList.add('selected')
        }

        chip.addEventListener('click', function () {
            getBrowserUI().switchToTab(tab.id)
        })

        strip.appendChild(chip)
    })
}

function updateActionButtons(task) {
    const splitButton = document.getElementById('task-layout-split')
    const mergeButton = document.getElementById('task-layout-merge')
    const moveLeftButton = document.getElementById('task-layout-move-left')
    const moveRightButton = document.getElementById('task-layout-move-right')

    if (!splitButton || !mergeButton || !moveLeftButton || !moveRightButton) {
        return
    }

    const activeIndex = getActiveTileIndex(task)
    const tileCount = task ? task.tabs.count() : 0

    splitButton.disabled = !task
    mergeButton.disabled = !task || tileCount === 0
    moveLeftButton.disabled = activeIndex <= 0
    moveRightButton.disabled = activeIndex < 0 || activeIndex >= tileCount - 1
}

function updateTaskIndicator() {
    const task = tasks.getSelected()

    renderTaskSummary(task)
    renderTileStrip(task)
    updateActionButtons(task)
}

function syncTaskViews(task) {
    if (!task) {
        return
    }

    const visibleTabIds = task.tabs.get().map(tab => tab.id)
    const activeTabId = task.tabs.getSelected() || (task.tabs.getAtIndex(0) && task.tabs.getAtIndex(0).id)
    const taskTabs = task.tabs.get()

    tasks.forEach(function (otherTask) {
        otherTask.tabs.get().forEach(function (tab) {
            if (!visibleTabIds.includes(tab.id)) {
                webviews.hide(tab.id)
            }
        })
    })

    taskTabs.forEach(function (tab, index) {
        webviews.show(tab.id)
        webviews.setBounds(tab.id, getTileBounds(taskTabs.length, index))
    })

    if (activeTabId) {
        webviews.setSelected(activeTabId, { focus: true, skipBounds: true })
    }

    updateTaskIndicator()
}

function syncActiveTaskLayout() {
    syncTaskViews(tasks.getSelected())
}

function selectTileByOffset(offset) {
    const task = tasks.getSelected()
    if (!task || task.tabs.count() < 2) {
        return
    }

    const activeIndex = getActiveTileIndex(task)
    const nextIndex = (activeIndex + offset + task.tabs.count()) % task.tabs.count()
    const nextTab = task.tabs.getAtIndex(nextIndex)

    if (nextTab) {
        getBrowserUI().switchToTab(nextTab.id)
    }
}

function splitTile() {
    getBrowserUI().addTab()
}

function mergeTile() {
    if (!tabs.getSelected()) {
        return
    }

    getBrowserUI().closeTab(tabs.getSelected())
}

function moveTileLeft() {
    if (!tabs.getSelected()) {
        return
    }

    getBrowserUI().moveTabLeft(tabs.getSelected())
}

function moveTileRight() {
    if (!tabs.getSelected()) {
        return
    }

    getBrowserUI().moveTabRight(tabs.getSelected())
}

function initialize() {
    updateTaskIndicator()

    const indicator = document.getElementById('task-layout-indicator')
    const summary = document.getElementById('task-layout-summary')
    const splitButton = document.getElementById('task-layout-split')
    const mergeButton = document.getElementById('task-layout-merge')
    const moveLeftButton = document.getElementById('task-layout-move-left')
    const moveRightButton = document.getElementById('task-layout-move-right')

    if (summary) {
        summary.addEventListener('click', function (e) {
            if (e.target.closest('button')) {
                return
            }

            require('taskOverlay/taskOverlay.js').show()
        })
    }

    if (splitButton) {
        splitButton.addEventListener('click', splitTile)
    }

    if (mergeButton) {
        mergeButton.addEventListener('click', mergeTile)
    }

    if (moveLeftButton) {
        moveLeftButton.addEventListener('click', moveTileLeft)
    }

    if (moveRightButton) {
        moveRightButton.addEventListener('click', moveTileRight)
    }

    if (indicator) {
        indicator.addEventListener('click', function (e) {
            if (e.target.closest('button')) {
                return
            }
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

    tasks.on('tab-updated', function (tabId, key) {
        if (key === 'title' || key === 'url' || key === 'selected') {
            updateTaskIndicator()
        }
    })
}

module.exports = {
    initialize,
    syncActiveTaskLayout,
    updateTaskIndicator,
    getTileBounds,
    splitTile,
    mergeTile,
    moveTileLeft,
    moveTileRight,
    selectTileByOffset
}
