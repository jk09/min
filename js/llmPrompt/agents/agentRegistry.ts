/*
Registry of predefined AI agents the LLM prompt can hand a request off to.

Only 'claude' is functional today: it opens Claude.ai's own new-chat web UI with
the prompt (plus the current page as context) pre-filled via the `q` query
parameter. The others are safe, inert placeholders until their own hand-off
conventions are wired up.
*/

export interface AgentDefinition {
  id: string
  title: string
  shortTitle: string
  hostname: string
  functional: boolean
  buildURL?: (prompt: string, contextURL?: string) => string
}

export const AGENTS: AgentDefinition[] = [
  {
    id: 'chatgpt',
    title: 'OpenAI ChatGPT',
    shortTitle: 'ChatGPT',
    hostname: 'chatgpt.com',
    functional: false
  },
  {
    id: 'claude',
    title: 'Anthropic Claude.ai',
    shortTitle: 'Claude.ai',
    hostname: 'claude.ai',
    functional: true,
    buildURL: function (prompt: string, contextURL?: string): string {
      const text = contextURL ? (prompt + '\n\nContext: ' + contextURL) : prompt
      return 'https://claude.ai/new?q=' + encodeURIComponent(text)
    }
  },
  {
    id: 'perplexity',
    title: 'Perplexity.ai',
    shortTitle: 'Perplexity',
    hostname: 'perplexity.ai',
    functional: false
  },
  {
    id: 'copilot',
    title: 'Microsoft Copilot',
    shortTitle: 'Copilot',
    hostname: 'copilot.microsoft.com',
    functional: false
  }
]

export const DEFAULT_AGENT_ID: string = 'claude'

export function list (): AgentDefinition[] {
  return AGENTS.slice()
}

export function get (id: string): AgentDefinition | null {
  return AGENTS.find(agent => agent.id === id) || null
}

export function getDefault (): AgentDefinition | null {
  return get(DEFAULT_AGENT_ID)
}

module.exports = {
  DEFAULT_AGENT_ID,
  list,
  get,
  getDefault
}
