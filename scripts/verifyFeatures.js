/* validates spec/FEATURES.json against the repository, and restamps verified entries */

const fs = require('fs')
const ledgerLib = require('./featureLedger')
const featureDocs = require('./featureDocs')

const REQUIRED_FIELDS = [
  'id', 'title', 'summary', 'status', 'specPath', 'supersedes', 'supersededBy',
  'removalReason', 'userVisible', 'sourceFiles', 'tests', 'requiredTiers',
  'sourceHash', 'lastVerified'
]

function createReport () {
  return { errors: [], warnings: [] }
}

function checkSchema (ledger, report) {
  if (ledger.schemaVersion !== 1) {
    report.errors.push('unsupported schemaVersion: ' + ledger.schemaVersion)
  }
  if (!Array.isArray(ledger.features)) {
    report.errors.push('features must be an array')
    return
  }

  ledger.features.forEach(function (feature, index) {
    const label = feature.id ? '`' + feature.id + '`' : 'feature #' + index
    REQUIRED_FIELDS.forEach(function (field) {
      if (!(field in feature)) {
        report.errors.push(label + ' is missing the field "' + field + '"')
      }
    })
    if (ledgerLib.STATUSES.indexOf(feature.status) === -1) {
      report.errors.push(label + ' has an invalid status: ' + feature.status)
    }
    if (!ledgerLib.SPEC_PATH_PATTERN.test(feature.specPath || '')) {
      report.errors.push(label + ' has a specPath outside spec/<workflow>/<slug>/SPEC.md: ' + feature.specPath)
    }
    ledgerLib.TIERS.forEach(function (tier) {
      if (!Array.isArray(feature.tests && feature.tests[tier])) {
        report.errors.push(label + ' is missing the test tier "' + tier + '"')
      }
    })
    ;(feature.requiredTiers || []).forEach(function (tier) {
      if (ledgerLib.TIERS.indexOf(tier) === -1) {
        report.errors.push(label + ' requires an unknown test tier: ' + tier)
      }
    })
  })
}

function checkUniqueness (ledger, report) {
  const seenIds = new Set()
  const seenSpecs = new Set()
  ledger.features.forEach(function (feature) {
    if (seenIds.has(feature.id)) {
      report.errors.push('duplicate feature id: `' + feature.id + '`')
    }
    seenIds.add(feature.id)

    if (seenSpecs.has(feature.specPath)) {
      report.errors.push('duplicate specPath claimed by `' + feature.id + '`: ' + feature.specPath)
    }
    seenSpecs.add(feature.specPath)

    const seenSources = new Set()
    feature.sourceFiles.forEach(function (file) {
      if (seenSources.has(file)) {
        report.errors.push('`' + feature.id + '` lists the source file twice: ' + file)
      }
      seenSources.add(file)
    })
  })
}

function checkReferences (ledger, report) {
  ledger.features.forEach(function (feature) {
    if (!ledgerLib.exists(feature.specPath)) {
      report.errors.push('`' + feature.id + '` references a missing spec: ' + feature.specPath)
    }
    feature.sourceFiles.forEach(function (file) {
      if (!ledgerLib.exists(file)) {
        report.errors.push('`' + feature.id + '` references a missing source file: ' + file)
      }
    })
    ledgerLib.testFilesOf(feature).forEach(function (file) {
      if (!ledgerLib.exists(file)) {
        report.errors.push('`' + feature.id + '` references a missing test file: ' + file)
      }
    })
  })
}

function checkOrphans (ledger, report) {
  const claimedSpecs = new Set(ledger.features.map((feature) => feature.specPath))
  ledgerLib.findSpecFiles().forEach(function (specPath) {
    if (!claimedSpecs.has(specPath)) {
      report.errors.push('specification is not claimed by any ledger entry: ' + specPath)
    }
  })

  const claimedTests = new Set()
  ledgerLib.activeFeatures(ledger).forEach(function (feature) {
    ledgerLib.testFilesOf(feature).forEach((file) => claimedTests.add(file))
  })
  ledgerLib.findTestFiles().forEach(function (testPath) {
    if (!claimedTests.has(testPath)) {
      report.errors.push('test file is not claimed by any active feature: ' + testPath)
    }
  })
}

