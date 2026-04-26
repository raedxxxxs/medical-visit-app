// @ts-nocheck — runs in Deno on Supabase, not Node. TS errors here are harmless.
// Supabase Edge Function: generate-visit (v2 — extracted text)
// קלט: נתוני מטופל + רשימת מזהי הנחיות
// פלט: שבלונה רפואית מובנית בעברית, מבוססת על הטקסט החולץ מההנחיות

import { createClient } from 'jsr:@supabase/supabase-js@2'

const ANTHROPIC_MODEL = 'claude-sonnet-4-6'
const MAX_OUTPUT_TOKENS = 4096
const MAX_TEXT_PER_GUIDELINE = 400_000 // chars; safe upper bound

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function getToneInstruction(tone: 'standard' | 'first_person' | 'educational'): string {
  if (tone === 'first_person') {
    return `**טון הכתיבה**: גוף ראשון — מנקודת המבט של הרופא הבודק. השתמש בביטויים: "בדקתי...", "אני ממליץ...", "ראיתי כי...", "אבקש...". שמור על מקצועיות אבל עם טון אישי קליני.`
  }
  if (tone === 'educational') {
    return `**טון הכתיבה**: לימודי — הוסף הסברים קצרים על הרציונל הקליני שמאחורי כל המלצה (פתופיזיולוגיה, יעד טיפולי, מנגנון). מתאים לסטודנטים ומתמחים. עדיין תמציתי — בלי הרצאות ארוכות.`
  }
  return `**טון הכתיבה**: מקצועי-קליני סטנדרטי, תמציתי, ניטרלי.`
}

function buildSystemPrompt(tone: 'standard' | 'first_person' | 'educational'): string {
  return `אתה עוזר רפואי לרופא משפחה. אתה מייצר שבלונת ביקור בעברית.

${getToneInstruction(tone)}

═══════════════════════════════════════════════════
חוקים אסורים מוחלטים — הפרת אחד מהם = פסילת כל הפלט
═══════════════════════════════════════════════════

🚫 חוק 1 — אסור בתכלית האיסור לכלול את הכותרת "בדיקה גופנית" או "Physical Examination" או כל וריאציה שלהן.

🚫 חוק 2 — אסור ציטוטים מההנחיות בגוף השבלונה (רק בסעיף "מקורות" בסוף).
   אסור: ">  ציטוט", "*ADA Standards*", "Section X", "עמוד X", שמות הנחיות באמצע טקסט.

🚫 חוק 3 — אסור באנגלית בגוף חוץ מ: שמות תרופות, ערכים+יחידות, קיצורים מקובלים (HbA1c, LDL, eGFR, BMI, ACE-I, ARB, SGLT2).

═══════════════════════════════════════════════════
מבנה הפלט המחייב — בדיוק כך, ללא תוספות
═══════════════════════════════════════════════════

## סיבת הגעה
טקסט קצר.

## אנמנזה ממוקדת
פתח במשפט אחד שמסכם את **רקע המטופל** — גיל, מין, מחלות רקע (כולל אלה מהשדה "מחלות רקע" של המטופל וגם אלה שזוהו מתמונה/טקסט חופשי), תרופות עיקריות.
לדוגמה: "מטופל בן 65, סוכרת מסוג 2, יתר לחץ דם, היפרליפידמיה, מטופל ב-Metformin 850mg x2/day, Atorvastatin 40mg HS, Lisinopril 10mg x1/day."
לאחר מכן — תיאור התלונה הנוכחית והאנמנזה הממוקדת.

## ערכי מעבדה
פורמט מינימלי בלבד. כל שורה: \`שם בדיקה: ערך\`. אם הערך חריג — הוסף חץ ↑ (גבוה) או ↓ (נמוך) בסוף בלבד. **בלי** מבוא, **בלי** יחידות מודגשות, **בלי** הסברים, **בלי** קונטקסט, **בלי** רשימה ממוספרת.

✅ נכון:
\`\`\`
HbA1c: 8.2 ↑
LDL: 145 ↑
eGFR: 62
\`\`\`

❌ אסור: "ערכים שהוזנו: HbA1c עומד על 8.2 (גבוה מהיעד)..."

## הערכה
ניתוח קליני, **ללא ציטוטים ובלי שמות הנחיות**.
התייחס במפורש למינון ולתדירות של כל תרופה רלוונטית, וקבע אם הטיפול הנוכחי מספק.

**אם המטופל סובל מ-3 או יותר מצבים כרוניים — סדר את ההערכה לפי מערכת/מחלה** עם תת-כותרות \`### סוכרת\`, \`### יתר לחץ דם\`, \`### שומנים\`, \`### כליות\`, וכו'. כל סעיף מסכם את המצב הנוכחי של אותה מחלה ספציפית.

## המלצות
המלצות ממוספרות. ניסוח קליני בלבד. **ללא ציטוטים. ללא Section/עמוד. ללא שמות הנחיות.**
**אם 3+ מחלות כרוניות** — סדר גם את ההמלצות לפי תת-כותרות בסדר זהה ל"הערכה".
**בכל המלצה לשינוי טיפול** — ציין מינון+תדירות חדשים (לדוגמה: "העלאה ל-Metformin 1000mg x2/day" או "הוספת Empagliflozin 10mg x1/day").

## בדיקות שהוזמנו
רשימה.

## ביקור הבא
מועד + מטרה.

## מקורות
**רק כאן** מותר ציטוטים. שורה לכל מקור: \`- [שם ההנחיה, סעיף/עמוד] — נושא: "ציטוט"\`

═══════════════════════════════════════════════════
סיום קבוע (אחרי "מקורות"):

ההמלצות הן כלי עזר. ההחלטה הקלינית היא של הרופא.

═══════════════════════════════════════════════════
דוגמת ניסוח נכון בסעיף "המלצות":
✅ "1. התחלת SGLT2 Inhibitor (לדוג' Empagliflozin 10mg x1/day) בשל סוכרת + סיכון קרדיווסקולרי."
❌ "1. התחלת SGLT2... > *ציטוט:* '...' — *ADA, Section 9*"

זכור: הפרת חוק 1 או 2 = הפלט נפסל. החזר טקסט נקי, מוכן להעתקה למערכת קליקס.`
}

