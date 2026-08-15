const UNKNOWN = 'unknown'

function formatLabel(info) {
    if (!info || !info.shortCommit || info.shortCommit === UNKNOWN) {
        return '#' + UNKNOWN
    }

    return '#' + info.shortCommit + (info.dirty ? '*' : '')
}

function formatTitle(info) {
    if (!info || !info.commit || info.commit === UNKNOWN) {
        return 'Build commit unknown (built without git metadata)'
    }

    return [
        'Commit: ' + info.commit,
        'Branch: ' + (info.branch || UNKNOWN),
        'Working tree: ' + (info.dirty ? 'modified' : 'clean'),
        'Built: ' + (info.buildTime || UNKNOWN)
    ].join('\n')
}

function render(element, info) {
    if (!element) {
        return
    }

    const title = formatTitle(info)
    element.textContent = formatLabel(info)
    element.title = title
    element.setAttribute('aria-label', title)
}

module.exports = { formatLabel, formatTitle, render }
