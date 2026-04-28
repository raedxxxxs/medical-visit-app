// @ts-nocheck — runs in Deno on Supabase, not Node.
// Shared Anthropic API client used by every edge function that calls Claude.
//
// Why this exists: previously each function defined its own timeout + retry loop
// with TIMEOUT_MS * MAX_ATTEMPTS arithmetic. When the values were too low or
// retries were attempted on AbortError, the user saw the cryptic DOMException
// "The signal has been aborted" message. Centralizing the logic here makes the
// bug structurally impossible to reintroduce in a single function.

export class AnthropicTimeoutError extends Error {
  constructor(message = 'Anthropic call timed out') {
    super(message)
    this.name = 'AnthropicTimeoutError'
  }
}

interface SystemBlock {
  type: 'text'
  text: string
  cache_control?: { type: 'ephemeral' }
}

interface ThinkingConfig {
  type: 'enabled'
  budget_tokens: number
}

interface Tool {
  name: string
  description?: string
  input_schema: Record<string, unknown>
}

type ToolChoice =
  | { type: 'auto' }
  | { type: 'any' }
  | { type: 'tool'; name: string }

export interface CallAnthropicArgs {
  apiKey: string
  model: string
  maxTokens: number
  /** Either a plain string, or an array of system blocks (use blocks to enable cache_control). */
  system: string | SystemBlock[]
  content: unknown[]
  /** Per-attempt wall-clock timeout. Default 120s. */
  timeoutMs?: number
  /** Max attempts on 429/5xx (NOT on timeouts). Default 2. */
  maxRetriesOn5xx?: number
  /** Optional extended-thinking config. Requires maxTokens > budget_tokens. */
  thinking?: ThinkingConfig
  /** When true, request a streaming response (SSE). Caller proxies/consumes the stream. */
  stream?: boolean
  /** Optional tools — pair with tool_choice to force structured output. */
  tools?: Tool[]
  /** Pin Claude to a specific tool to guarantee structured output shape. */
  tool_choice?: ToolChoice
}

function buildBody(args: CallAnthropicArgs): string {
  const body: Record<string, unknown> = {
    model: args.model,
    max_tokens: args.maxTokens,
    system: args.system,
    messages: [{ role: 'user', content: args.content }],
  }
  if (args.thinking) body.thinking = args.thinking
  if (args.stream) body.stream = true
  if (args.tools) body.tools = args.tools
  if (args.tool_choice) body.tool_choice = args.tool_choice
  return JSON.stringify(body)
}

/**
 * Calls Anthropic's /v1/messages with:
 *  - A single in-flight attempt at any time (no parallel retries).
 *  - A wall-clock timeout per attempt; on timeout we throw AnthropicTimeoutError
 *    immediately rather than retrying. (Retrying a timeout just doubles wait.)
 *  - Retries ONLY on 429/5xx, with exponential backoff and respect for
 *    `retry-after`.
 *
 * Returns the raw Response. Caller is responsible for parsing JSON and mapping
 * non-OK statuses to user-facing errors. When `stream: true`, the response body
 * is a Server-Sent Events stream that the caller is responsible for consuming
 * or proxying — the timeout still applies to the time-to-first-byte; downstream
 * read time is not bounded here.
 */
export async function callAnthropic(args: CallAnthropicArgs): Promise<Response> {
  const timeoutMs = args.timeoutMs ?? 120_000
  const maxAttempts = Math.max(1, args.maxRetriesOn5xx ?? 2)
  let lastRetryableErr: unknown
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    let res: Response
    try {
      res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'x-api-key': args.apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: buildBody(args),
      })
    } catch (e) {
      clearTimeout(timer)
      if (isAbortError(e)) {
        // Timeout — do NOT retry; surface as typed error.
        throw new AnthropicTimeoutError()
      }
      // Network error: retry if attempts remain.
      lastRetryableErr = e
      if (attempt < maxAttempts) {
        await sleep(1000 * 2 ** (attempt - 1))
        continue
      }
      throw e
    }
    clearTimeout(timer)
    if (res.status === 429 || res.status >= 500) {
      if (attempt < maxAttempts) {
        const baseDelay = 1000 * 2 ** (attempt - 1)
        const retryAfterHeader = res.headers.get('retry-after')
        const retryAfterMs = retryAfterHeader
          ? parseInt(retryAfterHeader, 10) * 1000
          : 0
        await sleep(Math.max(baseDelay, retryAfterMs || 0))
        continue
      }
    }
    return res
  }
  // Unreachable in practice — loop either returns or throws.
  throw lastRetryableErr ?? new Error('Anthropic call failed')
}

function isAbortError(e: unknown): boolean {
  return (
    (e instanceof Error && e.name === 'AbortError') ||
    (typeof DOMException !== 'undefined' &&
      e instanceof DOMException &&
      e.name === 'AbortError')
  )
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}
