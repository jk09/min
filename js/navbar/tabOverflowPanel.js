const tabOverflow = require('navbar/tabOverflow')

const MAX_GROUPS = 12
const MAX_TABS_PER_GROUP = 8

const tabOverflowPanel = {
  container: null,
  isShown: false,
  onSelect: null,
  create: function () {
    if (tabOverflowPanel.container) {
      return tabOverflowPanel.container
    }

    const container = document.createElement('div')
    container.className = 'tab-overflow-panel theme-background-color theme-text-color'
    container.setAttribute('role', 'dialog')
    container.hidden = true

    document.body.appendChild(container)
    tabOverflowPanel.container = container

    return container
  },
  buildContent: function (summary) {
    const container = tabOverflowPanel.container
    empty(container)

    const heading = document.createElement('div')
    heading.className = 'tab-overflow-panel-heading'
    heading.textContent = l('tabOverflowHeading').replace('%n', summary.total)
    container.appendChild(heading)

    const status = document.createElement('div')
    status.className = 'tab-overflow-panel-status'
    status.textContent = l('tabOverflowStatus').replace('%l', summary.loading).replace('%u', summary.notLoaded)
    container.appendChild(status)

    const list = document.createElement('div')
    list.className = 'tab-overflow-panel-list'

    summary.groups.slice(0, MAX_GROUPS).forEach(function (group) {
      const groupHeading = document.createElement('div')
      groupHeading.className = 'tab-overflow-group-heading'

      const domainEl = document.createElement('span')
      domainEl.textContent = group.domain || l('newTabLabel')
      groupHeading.appendChild(domainEl)

      const countEl = document.createElement('span')
      countEl.className = 'tab-overflow-group-count'
      countEl.textContent = group.count
      groupHeading.appendChild(countEl)

      list.appendChild(groupHeading)

      group.tabs.slice(0, MAX_TABS_PER_GROUP).forEach(function (tab) {
        const item = document.createElement('button')
        item.className = 'tab-overflow-item'
        item.textContent = tab.label
        item.title = tab.title || tab.label
        item.addEventListener('click', function () {
          const callback = tabOverflowPanel.onSelect
          tabOverflowPanel.hide()
          if (callback) {
            callback(tab.id)
          }
        })
        list.appendChild(item)
      })
    })

    container.appendChild(list)
  },
  show: function (hiddenTabs, onSelect) {
    tabOverflowPanel.create()
    tabOverflowPanel.onSelect = onSelect
    tabOverflowPanel.buildContent(tabOverflow.summarizeHiddenTabs(hiddenTabs))

    tabOverflowPanel.container.hidden = false
    tabOverflowPanel.isShown = true

    const firstItem = tabOverflowPanel.container.querySelector('.tab-overflow-item')
    if (firstItem) {
      firstItem.focus()
    }
  },
  hide: function () {
    if (!tabOverflowPanel.isShown) {
      return
    }
    tabOverflowPanel.container.hidden = true
    tabOverflowPanel.isShown = false
    tabOverflowPanel.onSelect = null
  },
  toggle: function (hiddenTabs, onSelect) {
    if (tabOverflowPanel.isShown) {
      tabOverflowPanel.hide()
    } else {
      tabOverflowPanel.show(hiddenTabs, onSelect)
    }
  },
  initialize: function () {
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        tabOverflowPanel.hide()
      }
    })

    document.addEventListener('click', function (e) {
      if (!tabOverflowPanel.isShown) {
        return
      }
      if (tabOverflowPanel.container.contains(e.target) || (e.target.closest && e.target.closest('#tab-overflow-label'))) {
        return
      }
      tabOverflowPanel.hide()
    })

    tasks.on('tab-selected', function () {
      tabOverflowPanel.hide()
    })
  }
}

module.exports = tabOverflowPanel
