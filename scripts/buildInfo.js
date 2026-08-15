/* collect git metadata at build time and compile it into dist/buildInfo.build.js */

const path = require('path')
const fs = require('fs')
const { execFileSync } = require('child_process')

const rootDir = path.join(__dirname, '../')
const outputDir = path.join(__dirname, '../dist')
const outputFile = path.join(outputDir, 'buildInfo.build.js')

const UNKNOWN = 'unknown'

function defaultGitRunner (args) {
  return execFileSync('git', args, { cwd: rootDir, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] })
}

function collectBuildInfo (runGit = defaultGitRunner, now = new Date()) {
  const info = {
    commit: UNKNOWN,
    shortCommit: UNKNOWN,
    branch: UNKNOWN,
    dirty: false,
    buildTime: now.toISOString()
  }

  let commit
  try {
    commit = runGit(['rev-parse', 'HEAD']).trim()
  } catch (e) {
    return info
  }

  if (!/^[0-9a-f]{40}$/.test(commit)) {
    return info
  }

  info.commit = commit
  info.shortCommit = commit.slice(0, 7)

  try {
    info.branch = runGit(['rev-parse', '--abbrev-ref', 'HEAD']).trim() || UNKNOWN
  } catch (e) {
    info.branch = UNKNOWN
  }

  try {
    info.dirty = runGit(['status', '--porcelain']).trim().length > 0
  } catch (e) {
    info.dirty = false
  }

  return info
}

function buildBuildInfo () {
  const contents = 'module.exports = Object.freeze(' + JSON.stringify(collectBuildInfo()) + ');\n'

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir)
  }

  fs.writeFileSync(outputFile, contents, 'utf-8')
}

if (module.parent) {
  module.exports = buildBuildInfo
  module.exports.collectBuildInfo = collectBuildInfo
} else {
  buildBuildInfo()
}
