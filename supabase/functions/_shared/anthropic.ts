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

export interface CallAnthropicArgs {
  apiKey: string
  model: string
  maxTokens: number
  system: string
  content: unknown[]
  /** Per-attempt wall-clock timeout. Default 120s. */
  timeoutMs?: number
  /** Max attempts on 429/5xx (NOT on timeouts). Default 2. */
  maxRetriesOn5xx?: number
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
 * non-OK statuses to user-facing errors.
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
        body: JSON.stringify({
          model: args.model,
          max_tokens: args.maxTokens,
          system: args.system,
          messages: [{ role: 'user', content: args.content }],
        }),
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