interface GenerateRequest {
  patient_data: Record<string, unknown>
  visit_type: string
  visit_date: string
  guideline_ids: string[]
  patient_summary?: string
  tone?: 'standard' | 'first_person' | 'educational'
}

interface TextBlock {
  type: 'text'
  text: string
  cache_control?: { type: 'ephemeral' }
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
    if (!authHeader) {
      return json({ error: 'Unauthorized: missing Authorization header' }, 401)
    }

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
    if (authError || !user) {
      return json({ error: 'Unauthorized' }, 401)
    }

    const body = (await req.json()) as GenerateRequest
    const { patient_data, visit_type, visit_date, guideline_ids } = body

    if (!Array.isArray(guideline_ids) || guideline_ids.length === 0) {
      return json({ error: 'יש לבחור לפחות הנחיה אחת' }, 400)
    }
    // Reject pathologically large patient_data (DoS guard)
    if (patient_data && JSON.stringify(patient_data).length > 50_000) {
      return json({ error: 'נתוני מטופל גדולים מדי' }, 400)
    }
    if (body.patient_summary && body.patient_summary.length > 5_000) {
      return json({ error: 'תקציר מטופל ארוך מדי' }, 400)
    }

    const { data: guidelines, error: gErr } = await supabase
      .from('guidelines')
      .select('id, title, file_name, extracted_text')
      .eq('user_id', user.id)
      .in('id', guideline_ids)

    if (gErr) return json({ error: gErr.message }, 500)
    if (!guidelines || guidelines.length === 0) {
      return json({ error: 'לא נמצאו הנחיות' }, 404)
    }

    const missingText = guidelines.filter((g) => !g.extracted_text)
    if (missingText.length === guidelines.length) {
      return json(
        {
          error:
            'אין טקסט חולץ באף אחת מההנחיות שנבחרו. לחץ על "חלץ טקסט" ליד ההנחיה במאגר.',
          missing: missingText.map((g) => g.title),
        },
        400,
      )
    }

