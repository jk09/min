/*
Minimal browser-side replacement for the Node EventEmitter the chrome renderer
used to receive through Node integration. It only implements the subset the
renderer relies on.
*/

class EventBus {
  constructor () {
    this.listeners = {}
  }

  on (name, listener) {
    if (!this.listeners[name]) {
      this.listeners[name] = []
    }
    this.listeners[name].push(listener)
    return this
  }

  off (name, listener) {
    const listeners = this.listeners[name]
    if (listeners) {
      this.listeners[name] = listeners.filter(item => item !== listener)
    }
    return this
  }

  once (name, listener) {
    const wrapped = (...data) => {
      this.off(name, wrapped)
      listener(...data)
    }
    return this.on(name, wrapped)
  }

  emit (name, ...data) {
    const listeners = this.listeners[name]
    if (!listeners || listeners.length === 0) {
      return false
    }
    listeners.slice().forEach(listener => listener(...data))
    return true
  }
}

module.exports = EventBus