function checkSupersession (ledger, report) {
  const byId = new Map(ledger.features.map((feature) => [feature.id, feature]))

  ledger.features.forEach(function (feature) {
    const label = '`' + feature.id + '`'

    if (feature.status === 'active' && feature.supersededBy !== null) {
      report.errors.push(label + ' is active but declares supersededBy')
    }
    if (feature.status === 'superseded' && !feature.supersededBy) {
      report.errors.push(label + ' is superseded but does not say by which feature')
    }
    if (feature.status === 'removed' && !feature.removalReason) {
      report.errors.push(label + ' is removed but gives no removalReason')
    }

    if (feature.supersededBy) {
      const successor = byId.get(feature.supersededBy)
      if (!successor) {
        report.errors.push(label + ' is superseded by an unknown feature: `' + feature.supersededBy + '`')
      } else if (successor.supersedes.indexOf(feature.id) === -1) {
        report.errors.push('`' + successor.id + '` does not list ' + label + ' in supersedes')
      }
    }

    feature.supersedes.forEach(function (predecessorId) {
      const predecessor = byId.get(predecessorId)
      if (!predecessor) {
        report.errors.push(label + ' supersedes an unknown feature: `' + predecessorId + '`')
      } else if (predecessor.supersededBy !== feature.id) {
        report.errors.push('`' + predecessorId + '` does not point back to ' + label + ' via supersededBy')
      }
    })

    if (feature.status !== 'active') {
      if (feature.sourceFiles.length > 0) {
        report.errors.push(label + ' is ' + feature.status + ' but still claims source files')
      }
      const staleTests = ledgerLib.testFilesOf(feature)
      if (staleTests.length > 0) {
        report.errors.push(label + ' is ' + feature.status + ' but still claims tests: ' + staleTests.join(', '))
      }
    }
  })

  /* a superseded entry must eventually resolve to an active one, otherwise context generation would drop live behaviour */
  ledger.features.forEach(function (feature) {
    const seen = new Set([feature.id])
    let current = feature
    while (current && current.supersededBy) {
      if (seen.has(current.supersededBy)) {
        report.errors.push('supersession cycle involving `' + feature.id + '`')
        return
      }
      seen.add(current.supersededBy)
      current = byId.get(current.supersededBy)
    }
  })
}

function checkCoverage (ledger, report) {
  ledgerLib.activeFeatures(ledger).forEach(function (feature) {
    const label = '`' + feature.id + '`'
    feature.requiredTiers.forEach(function (tier) {
      if (feature.tests[tier].length === 0) {
        report.errors.push(label + ' requires the ' + tier + ' tier but lists no ' + tier + ' tests')
      }
    })
    if (ledgerLib.testFilesOf(feature).length === 0) {
      report.warnings.push(label + ' has no automated tests')
    } else if (feature.userVisible && feature.tests.e2e.length === 0) {
      report.warnings.push(label + ' is user visible but has no end-to-end tests')
    }
  })
}

function checkStaleness (ledger, report) {
  ledgerLib.activeFeatures(ledger).forEach(function (feature) {
    const missing = feature.sourceFiles.filter((file) => !ledgerLib.exists(file))
    if (missing.length > 0) {
      return
    }
    const actual = ledgerLib.computeSourceHash(feature)
    if (actual !== feature.sourceHash) {
      report.errors.push('`' + feature.id + '` is stale: its source files changed since it was last verified. ' +
        'Run the tests, then `npm run features:restamp -- ' + feature.id + '`')
    }
  })
}

function checkGeneratedDocs (ledger, report) {
  const expected = featureDocs.renderDocs(ledger)
  const actual = fs.existsSync(featureDocs.docsPath) ? fs.readFileSync(featureDocs.docsPath, 'utf-8') : null
  if (actual !== expected) {
    report.errors.push('docs/features.md is out of date. Run `npm run features:docs`')
  }
}

function verify (ledger) {
  const report = createReport()
  checkSchema(ledger, report)
  if (report.errors.length > 0) {
    return report
  }
  checkUniqueness(ledger, report)
  checkReferences(ledger, report)
  checkOrphans(ledger, report)
  checkSupersession(ledger, report)
  checkCoverage(ledger, report)
  checkStaleness(ledger, report)
  checkGeneratedDocs(ledger, report)
  return report
}

function restamp (ids) {
  const ledger = ledgerLib.loadLedger()
  const all = ids.indexOf('--all') !== -1
  const targets = ledger.features.filter(function (feature) {
    return feature.status === 'active' && (all || ids.indexOf(feature.id) !== -1)
  })

  if (!all) {
    const known = new Set(ledger.features.map((feature) => feature.id))
    ids.filter((id) => !known.has(id)).forEach(function (id) {
      console.error('unknown feature id: ' + id)
      process.exitCode = 1
    })
    if (process.exitCode === 1) {
      return
    }
  }

  const today = new Date().toISOString().slice(0, 10)
  targets.forEach(function (feature) {
    feature.sourceHash = ledgerLib.computeSourceHash(feature)
    feature.lastVerified = today
  })
  ledgerLib.saveLedger(ledger)
  console.log('Restamped ' + targets.length + ' feature(s): ' + targets.map((f) => f.id).join(', '))
}

module.exports = { verify, createReport, checkSchema, checkUniqueness, checkSupersession, checkCoverage }

if (require.main === module) {
  const args = process.argv.slice(2)
  const restampIndex = args.indexOf('--restamp')

  if (restampIndex !== -1) {
    restamp(args.slice(restampIndex + 1))
  } else {
    const strict = args.indexOf('--strict') !== -1
    const report = verify(ledgerLib.loadLedger())

    report.warnings.forEach((warning) => console.warn('warning: ' + warning))
    report.errors.forEach((error) => console.error('error: ' + error))

    const failed = report.errors.length > 0 || (strict && report.warnings.length > 0)
    if (failed) {
      console.error('\nFeature ledger verification failed (' + report.errors.length + ' error(s), ' +
        report.warnings.length + ' warning(s)).')
      process.exit(1)
    }
    console.log('Feature ledger verified (' + report.warnings.length + ' warning(s)).')
  }
}