    const blocks: TextBlock[] = []
    let totalChars = 0
    const TOTAL_BUDGET = 800_000 // ~200K tokens, well under 1M Anthropic limit
    for (const g of guidelines) {
      if (!g.extracted_text) continue
      let text = g.extracted_text as string
      if (text.length > MAX_TEXT_PER_GUIDELINE) {
        text =
          text.slice(0, MAX_TEXT_PER_GUIDELINE) +
          '\n\n[... קוצר בגלל אורך — חלק מהטקסט הושמט]'
      }
      const remaining = TOTAL_BUDGET - totalChars
      if (remaining <= 0) {
        // Skip remaining guidelines to avoid exceeding token budget
        break
      }
      if (text.length > remaining) {
        text =
          text.slice(0, remaining) +
          '\n\n[... קוצר עקב חריגה מתקציב הקלט הכולל]'
      }
      totalChars += text.length
      blocks.push({
        type: 'text',
        text: `# הנחיה: ${g.title}\n(שם קובץ: ${g.file_name})\n\n${text}`,
        cache_control: { type: 'ephemeral' },
      })
    }

    const userText = buildPatientPrompt({
      patient_data,
      visit_type,
      visit_date,
      patient_summary: body.patient_summary,
    })

    const tone = body.tone === 'first_person' || body.tone === 'educational'
      ? body.tone
      : 'standard'

    const anthropicRes = await callAnthropicWithRetry({
      apiKey: anthropicKey,
      model: ANTHROPIC_MODEL,
      maxTokens: MAX_OUTPUT_TOKENS,
      system: buildSystemPrompt(tone),
      content: [...blocks, { type: 'text', text: userText }],
    })

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
          : 'שגיאה בשירות יצירת הביקור'
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

    const text = sanitizeTemplate(rawText)

    return json({
      template: text,
      usage: claudeData.usage,
      model: claudeData.model,
      guidelines_used: guidelines.map((g) => ({
        id: g.id,
        title: g.title,
        text_chars: (g.extracted_text as string | null)?.length ?? 0,
      })),
      missing_text: missingText.map((g) => g.title),
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

/** Call Anthropic API with timeout + retry on 429/5xx (exponential backoff). */
async function callAnthropicWithRetry(args: {
  apiKey: string
  model: string
  maxTokens: number
  system: string
  content: unknown[]
}): Promise<Response> {
  const TIMEOUT_MS = 90_000
  const MAX_ATTEMPTS = 3
  let lastErr: unknown
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
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
      clearTimeout(timer)
      if (res.status === 429 || res.status >= 500) {
        if (attempt < MAX_ATTEMPTS) {
          const baseDelay = 1000 * 2 ** (attempt - 1)
          const retryAfterHeader = res.headers.get('retry-after')
          const retryAfterMs = retryAfterHeader
            ? parseInt(retryAfterHeader, 10) * 1000
            : 0
          const delay = Math.max(baseDelay, retryAfterMs || 0)
          await new Promise((r) => setTimeout(r, delay))
          continue
        }
      }
      return res
    } catch (e) {
      clearTimeout(timer)
      lastErr = e
      if (attempt < MAX_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, 1000 * 2 ** (attempt - 1)))
        continue
      }
    }
  }
  throw lastErr ?? new Error('Anthropic call failed')
}

/**
 * Post-processor that enforces the structural rules regardless of model output:
 * 1. Removes "## בדיקה גופנית" section entirely (header + body until next ##).
 * 2. Strips inline citations from body sections (blockquotes with ציטוט/Section/ADA/etc),
 *    keeping them only in the ## מקורות section.
 */
