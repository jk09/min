/* collect git metadata at build time and compile it into dist/buildInfo.build.js */

import * as path from 'path'
import * as fs from 'fs'
import { execFileSync } from 'child_process'

const rootDir: string = path.join(__dirname, '../')
const outputDir: string = path.join(__dirname, '../dist')
const outputFile: string = path.join(outputDir, 'buildInfo.build.js')

export const UNKNOWN: string = 'unknown'

export type GitRunner = (args: string[]) => string

export interface CollectedBuildInfo {
  commit: string
  shortCommit: string
  branch: string
  dirty: boolean
  buildTime: string
}

export function defaultGitRunner (args: string[]): string {
  return execFileSync('git', args, { cwd: rootDir, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] })
}

export function collectBuildInfo (runGit: GitRunner = defaultGitRunner, now: Date = new Date()): CollectedBuildInfo {
  const info: CollectedBuildInfo = {
    commit: UNKNOWN,
    shortCommit: UNKNOWN,
    branch: UNKNOWN,
    dirty: false,
    buildTime: now.toISOString()
  }

  let commit: string
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

export function buildBuildInfo (): void {
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
