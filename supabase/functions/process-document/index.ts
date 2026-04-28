// @ts-nocheck — runs in Deno on Supabase, not Node.
// Supabase Edge Function: process-document
// קלט: document_id של מסמך מטופל
// פלט: ערכים מחולצים מתמונה/PDF (HbA1c, LDL, וכו') ע"י Claude Vision

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { encodeBase64 } from 'jsr:@std/encoding@1/base64'
import { callAnthropic, AnthropicTimeoutError } from '../_shared/anthropic.ts'

const ANTHROPIC_MODEL = 'claude-sonnet-4-6'
const MAX_OUTPUT_TOKENS = 1024

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const SYSTEM_PROMPT = `אתה מערכת חילוץ ערכים רפואיים מתמונות בדיקות מעבדה ומסמכים רפואיים.
חלץ את הערכים הבאים אם הם נמצאים בתמונה. כל ערך חייב להיות מספר בלבד (ללא יחידות).

מפתחות אפשריים:
- hba1c (%)
- glucose (mg/dL)
- ldl, hdl, total_cholesterol, triglycerides (mg/dL)
- creatinine (mg/dL)
- egfr (mL/min)
- microalbumin (mg/g)
- tsh (mIU/L)
- b12 (pg/mL)
- vitamin_d (ng/mL)
- systolic_bp, diastolic_bp (mmHg)
- pulse (bpm)
- weight (kg)
- height (cm)
- bmi (kg/m²)

החזר JSON תקני בלבד, ללא טקסט נוסף, בפורמט הבא:
{
  "values": { "hba1c": 7.8, "ldl": 115, ... },
  "test_date": "2026-04-15" או null,
  "warnings": ["ערך חריג: ..." או "לא ברור: ..."]
}

חוקים:
1. אם ערך לא נמצא — אל תכלול אותו במפתחות.
2. test_date בפורמט YYYY-MM-DD אם זוהה תאריך, אחרת null.
3. החזר JSON תקין בלבד. אסור טקסט מחוץ ל-JSON.`

interface ProcessRequest {
  document_id: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Unauthorized' }, 401)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!anthropicKey) {
      return json({ error: 'ANTHROPIC_API_KEY is not configured' }, 500)
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) return json({ error: 'Unauthorized' }, 401)

    const { document_id } = (await req.json()) as ProcessRequest
    if (!document_id) return json({ error: 'חסר document_id' }, 400)

    const { data: doc, error: dErr } = await supabase
      .from('patient_documents')
      .select('id, file_url, file_name')
      .eq('user_id', user.id)
      .eq('id', document_id)
      .single()
    if (dErr || !doc) return json({ error: 'מסמך לא נמצא' }, 404)

    const { data: file, error: fErr } = await supabase.storage
      .from('documents')
      .download(doc.file_url as string)
    if (fErr || !file) {
      return json({ error: `שגיאה בהורדת קובץ: ${fErr?.message}` }, 500)
    }

    const buf = await file.arrayBuffer()
    const base64 = encodeBase64(buf)
    const fileName = (doc.file_name as string | null) ?? ''
    const ext = fileName.split('.').pop()?.toLowerCase() ?? ''

    const isPdf = ext === 'pdf'
    const mediaType = isPdf
      ? 'application/pdf'
      : ext === 'png'
        ? 'image/png'
        : ext === 'webp'
          ? 'image/webp'
          : ext === 'gif'
            ? 'image/gif'
            : 'image/jpeg'

    const contentBlock = isPdf
      ? {
          type: 'document',
          source: {
            type: 'base64',
            media_type: mediaType,
            data: base64,
          },
        }
      : {
          type: 'image',
          source: {
            type: 'base64',
            media_type: mediaType,
            data: base64,
          },
        }

    let anthropicRes: Response
    try {
      anthropicRes = await callAnthropic({
        apiKey: anthropicKey,
        model: ANTHROPIC_MODEL,
        maxTokens: MAX_OUTPUT_TOKENS,
        system: SYSTEM_PROMPT,
        content: [contentBlock, { type: 'text', text: 'חלץ ערכים והחזר JSON.' }],
        timeoutMs: 90_000,
      })
    } catch (e) {
      if (e instanceof AnthropicTimeoutError) {
        console.error('Anthropic call timed out')
        return json(
          { error: 'עיבוד המסמך ארך זמן רב מדי. נסה שוב.' },
          504,
        )
      }
      throw e
    }

    let claudeData: any
    try {
      claudeData = await anthropicRes.json()
    } catch (parseErr) {
      console.error('Failed to parse Anthropic response as JSON', parseErr)
      return json({ error: 'תגובה לא תקינה מ-Claude' }, 502)
    }
    if (!anthropicRes.ok) {
      console.error('Claude API error', anthropicRes.status, claudeData)
      const status = anthropicRes.status === 429 ? 429 : 502
      const safeMsg =
        anthropicRes.status === 429
          ? 'יותר מדי בקשות, נסה שוב בעוד רגע'
          : 'שגיאה בשירות עיבוד המסמך'
      return json({ error: safeMsg }, status)
    }

    const responseBlocks = (claudeData.content ?? []) as Array<{
      type: string
      text?: string
    }>
    const rawText = responseBlocks
      .filter((b) => b.type === 'text')
      .map((b) => b.text ?? '')
      .join('\n')
      .trim()

    const extracted = parseJsonFromResponse(rawText)

    return json({
      extracted,
      raw: rawText,
      usage: claudeData.usage,
      model: claudeData.model,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return json({ error: message }, 500)
  }
})

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'content-type': 'application/json',
    },
  })
}


/** Strip markdown fences and try to parse JSON. */
function parseJsonFromResponse(text: string): unknown {
  const stripped = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim()
  try {
    return JSON.parse(stripped)
  } catch {
    const start = stripped.indexOf('{')
    const end = stripped.lastIndexOf('}')
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(stripped.slice(start, end + 1))
      } catch {
        // ignore
      }
    }
    return { raw_text: text, parse_error: true }
  }
}
