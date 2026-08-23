/* shared loading, hashing and lookup helpers for the feature ledger (spec/FEATURES.json) */

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const rootDir = path.join(__dirname, '../')
const ledgerPath = path.join(rootDir, 'spec/FEATURES.json')

const STATUSES = ['active', 'superseded', 'removed']
const TIERS = ['unit', 'integration', 'e2e']
const SPEC_PATH_PATTERN = /^spec\/(backlog|in_progress|done|blocked)\/[^/]+\/SPEC\.md$/

function toRepoPath (absolutePath) {
  return path.relative(rootDir, absolutePath).split(path.sep).join('/')
}

function toAbsolutePath (repoPath) {
  return path.join(rootDir, repoPath)
}

function exists (repoPath) {
  return fs.existsSync(toAbsolutePath(repoPath))
}

function loadLedger () {
  return JSON.parse(fs.readFileSync(ledgerPath, 'utf-8'))
}

function saveLedger (ledger) {
  fs.writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2) + '\n')
}

function testFilesOf (feature) {
  return TIERS.reduce((all, tier) => all.concat((feature.tests && feature.tests[tier]) || []), [])
}

/* hashes the feature's own source files, so a code change without re-verification is detectable in the working tree */
function computeSourceHash (feature) {
  const files = (feature.sourceFiles || []).slice().sort()
  if (files.length === 0) {
    return null
  }
  const hash = crypto.createHash('sha256')
  files.forEach(function (file) {
    hash.update(file)
    hash.update('\0')
    hash.update(fs.readFileSync(toAbsolutePath(file)))
    hash.update('\0')
  })
  return 'sha256:' + hash.digest('hex')
}

function walk (dir, predicate, found = []) {
  if (!fs.existsSync(dir)) {
    return found
  }
  fs.readdirSync(dir, { withFileTypes: true }).forEach(function (entry) {
    const entryPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      walk(entryPath, predicate, found)
    } else if (predicate(toRepoPath(entryPath))) {
      found.push(toRepoPath(entryPath))
    }
  })
  return found
}

function findSpecFiles () {
  return walk(path.join(rootDir, 'spec'), (p) => SPEC_PATH_PATTERN.test(p)).sort()
}

function findTestFiles () {
  return walk(path.join(rootDir, 'test'), (p) => p.endsWith('.test.js')).sort()
}

function activeFeatures (ledger) {
  return ledger.features.filter((feature) => feature.status === 'active')
}

function retiredFeatures (ledger) {
  return ledger.features.filter((feature) => feature.status !== 'active')
}

module.exports = {
  STATUSES,
  TIERS,
  SPEC_PATH_PATTERN,
  ledgerPath,
  rootDir,
  toAbsolutePath,
  exists,
  loadLedger,
  saveLedger,
  testFilesOf,
  computeSourceHash,
  findSpecFiles,
  findTestFiles,
  activeFeatures,
  retiredFeatures
}
