const webviews = require('webviews.js')
const settings = require('util/settings/settings.js')
const sessionSidebarState = require('navbar/sessionSidebarState.js')
const historyGraphTab = require('places/historyGraphTab.js')

const sidebarWidth = 280

var sessionSidebar = {
  container: document.getElementById('session-sidebar'),
  list: document.getElementById('session-sidebar-list'),
  toggleButton: document.getElementById('session-sidebar-toggle'),
  historyButton: document.getElementById('session-sidebar-history'),
  optionsToggleButton: document.getElementById('session-sidebar-options-toggle'),
  optionsMenu: document.getElementById('session-sidebar-options'),
  visible: false,
  position: 'left',
  render: function () {
    empty(sessionSidebar.list)

    sessionSidebarState.getSessionItems(tabs.get(), tabs.getSelected()).filter(function (item) {
      return !historyGraphTab.isHistoryGraphURL(item.url)
    }).forEach(function (item) {
      var button = document.createElement('button')
      button.className = 'session-sidebar-item'
      button.type = 'button'
      button.textContent = item.description
      button.setAttribute('data-tab-id', item.id)

      if (item.selected) {
        button.classList.add('selected')
        button.setAttribute('aria-current', 'page')
      }

      button.addEventListener('click', function () {
        require('browserUI.js').switchToTab(item.id)
      })

      sessionSidebar.list.appendChild(button)
    })
  },
  getMargins: function (position) {
    return position === 'right'
      ? [0, sidebarWidth, 0, 0]
      : [0, 0, 0, sidebarWidth]
  },
  setPosition: function (position, save) {
    var nextPosition = position === 'right' ? 'right' : 'left'
    if (sessionSidebar.visible) {
      var previousMargins = sessionSidebar.getMargins(sessionSidebar.position)
      webviews.adjustMargin(previousMargins.map(value => -value))
      webviews.adjustMargin(sessionSidebar.getMargins(nextPosition))
    }
    sessionSidebar.position = nextPosition
    sessionSidebar.container.setAttribute('data-position', nextPosition)
    sessionSidebar.optionsMenu.querySelectorAll('[data-sidebar-position]').forEach(function (button) {
      button.setAttribute('aria-checked', String(button.getAttribute('data-sidebar-position') === nextPosition))
    })
    if (save) {
      settings.set('sessionSidebarPosition', nextPosition)
    }
  },
  toggleOptions: function () {
    sessionSidebar.optionsMenu.hidden = !sessionSidebar.optionsMenu.hidden
    sessionSidebar.optionsToggleButton.setAttribute('aria-expanded', String(!sessionSidebar.optionsMenu.hidden))
  },
  toggle: function () {
    sessionSidebar.visible = !sessionSidebar.visible
    sessionSidebar.container.hidden = !sessionSidebar.visible
    sessionSidebar.toggleButton.setAttribute('aria-pressed', String(sessionSidebar.visible))
    sessionSidebar.toggleButton.setAttribute('aria-label', sessionSidebar.visible ? 'Hide session sidebar' : 'Show session sidebar')
    sessionSidebar.toggleButton.title = sessionSidebar.toggleButton.getAttribute('aria-label')

    if (sessionSidebar.visible) {
      sessionSidebar.render()
      webviews.adjustMargin(sessionSidebar.getMargins(sessionSidebar.position))
    } else {
      webviews.adjustMargin(sessionSidebar.getMargins(sessionSidebar.position).map(value => -value))
    }
  },
  initialize: function () {
    sessionSidebar.toggleButton.addEventListener('click', sessionSidebar.toggle)
    sessionSidebar.historyButton.addEventListener('click', historyGraphTab.open)
    sessionSidebar.optionsToggleButton.addEventListener('click', sessionSidebar.toggleOptions)
    sessionSidebar.optionsMenu.querySelectorAll('[data-sidebar-position]').forEach(function (button) {
      button.addEventListener('click', function () {
        sessionSidebar.setPosition(button.getAttribute('data-sidebar-position'), true)
        sessionSidebar.toggleOptions()
      })
    })
    settings.listen('sessionSidebarPosition', function (position) {
      sessionSidebar.setPosition(position, false)
    })
    tasks.on('tab-added', sessionSidebar.render)
    tasks.on('tab-destroyed', sessionSidebar.render)
    tasks.on('tab-selected', sessionSidebar.render)
    tasks.on('tab-updated', function (id, key) {
      if (key === 'title' || key === 'url') {
        sessionSidebar.render()
      }
    })
  }
}

module.exports = sessionSidebar
