/**
 * Helpers for invoking a Supabase edge function that proxies an Anthropic
 * streaming response (SSE). We can't use supabase.functions.invoke() because
 * it buffers the response body — we need the raw stream to surface tokens
 * as they arrive.
 */
import { supabase } from './supabase'

export interface StreamUsage {
  input_tokens?: number
  output_tokens?: number
  cache_creation_input_tokens?: number
  cache_read_input_tokens?: number
}

export interface StreamResult {
  text: string
  model?: string
  usage?: StreamUsage
  stopReason?: string
}

export interface StreamHandlers {
  onDelta?: (chunk: string, accumulated: string) => void
  signal?: AbortSignal
}

/**
 * POST a JSON body to a Supabase edge function and consume its Anthropic SSE
 * stream. Returns the accumulated text plus final usage/model info.
 *
 * The edge function is expected to forward Anthropic's native SSE event format
 * (event: content_block_delta, data: {...}) directly to the client.
 */
export async function streamEdgeFunction(
  functionName: string,
  body: unknown,
  { onDelta, signal }: StreamHandlers = {},
): Promise<StreamResult> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData.session?.access_token
  if (!token) throw new Error('לא מחובר')

  const url = `${supabaseUrl}/functions/v1/${functionName}`
  const res = await fetch(url, {
    method: 'POST',
    signal,
    headers: {
      Authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY as string,
      accept: 'text/event-stream',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok || !res.body) {
    let errorMsg = `שגיאה (${res.status})`
    try {
      const errBody = await res.json()
      if (errBody?.error) errorMsg = errBody.error
    } catch {
      // ignore
    }
    throw new Error(errorMsg)
  }

  // Defensive: if the edge function hasn't been redeployed and is still
  // returning JSON (the pre-streaming response shape), surface a clear error
  // instead of silently parsing zero SSE events.
  const contentType = res.headers.get('content-type') ?? ''
  if (!contentType.includes('text/event-stream')) {
    const fallback = await res.text().catch(() => '')
    let parsed: any = null
    try {
      parsed = JSON.parse(fallback)
    } catch {
      // ignore
    }
    // Old function returned { template } / { summary } — fall back to it so
    // existing deployments keep working.
    if (parsed?.template) {
      return { text: parsed.template, model: parsed.model, usage: parsed.usage }
    }
    if (parsed?.summary) {
      return { text: parsed.summary, model: parsed.model, usage: parsed.usage }
    }
    throw new Error(
      `הפונקציה לא מחזירה stream (content-type: ${contentType || 'unknown'}). יש לפרוס מחדש את ה-Edge Function.`,
    )
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  const result: StreamResult = { text: '' }

  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    // SSE events are separated by blank lines.
    let sepIdx: number
    while ((sepIdx = buffer.indexOf('\n\n')) !== -1) {
      const rawEvent = buffer.slice(0, sepIdx)
      buffer = buffer.slice(sepIdx + 2)
      const data = parseSSEData(rawEvent)
      if (!data) continue
      handleEvent(data, result, onDelta)
    }
  }
  // Flush any trailing event without the final blank line.
  if (buffer.trim().length > 0) {
    const data = parseSSEData(buffer)
    if (data) handleEvent(data, result, onDelta)
  }

  return result
}

function parseSSEData(raw: string): unknown | null {
  // An event block can have multiple lines like:
  //   event: content_block_delta
  //   data: {...}
  // We only care about the data line — Anthropic includes the type inside it.
  const lines = raw.split('\n')
  const dataLines = lines
    .filter((l) => l.startsWith('data:'))
    .map((l) => l.slice(5).trimStart())
  if (dataLines.length === 0) return null
  const joined = dataLines.join('\n')
  if (joined === '[DONE]') return null
  try {
    return JSON.parse(joined)
  } catch {
    return null
  }
}

function handleEvent(
  data: any,
  result: StreamResult,
  onDelta?: StreamHandlers['onDelta'],
): void {
  switch (data.type) {
    case 'message_start':
      result.model = data.message?.model
      if (data.message?.usage) {
        result.usage = { ...result.usage, ...data.message.usage }
      }
      break
    case 'content_block_delta': {
      const delta = data.delta
      if (delta?.type === 'text_delta' && typeof delta.text === 'string') {
        result.text += delta.text
        onDelta?.(delta.text, result.text)
      }
      // thinking_delta intentionally ignored — internal reasoning, not shown.
      break
    }
    case 'message_delta':
      if (data.delta?.stop_reason) result.stopReason = data.delta.stop_reason
      if (data.usage) result.usage = { ...result.usage, ...data.usage }
      break
    case 'error':
      throw new Error(data.error?.message ?? 'Anthropic stream error')
    default:
      break
  }
}
