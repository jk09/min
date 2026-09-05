const webviews = require('webviews.js')
const sessionSidebarState = require('navbar/sessionSidebarState.js')

const sidebarWidth = 280

var sessionSidebar = {
  container: document.getElementById('session-sidebar'),
  toggleButton: document.getElementById('session-sidebar-toggle'),
  visible: false,
  render: function () {
    empty(sessionSidebar.container)

    sessionSidebarState.getSessionItems(tabs.get(), tabs.getSelected()).forEach(function (item) {
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

      sessionSidebar.container.appendChild(button)
    })
  },
  toggle: function () {
    sessionSidebar.visible = !sessionSidebar.visible
    sessionSidebar.container.hidden = !sessionSidebar.visible
    sessionSidebar.toggleButton.setAttribute('aria-pressed', String(sessionSidebar.visible))
    sessionSidebar.toggleButton.setAttribute('aria-label', sessionSidebar.visible ? 'Hide session sidebar' : 'Show session sidebar')
    sessionSidebar.toggleButton.title = sessionSidebar.toggleButton.getAttribute('aria-label')

    if (sessionSidebar.visible) {
      sessionSidebar.render()
      webviews.adjustMargin([0, 0, 0, sidebarWidth])
    } else {
      webviews.adjustMargin([0, 0, 0, -sidebarWidth])
    }
  },
  initialize: function () {
    sessionSidebar.toggleButton.addEventListener('click', sessionSidebar.toggle)
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
