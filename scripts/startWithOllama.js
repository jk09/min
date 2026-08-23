/*
Starts Min configured to use a local Ollama model for the /b LLM-prompt command.
Requires Ollama installed and the model already pulled, e.g. `ollama pull llama3.2`.
See README.md > "LLM prompt: /b <command> browser commands" for details.

Usage: npm run startWithOllama -- [model]
*/

const { spawnSync } = require('child_process')

const model = process.argv[2] || 'llama3.2'

const result = spawnSync('npm', ['start'], {
  stdio: 'inherit',
  shell: true,
  env: Object.assign({}, process.env, {
    MIN_LLM_PROVIDER: 'ollama',
    MIN_LLM_MODEL: model
  })
})

process.exit(result.status === null ? 1 : result.status)