function sanitizeTemplate(input: string): string {
  let text = input

  // 1. Remove "בדיקה גופנית" section (and any English variants), from its header
  // until the next "## " heading or end-of-text. JS regex doesn't support \Z; use lookahead with $.
  const physExamPatterns = [
    /^[ \t]*##[ \t]*בדיקה[ \t]*גופנית[\s\S]*?(?=^[ \t]*##[ \t]|$(?![\s\S]))/gm,
    /^[ \t]*##[ \t]*Physical[ \t]*Examination[\s\S]*?(?=^[ \t]*##[ \t]|$(?![\s\S]))/gim,
    /^[ \t]*##[ \t]*בדיקה[ \t]*קלינית[\s\S]*?(?=^[ \t]*##[ \t]|$(?![\s\S]))/gm,
  ]
  for (const re of physExamPatterns) text = text.replace(re, '')

  // 2. Split into "body" and "מקורות" sections.
  const sourcesIdx = text.search(/^[ \t]*##[ \t]*מקורות/m)
  let body = sourcesIdx >= 0 ? text.slice(0, sourcesIdx) : text
  const sources = sourcesIdx >= 0 ? text.slice(sourcesIdx) : ''

  // 3. From the body only, remove inline citation BLOCKQUOTE lines.
  // Only match lines that START with `>` (markdown blockquote) and look like citations.
  body = body
    .split('\n')
    .filter((line) => {
      const t = line.trim()
      // Must be a blockquote AND contain explicit citation markers
      if (!/^>/.test(t)) return true
      if (/^>\s*\*{0,2}ציטוט/.test(t)) return false
      // Strict guideline-citation pattern (must have all-caps doc name OR explicit "Standards of Care")
      if (/(\bADA\b|\bNICE\b|\bAHA\b|Standards of Care|Section\s+\d+\b)/.test(t))
        return false
      return true
    })
    .join('\n')

  // 4. Remove inline reference markers like " — *ADA Standards of Care 2026, Section 8*"
  // Only match well-formed citation patterns wrapped in asterisks/em-dashes.
  body = body
    .replace(
      /[—–-]\s*\*+[^*\n]*?(\bADA\b|\bNICE\b|\bAHA\b|Standards of Care|Section\s+\d+\b)[^*\n]*?\*+/g,
      '',
    )
    .replace(/\(\s*(\bADA\b|\bNICE\b|\bAHA\b)[^)]*\)/g, '')
    .replace(/\s*—\s*Section\s+\d+\b/g, '')

  // 5. Collapse extra blank lines.
  let result = (body + '\n' + sources).replace(/\n{3,}/g, '\n\n').trim()

  // 6. Ensure final disclaimer present.
  if (!/ההחלטה הקלינית היא של הרופא/.test(result)) {
    result += '\n\nההמלצות הן כלי עזר. ההחלטה הקלינית היא של הרופא.'
  }
  return result
}

function buildPatientPrompt(args: {
  patient_data: Record<string, unknown>
  visit_type: string
  visit_date: string
  patient_summary?: string
}): string {
  const { patient_data, visit_type, visit_date, patient_summary } = args
  const parts: string[] = []
  parts.push(`# נתוני הביקור`)
  parts.push(`- סוג ביקור: ${visit_type}`)
  parts.push(`- תאריך: ${visit_date}`)
  // Wrap untrusted patient text in XML tags so Claude treats it as data,
  // not as instructions (mitigates prompt injection from notes/free text).
  if (patient_summary) {
    parts.push(`- מטופל: <patient_summary>${patient_summary}</patient_summary>`)
  }

  const labs = (patient_data.labs ?? {}) as Record<string, string>
  const vitals = (patient_data.vitals ?? {}) as Record<string, string>
  const anamnesis = (patient_data.anamnesis ?? {}) as {
    symptoms?: string[]
    free_text?: string
  }

  const vitalEntries = Object.entries(vitals).filter(([, v]) => v)
  if (vitalEntries.length > 0) {
    parts.push(`\n## מדידות`)
    for (const [k, v] of vitalEntries) parts.push(`- ${k}: ${v}`)
  }

  const labEntries = Object.entries(labs).filter(([, v]) => v)
  if (labEntries.length > 0) {
    parts.push(`\n## מעבדה`)
    for (const [k, v] of labEntries) parts.push(`- ${k}: ${v}`)
  }

  if ((anamnesis.symptoms ?? []).length > 0) {
    parts.push(`\n## סימפטומים מדווחים`)
    parts.push((anamnesis.symptoms ?? []).join(', '))
  }
  if (anamnesis.free_text) {
    parts.push(`\n## טקסט חופשי מהאנמנזה`)
    parts.push(`<free_text>${anamnesis.free_text}</free_text>`)
  }

  parts.push(
    `\nצור שבלונת ביקור מלאה לפי המבנה הנדרש, מבוססת על ההנחיות שצורפו וערכי המטופל לעיל.`,
  )
  return parts.join('\n')
}
