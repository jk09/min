function getWebviews () {
  try {
    return require('webviews.js')
  } catch (error) {
    return {
      getContentBounds: function () {
        return { x: 0, y: 0, width: 1000, height: 800 }
      },
      show: function () { },
      hide: function () { },
      setBounds: function () { },
      setSelected: function () { }
    }
  }
}

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

function getLayoutTileCount (layout) {
  switch (layout) {
    case 'two-horizontal':
    case 'two-vertical':
      return 2
    case 'four-grid':
      return 4
    default:
      return 1
  }
}

function getTileFrames (count, layout) {
  const bounds = getWebviews().getContentBounds()

  if (count <= 1) {
    return [bounds]
  }

  if (count === 2 && layout === 'two-vertical') {
    return splitBounds(bounds, 1, 2)
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

function getTileBounds (count, index, layout) {
  return getTileFrames(count, layout)[index]
}

function getBrowserUI () {
  return require('browserUI.js')
}

function getTaskLabel (task) {
  if (!task) {
    return ''
  }

  return task.name || l('defaultTaskName').replace('%n', tasks.getIndex(task.id) + 1)
}

function getActiveTileIndex (task) {
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

function getActiveTile (task) {
  if (!task || task.tabs.count() === 0) {
    return null
  }

  return task.tabs.get(task.tabs.getSelected()) || task.tabs.getAtIndex(0)
}

function getTaskLayout (task) {
  if (!task || !task.tileLayout) {
    return 'single'
  }

  return task.tileLayout
}

function getLayoutPresetTabs (layout, task) {
  const orderedTabs = task && task.tabs && typeof task.tabs.get === 'function' ? task.tabs.get() : []

  if (!orderedTabs.length) {
    return []
  }

  const tileCount = getLayoutTileCount(layout)

  if (tileCount <= 1) {
    const selectedId = task.tabs.getSelected ? task.tabs.getSelected() : null

    if (selectedId) {
      const selectedTab = task.tabs.get(selectedId)
      if (selectedTab) {
        return [selectedTab]
      }
    }

    return orderedTabs.slice(0, 1)
  }

  return orderedTabs.slice(0, tileCount)
}

function getTileLabel (tab) {
  const title = tab.title || l('newTabLabel')
  return title
}

function updateLayoutSwitcher (task) {
  const buttons = document.querySelectorAll('.layout-switcher-button')

  if (!buttons.length) {
    return
  }

  const layout = getTaskLayout(task)

  buttons.forEach(function (button) {
    const selected = button.getAttribute('data-layout') === layout
    button.classList.toggle('selected', selected)
    button.setAttribute('aria-pressed', selected ? 'true' : 'false')
  })
}

function setTaskLayout (layout) {
  const task = tasks.getSelected()

  if (!task || getTaskLayout(task) === layout) {
    return
  }

  tasks.update(task.id, { tileLayout: layout })
  syncActiveTaskLayout()
}

function renderTaskSummary (task) {
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

function renderTileStrip (task) {
  const strip = document.getElementById('task-tile-strip')

  if (!strip) {
    return
  }

  empty(strip)

  if (!task) {
    return
  }

  const activeId = task.tabs.getSelected() || (task.tabs.getAtIndex(0) && task.tabs.getAtIndex(0).id)

  task.tabs.get().forEach(function (tab) {
    const chip = document.createElement('button')
    chip.className = 'task-tile-chip'
    chip.title = getTileLabel(tab)
    chip.setAttribute('aria-label', getTileLabel(tab))
    chip.setAttribute('role', 'tab')
    chip.setAttribute('aria-selected', tab.id === activeId ? 'true' : 'false')

    const icon = document.createElement('span')
    icon.className = 'task-tile-chip-icon'

    if (tab.favicon && tab.favicon.url) {
      const faviconImg = document.createElement('img')
      faviconImg.src = tab.favicon.url
      faviconImg.alt = ''
      icon.appendChild(faviconImg)
    } else {
      const fallbackIcon = document.createElement('i')
      fallbackIcon.className = 'i carbon:document'
      icon.appendChild(fallbackIcon)
    }

    const label = document.createElement('span')
    label.className = 'task-tile-chip-label'
    label.textContent = getTileLabel(tab)

    chip.appendChild(icon)
    chip.appendChild(label)

    if (tab.id === activeId) {
      chip.classList.add('selected')
    }

    chip.addEventListener('click', function () {
      getBrowserUI().switchToTab(tab.id)
    })

    strip.appendChild(chip)
  })
}

function updateActionButtons (task) {
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

function updateTaskIndicator () {
  const task = tasks.getSelected()

  renderTaskSummary(task)
  renderTileStrip(task)
  updateLayoutSwitcher(task)
  updateActionButtons(task)
}

function syncTaskViews (task) {
  if (!task) {
    return
  }

  const layout = getTaskLayout(task)
  const visibleTabs = getLayoutPresetTabs(layout, task)
  const visibleTabIds = visibleTabs.map(tab => tab.id)
  const activeTabId = task.tabs.getSelected() || (task.tabs.getAtIndex(0) && task.tabs.getAtIndex(0).id)
  const taskTabs = task.tabs.get()
  const visibleIndices = visibleTabs.reduce(function (result, tab, index) {
    result[tab.id] = index
    return result
  }, {})

  tasks.forEach(function (otherTask) {
    otherTask.tabs.get().forEach(function (tab) {
      if (!visibleTabIds.includes(tab.id)) {
        getWebviews().hide(tab.id)
      }
    })
  })

  taskTabs.forEach(function (tab) {
    const visibleIndex = visibleIndices[tab.id]

    if (visibleIndex === undefined) {
      getWebviews().hide(tab.id)
      return
    }

    getWebviews().show(tab.id)
    getWebviews().setBounds(tab.id, getTileBounds(visibleTabs.length, visibleIndex, layout))
  })

  if (activeTabId && visibleIndices[activeTabId] !== undefined) {
    getWebviews().setSelected(activeTabId, { focus: true, skipBounds: true })
  }

  updateTaskIndicator()
}

function syncActiveTaskLayout () {
  syncTaskViews(tasks.getSelected())
}

function selectTileByOffset (offset) {
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

function splitTile () {
  getBrowserUI().addTab()
}

function mergeTile () {
  if (!tabs.getSelected()) {
    return
  }

  getBrowserUI().closeTab(tabs.getSelected())
}

function moveTileLeft () {
  if (!tabs.getSelected()) {
    return
  }

  getBrowserUI().moveTabLeft(tabs.getSelected())
}

function moveTileRight () {
  if (!tabs.getSelected()) {
    return
  }

  getBrowserUI().moveTabRight(tabs.getSelected())
}

function initialize () {
  updateTaskIndicator()

  const indicator = document.getElementById('task-layout-indicator')
  const summary = document.getElementById('task-layout-summary')
  const splitButton = document.getElementById('task-layout-split')
  const mergeButton = document.getElementById('task-layout-merge')
  const moveLeftButton = document.getElementById('task-layout-move-left')
  const moveRightButton = document.getElementById('task-layout-move-right')
  const layoutButtons = document.querySelectorAll('.layout-switcher-button')

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

  layoutButtons.forEach(function (button) {
    button.addEventListener('click', function () {
      setTaskLayout(button.getAttribute('data-layout'))
    })
  })

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
    if (key === 'name' || key === 'collapsed' || key === 'tileLayout') {
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
  selectTileByOffset,
  getLayoutPresetTabs,
  getTaskLayout
}
