<#
Starts Min configured to use a local Ollama model for the /b LLM-prompt command.
Requires Ollama installed and the model already pulled, e.g. `ollama pull llama3.2`.
See README.md > "LLM prompt: /b <command> browser commands" for details.
#>

# Prerequisite: install Ollama (https://ollama.com/download) and pull -Model
# (`ollama pull <model>`) before running this script - it does not install/pull anything itself.
param(
    [string]$Model = "llama3.2"
)

$env:MIN_LLM_PROVIDER = "ollama"
$env:MIN_LLM_MODEL = $Model

npm start
