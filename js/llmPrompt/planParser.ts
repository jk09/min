/*
Parses the plan returned by the model. Model output is untrusted data: it is only
ever parsed as JSON and matched against the tool catalog, never evaluated.

Expected shape:
  { "message": "short answer for the user", "toolCalls": [ { "tool": "search.web", "args": { "query": "..." } } ] }
*/

export const MAX_TOOL_CALLS: number = 5

export interface ToolCall {
  tool: string
  args: Record<string, any>
}

export interface Plan {
  message: string
  toolCalls: ToolCall[]
}

export type ParsePlanResult =
  | { ok: true; plan: Plan }
  | { ok: false; errorCode: string; errorMessage: string }

export function extractJSON (raw?: string | null): any {
  const text = String(raw || '').trim()
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text)
  const candidate = fenced ? fenced[1].trim() : text

  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')

  if (start === -1 || end <= start) {
    return null
  }

  try {
    return JSON.parse(candidate.slice(start, end + 1))
  } catch (e) {
    return null
  }
}

export function parsePlan (raw?: string | null, knownToolIds?: string[] | null): ParsePlanResult {
  const parsed = extractJSON(raw)

  if (!parsed || typeof parsed !== 'object') {
    return { ok: false, errorCode: 'malformed_plan', errorMessage: 'The model did not return a usable plan.' }
  }

  const message = typeof parsed.message === 'string' ? parsed.message.trim() : ''
  const rawCalls = parsed.toolCalls === undefined ? [] : parsed.toolCalls

  if (!Array.isArray(rawCalls)) {
    return { ok: false, errorCode: 'malformed_plan', errorMessage: 'The model returned toolCalls that are not a list.' }
  }

  if (rawCalls.length > MAX_TOOL_CALLS) {
    return { ok: false, errorCode: 'plan_too_long', errorMessage: 'The model requested more than ' + MAX_TOOL_CALLS + ' actions.' }
  }

  const toolCalls: ToolCall[] = []

  for (const call of rawCalls) {
    if (!call || typeof call.tool !== 'string') {
      return { ok: false, errorCode: 'malformed_plan', errorMessage: 'The model returned a tool call without a tool name.' }
    }

    if (knownToolIds && !knownToolIds.includes(call.tool)) {
      return { ok: false, errorCode: 'unknown_tool', errorMessage: 'The model asked for an unknown tool "' + call.tool + '".' }
    }

    if (call.args !== undefined && (typeof call.args !== 'object' || call.args === null || Array.isArray(call.args))) {
      return { ok: false, errorCode: 'malformed_plan', errorMessage: 'The model returned invalid arguments for "' + call.tool + '".' }
    }

    toolCalls.push({ tool: call.tool, args: call.args || {} })
  }

  if (!message && toolCalls.length === 0) {
    return { ok: false, errorCode: 'empty_plan', errorMessage: 'The model returned nothing to do.' }
  }

  return { ok: true, plan: { message, toolCalls } }
}

module.exports = { MAX_TOOL_CALLS, parsePlan, extractJSON }
