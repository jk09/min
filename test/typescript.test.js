require('../scripts/registerTs.js')
const test = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const path = require('path')
const ts = require('typescript')
const tsTransform = require('../scripts/tsTransform')

test('tsconfig.json exists and is properly configured', function () {
  const tsconfigPath = path.resolve(__dirname, '../tsconfig.json')
  assert.ok(fs.existsSync(tsconfigPath), 'tsconfig.json must exist in root')

  const content = fs.readFileSync(tsconfigPath, 'utf-8')
  const config = JSON.parse(content)

  assert.ok(config.compilerOptions, 'compilerOptions should be defined')
  assert.strictEqual(config.compilerOptions.allowJs, true, 'allowJs should be enabled')
  assert.strictEqual(config.compilerOptions.noEmit, true, 'noEmit should be enabled')
  assert.ok(config.compilerOptions.paths, 'paths mapping should be defined')
})

test('type declarations exist and provide Min ambient types', function () {
  const globalsDts = path.resolve(__dirname, '../types/globals.d.ts')
  const minDts = path.resolve(__dirname, '../types/min.d.ts')
  const modulesDts = path.resolve(__dirname, '../types/modules.d.ts')

  assert.ok(fs.existsSync(globalsDts), 'types/globals.d.ts should exist')
  assert.ok(fs.existsSync(minDts), 'types/min.d.ts should exist')
  assert.ok(fs.existsSync(modulesDts), 'types/modules.d.ts should exist')

  const globalsContent = fs.readFileSync(globalsDts, 'utf-8')
  assert.match(globalsContent, /declare global/, 'globals.d.ts should declare global types')
  assert.match(globalsContent, /tabs:\s*TabList/, 'globals.d.ts should declare tabs')
  assert.match(globalsContent, /tasks:\s*TaskList/, 'globals.d.ts should declare tasks')
  assert.match(globalsContent, /ipc:\s*IpcRenderer/, 'globals.d.ts should declare ipc')

  const minContent = fs.readFileSync(minDts, 'utf-8')
  assert.match(minContent, /interface TabList/, 'min.d.ts should declare TabList interface')
  assert.match(minContent, /interface TaskList/, 'min.d.ts should declare TaskList interface')
  assert.match(minContent, /interface ToolDefinition/, 'min.d.ts should declare ToolDefinition')
})

test('tsTransform transpiles TypeScript to CommonJS JavaScript', function (t, done) {
  const transform = tsTransform('test.ts')
  let output = ''

  transform.on('data', function (chunk) {
    output += chunk.toString('utf-8')
  })

  transform.on('end', function () {
    assert.match(output, /const greet = \(name\)/, 'TypeScript function should be transpiled')
    assert.doesNotMatch(output, /:\s*string/, 'Type annotations should be stripped')
    done()
  })

  transform.write('const greet = (name: string): string => `Hello, ${name}`;')
  transform.end()
})

test('TypeScript compiler program runs on project without diagnostic errors', function () {
  const configPath = path.resolve(__dirname, '../tsconfig.json')
  const configFile = ts.readConfigFile(configPath, ts.sys.readFile)
  assert.strictEqual(configFile.error, undefined, 'Config file should have no parse errors')

  const parsedConfig = ts.parseJsonConfigFileContent(
    configFile.config,
    ts.sys,
    path.dirname(configPath)
  )

  const program = ts.createProgram({
    rootNames: parsedConfig.fileNames,
    options: parsedConfig.options
  })

  const diagnostics = ts.getPreEmitDiagnostics(program)
  const errors = diagnostics.filter(
    d => d.category === ts.DiagnosticCategory.Error
  )

  if (errors.length > 0) {
    const errorMessages = errors.map(d => {
      const msg = ts.flattenDiagnosticMessageText(d.messageText, '\n')
      if (d.file) {
        const { line, character } = d.file.getLineAndCharacterOfPosition(d.start)
        return `${d.file.fileName} (${line + 1},${character + 1}): ${msg}`
      }
      return msg
    })
    assert.fail(`TypeScript found ${errors.length} error(s):\n${errorMessages.join('\n')}`)
  }

  assert.strictEqual(errors.length, 0, 'There should be 0 TypeScript errors')
})

test('converted TypeScript modules load and execute with correct types', function () {
  const planParser = require('../js/llmPrompt/planParser')
  const breadcrumbLayout = require('../js/navbar/breadcrumbLayout')
  const tabLabel = require('../js/navbar/tabLabel')
  const tabOverflow = require('../js/navbar/tabOverflow')
  const planningSkill = require('../js/llmPrompt/planningSkill')
  const agentRegistry = require('../js/llmPrompt/agents/agentRegistry')
  const searchEngineRegistry = require('../js/llmPrompt/searchEngines/searchEngineRegistry')
  const ownModelRegistry = require('../js/llmPrompt/ownModels/ownModelRegistry')
  const startupPage = require('../js/util/startupPage')
  const buildInfo = require('../js/llmPrompt/buildInfo')

  assert.strictEqual(typeof planParser.parsePlan, 'function')
  assert.strictEqual(typeof breadcrumbLayout.computeVisibleBreadcrumbs, 'function')
  assert.strictEqual(typeof tabLabel.getTabLabel, 'function')
  assert.strictEqual(typeof tabOverflow.computeVisibleTabs, 'function')
  assert.strictEqual(typeof planningSkill.buildSystemPrompt, 'function')
  assert.strictEqual(typeof agentRegistry.getDefault, 'function')
  assert.strictEqual(typeof searchEngineRegistry.getDefault, 'function')
  assert.strictEqual(typeof ownModelRegistry.getDefault, 'function')
  assert.strictEqual(typeof startupPage.resolveStartupPageURL, 'function')
  assert.strictEqual(typeof buildInfo.formatLabel, 'function')

  const agent = agentRegistry.getDefault()
  assert.ok(agent && agent.id === 'claude', 'Agent registry returns default agent')

  const searchEngine = searchEngineRegistry.getDefault()
  assert.ok(searchEngine && searchEngine.id === 'bing', 'Search engine registry returns default engine')

  const ownModel = ownModelRegistry.getDefault()
  assert.ok(ownModel && ownModel.id === 'configured', 'Own model registry returns default configured model')
})
